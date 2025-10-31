import { prismaClient } from '../application/database';
import {
  JournalEntryForm,
  PurchaseReturnDetailForm,
  PurchaseReturnRequest,
} from '../utils/interface';
import { purchaseReturnSchema } from '../validation/purchaseReturnValidation';
import { validate } from '../validation/validation';
import { accountService } from './accountService';
import { purchaseService } from './purchaseService';
import { journalRepository } from '../repository/journalRepository';
import { inventoryBatchRepository } from '../repository/inventoryBatchRepository';
import { productRepository } from '../repository/productRepository';
import { payableRepository } from '../repository/payableRepository';
import { accountRepository } from '../repository/accountRepository';
import { journalEntryRepository } from '../repository/journalEntryRepository';
import { vatSettingRepository } from '../repository/vatSettingRepository';
import { generalsettingService } from './generalSettingService';
import { supplierService } from './supplierService';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  ReturnStatus,
} from '@prisma/client';
import { ResponseError } from '../entities/responseError';
import { Decimal } from '@prisma/client/runtime/library';
import { recalculateCOGS } from '../utils/cogs';
import { purchaseReturnRepository } from '../repository/purchaseReturnRepository';
import { purchaseReturnDetailRepository } from '../repository/purchaseReturnDetailRepository';
import { payablePaymentRepository } from '../repository/payablePaymentRepository';
import { getCashPaidFromJournal } from '../utils/helper';

export class PurchaseReturnService {
  async createPurchaseReturn({
    body,
  }: {
    body: PurchaseReturnRequest;
  }): Promise<any> {
    const req = validate(purchaseReturnSchema, body);
    const { purchaseId, returnDate, reason, items } = req;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil account default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const { inventoryAccount, vatInputAccount, payableAccount, cashAccount } =
        accountDefault;

      // ambil purchase dan relasinya
      const purchase = await purchaseService.getPurchase(
        purchaseId,
        prismaTransaction
      );
      const {
        supplier,
        payable,
        journal: oldJournal,
        purchaseDetails,
        paymentType,
        invoiceNumber,
      } = purchase;

      // validasi supplier
      await supplierService.getSupplierTransaction(
        supplier.supplierId,
        prismaTransaction
      );

      // ambil VAT rate
      const vatSetting = await vatSettingRepository.getActiveVatSetting(
        purchase.date,
        prismaTransaction
      );
      if (!vatSetting) throw new ResponseError(400, 'VAT setting not found');
      const vatRate = new Decimal(vatSetting.vatRate);

      // ambil inventory method
      const { inventoryMethod } =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // hitung return details + update stok
      let subtotal = new Decimal(0);
      const returnDetailsData: PurchaseReturnDetailForm[] = [];

      for (const item of items) {
        const detail = purchaseDetails.find(
          (d) => d.productId === item.productId
        );
        if (!detail) throw new ResponseError(400, `Product not found`);

        const batch = detail.inventoryBatch;
        if (!batch) throw new ResponseError(500, `Batch not found`);

        const returnableQty = batch.remainingStock;
        if (item.quantity > returnableQty) {
          throw new ResponseError(400, `Cannot return ${item.quantity} units`);
        }

        const returnValue = new Decimal(item.quantity).mul(detail.unitPrice);
        const vatAmount = returnValue.mul(vatRate).div(100);
        subtotal = subtotal.plus(returnValue);

        returnDetailsData.push({
          purchaseDetailId: detail.purchaseDetailId,
          batchId: batch.batchId,
          productId: item.productId,
          qtyReturned: item.quantity,
          unitPrice: detail.unitPrice,
          returnValue,
          vatAmount,
          totalWithVat: returnValue.plus(vatAmount),
        });

        await inventoryBatchRepository.decrementBatchStock(
          batch.batchId,
          item.quantity,
          prismaTransaction
        );

        await productRepository.decrementStock(
          item.productId,
          item.quantity,
          prismaTransaction
        );

        const cogs = await recalculateCOGS(
          item.productId,
          inventoryMethod,
          prismaTransaction
        );

        await productRepository.updateProductPriceById(
          {
            productId: item.productId,
            avgPurchasePrice: cogs,
            sellingPrice: cogs.add(detail.product.profitMargin || 0),
          },
          prismaTransaction
        );
      }

      const vat = subtotal.mul(vatRate).div(100);
      const total = subtotal.plus(vat);

      // buat journal
      const journal = await journalRepository.createJournal(
        {
          date: new Date(returnDate),
          description: `Retur Pembelian #${invoiceNumber}`,
          reference: invoiceNumber,
        },
        prismaTransaction
      );

      // buat purchase return
      const purchaseReturn =
        await purchaseReturnRepository.createPurchaseReturn(
          {
            purchaseId,
            supplierId: supplier.supplierId,
            returnDate: new Date(returnDate),
            reason: reason || null,
            subtotal,
            vat,
            total,
            status: ReturnStatus.PROCESSED,
            journalId: journal.journalId,
          },
          prismaTransaction
        );

      // buat detail purchase detail
      await purchaseReturnDetailRepository.createManyPurchaseReturnDetails(
        purchaseReturn.returnId,
        returnDetailsData,
        prismaTransaction
      );

      // buat journal entries
      const journalEntries: JournalEntryForm[] = [];

      journalEntries.push({
        journalId: journal.journalId,
        accountId: inventoryAccount.accountId,
        debit: new Decimal(0),
        credit: subtotal,
      });

      if (vat.gt(0)) {
        journalEntries.push({
          journalId: journal.journalId,
          accountId: vatInputAccount.accountId,
          debit: new Decimal(0),
          credit: vat,
        });
      }

      let reduceFromPayable = new Decimal(0);
      let cashRefund = new Decimal(0);

      switch (paymentType) {
        case PaymentType.CASH:
          cashRefund = total;
          journalEntries.push({
            journalId: journal.journalId,
            accountId: cashAccount.accountId,
            debit: total,
            credit: new Decimal(0),
          });
          break;

        case PaymentType.CREDIT:
          if (!payable) throw new ResponseError(500, 'Payable not found');
          reduceFromPayable = total;
          journalEntries.push({
            journalId: journal.journalId,
            accountId: payableAccount.accountId,
            debit: total,
            credit: new Decimal(0),
          });
          break;

        case PaymentType.MIXED:
          if (!payable) throw new ResponseError(500, 'Payable not found');

          const cashPaidFromPurchase = getCashPaidFromJournal(
            oldJournal.journalEntries,
            cashAccount.accountId
          );

          const maxFromPayable = Decimal.min(payable.remainingAmount, total);
          let potentialCashRefund = total.minus(maxFromPayable);
          cashRefund = Decimal.min(potentialCashRefund, cashPaidFromPurchase);
          reduceFromPayable = total.minus(cashRefund);

          if (reduceFromPayable.gt(0)) {
            journalEntries.push({
              journalId: journal.journalId,
              accountId: payableAccount.accountId,
              debit: reduceFromPayable,
              credit: new Decimal(0),
            });
          }

          if (cashRefund.gt(0)) {
            journalEntries.push({
              journalId: journal.journalId,
              accountId: cashAccount.accountId,
              debit: cashRefund,
              credit: new Decimal(0),
            });
          }
          break;

        default:
          throw new ResponseError(400, `Unsupported paymentType`);
      }

      await journalEntryRepository.createManyJournalEntries(
        journalEntries,
        prismaTransaction
      );

      // update payable (jika ada pengurangan hutang)
      if (
        (paymentType === PaymentType.CREDIT ||
          paymentType === PaymentType.MIXED) &&
        payable &&
        reduceFromPayable.gt(0)
      ) {
        const payableJournalEntry =
          await journalEntryRepository.findLatestDebitEntry(
            journal.journalId,
            reduceFromPayable,
            payableAccount.accountId,
            prismaTransaction
          );

        if (!payableJournalEntry)
          throw new ResponseError(500, 'Journal entry not found');

        await payablePaymentRepository.createPayment(
          {
            payableId: payable.payableId,
            paymentVoucher: null,
            journalEntryId: payableJournalEntry.journalEntryId,
            paymentAmount: reduceFromPayable,
            paymentDate: new Date(returnDate),
            method: PaymentMethod.RETURN,
          },
          prismaTransaction
        );

        const newPaid = new Decimal(payable.paidAmount).plus(reduceFromPayable);
        const newRemaining = new Decimal(payable.remainingAmount).minus(
          reduceFromPayable
        );
        const status = newRemaining.lte(0)
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL;

        await payableRepository.recordPayablePayment(
          {
            payableId: payable.payableId,
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status,
          },
          prismaTransaction
        );
      }

      // update saldo account
      const updateAccountBalance = async (
        account: any,
        newBalance: Decimal
      ) => {
        await accountRepository.updateAccountTransaction(
          { accountCode: account.accountCode, balance: newBalance },
          prismaTransaction
        );
      };

      await updateAccountBalance(
        inventoryAccount,
        inventoryAccount.balance.minus(subtotal)
      );

      if (vat.gt(0)) {
        await updateAccountBalance(
          vatInputAccount,
          vatInputAccount.balance.minus(vat)
        );
      }

      if (reduceFromPayable.gt(0)) {
        const newPayableBalance = new Decimal(payable?.remainingAmount!).minus(
          reduceFromPayable
        );
        await updateAccountBalance(payableAccount, newPayableBalance);
      }

      if (cashRefund.gt(0)) {
        await updateAccountBalance(
          cashAccount,
          cashAccount.balance.plus(cashRefund)
        );
      }

      return purchaseReturn;
    });
  }

  async deletePurchaseReturn(returnId: string): Promise<void> {
    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil purchase retrun dan relasinya
      const purchaseReturn =
        await purchaseReturnRepository.getPurchaseReturnById(
          returnId,
          prismaTransaction
        );

      if (!purchaseReturn) {
        throw new ResponseError(404, 'Purchase Return not found');
      }

      const {
        subtotal,
        vat,
        journalId,
        status,
        returnDetails: purchaseReturnDetails,
        journal,
        purchase,
      } = purchaseReturn;

      if (status !== ReturnStatus.PROCESSED) {
        throw new ResponseError(400, 'Only PROCESSED returns can be deleted');
      }

      const { paymentType, payable } = purchase;

      // ambil account default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const { inventoryAccount, vatInputAccount, payableAccount, cashAccount } =
        accountDefault;

      // ambil inventory method
      const { inventoryMethod } =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // reverse stok dan harga
      for (const detail of purchaseReturnDetails) {
        await inventoryBatchRepository.incrementBatchStock(
          detail.batchId,
          detail.qtyReturned,
          prismaTransaction
        );

        await productRepository.incrementStock(
          detail.productId,
          detail.qtyReturned,
          prismaTransaction
        );

        const cogs = await recalculateCOGS(
          detail.productId,
          inventoryMethod,
          prismaTransaction
        );

        await productRepository.updateProductPriceById(
          {
            productId: detail.productId,
            avgPurchasePrice: cogs,
            sellingPrice: cogs.add(detail.product.profitMargin || 0),
          },
          prismaTransaction
        );
      }

      // hitung reduceFromPayable & cashRefund dari JOURNAL ENTRIES
      let reduceFromPayable = new Decimal(0);
      let cashRefund = new Decimal(0);

      if (journal?.journalEntries) {
        // cari debit ke payableAccount → ini pengurangan hutang
        const payableEntry = journal.journalEntries.find(
          (je) => je.accountId === payableAccount.accountId && je.debit.gt(0)
        );
        reduceFromPayable = payableEntry
          ? new Decimal(payableEntry.debit)
          : new Decimal(0);

        // cari debit ke cashAccount → ini refund cash
        const cashEntry = journal.journalEntries.find(
          (je) => je.accountId === cashAccount.accountId && je.debit.gt(0)
        );
        cashRefund = cashEntry ? new Decimal(cashEntry.debit) : new Decimal(0);
      }

      // reverse payable dgn nilai dari jouornal
      if (
        (paymentType === PaymentType.CREDIT ||
          paymentType === PaymentType.MIXED) &&
        payable &&
        reduceFromPayable.gt(0)
      ) {
        const currentPaid = new Decimal(payable.paidAmount);
        const currentRemaining = new Decimal(payable.remainingAmount);

        if (reduceFromPayable.gt(currentPaid)) {
          throw new ResponseError(
            400,
            'Cannot reverse: return amount exceeds paid amount'
          );
        }

        const newPaidAmount = currentPaid.minus(reduceFromPayable);
        const newRemaining = currentRemaining.plus(reduceFromPayable);

        const totalAmount = new Decimal(payable.amount);
        const newStatus = newRemaining.lte(0)
          ? PaymentStatus.PAID
          : newRemaining.gte(totalAmount)
            ? PaymentStatus.UNPAID
            : PaymentStatus.PARTIAL;

        await payableRepository.recordPayablePayment(
          {
            payableId: payable.payableId,
            paidAmount: newPaidAmount,
            remainingAmount: newRemaining,
            status: newStatus,
          },
          prismaTransaction
        );
      }

      //  reverse saldo account default
      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccount.accountCode,
          balance: inventoryAccount.balance.plus(subtotal),
        },
        prismaTransaction
      );

      if (vat.gt(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: vatInputAccount.accountCode,
            balance: vatInputAccount.balance.plus(vat),
          },
          prismaTransaction
        );
      }

      if (reduceFromPayable.gt(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: payableAccount.accountCode,
            balance: payableAccount.balance.plus(reduceFromPayable),
          },
          prismaTransaction
        );
      }

      if (cashRefund.gt(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.minus(cashRefund),
          },
          prismaTransaction
        );
      }

      // hapus payable
      if (payable?.payments?.length) {
        const returnPayments = payable.payments.filter(
          (p) =>
            p.method === PaymentMethod.RETURN &&
            p.journalEntry?.journalId === journalId
        );

        if (returnPayments.length > 0) {
          await payablePaymentRepository.deletePaymentsByIds(
            returnPayments.map((p) => p.paymentId),
            prismaTransaction
          );
        }
      }

      // hapus detail purchase return
      await purchaseReturnDetailRepository.deleteByReturnId(
        returnId,
        prismaTransaction
      );

      // hapus journal entries
      await journalEntryRepository.deleteByJournalId(
        journalId,
        prismaTransaction
      );

      // hapus journal
      await journalRepository.deleteJournal(journalId, prismaTransaction);
    });
  }
}

export const purchaseReturnService = new PurchaseReturnService();
