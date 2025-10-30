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
import { PaymentStatus, PaymentType, ReturnStatus } from '@prisma/client';
import { ResponseError } from '../entities/responseError';
import { Decimal } from '@prisma/client/runtime/library';
import { recalculateCOGS } from '../utils/cogs';
import { purchaseReturnRepository } from '../repository/purchaseReturnRepository';
import { purchaseReturnDetailRepository } from '../repository/purchaseReturnDetailRepository';

export class PurchaseReturnService {
  async createPurchaseReturn({
    body,
  }: {
    body: PurchaseReturnRequest;
  }): Promise<any> {
    const req = validate(purchaseReturnSchema, body);
    const { purchaseId, returnDate, reason, items } = req;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil account default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const { inventoryAccount, vatInputAccount, payableAccount, cashAccount } =
        accountDefault;

      // Ambil purchase dan relasinya
      const purchase = await purchaseService.getPurchase(
        purchaseId,
        prismaTransaction
      );
      const { supplier, payable, purchaseDetails, paymentType, invoiceNumber } =
        purchase;

      // Validasi supplier
      await supplierService.getSupplierTransaction(
        supplier.supplierId,
        prismaTransaction
      );

      // Ambil VAT rate aktif SAAT PEMBELIAN
      const vatSetting = await vatSettingRepository.getActiveVatSetting(
        purchase.date,
        prismaTransaction
      );
      if (!vatSetting) {
        throw new ResponseError(400, 'VAT setting not found for purchase date');
      }
      const vatRate = new Decimal(vatSetting.vatRate);

      // mbil inventory method
      const { inventoryMethod } =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // Hitung subtotal, VAT, total + update stok
      let subtotal = new Decimal(0);
      const returnDetailsData: PurchaseReturnDetailForm[] = [];

      for (const item of items) {
        const detail = purchaseDetails.find(
          (d) => d.productId === item.productId
        );
        if (!detail) {
          throw new ResponseError(
            400,
            `Product ${item.productId} not found in purchase`
          );
        }

        const batch = detail.inventoryBatch;
        if (!batch) {
          throw new ResponseError(
            500,
            `Batch not found for purchase detail ${detail.purchaseDetailId}`
          );
        }

        // VALIDASI: Hanya boleh return dari sisa stok di batch
        const returnedBefore = detail.purchaseReturnDetails.reduce(
          (s, r) => s + r.qtyReturned,
          0
        );

        const returnableQty = batch.remainingStock; // Hanya dari stok yang tersisa

        if (item.quantity > returnableQty) {
          throw new ResponseError(
            400,
            `Cannot return ${item.quantity} unit(s) of "${detail.product.productName}".\n` +
              `• Purchased: ${detail.quantity}\n` +
              `• In batch: ${batch.quantity}\n` +
              `• Remaining stock: ${batch.remainingStock}\n` +
              `• Already returned: ${returnedBefore}\n` +
              `• Available to return: ${returnableQty}`
          );
        }

        // hitung nilai yg di return
        const returnValue = new Decimal(item.quantity).mul(detail.unitPrice);
        const vatAmount = returnValue.mul(vatRate).div(100);
        const totalWithVat = returnValue.plus(vatAmount);

        subtotal = subtotal.plus(returnValue);

        returnDetailsData.push({
          purchaseDetailId: detail.purchaseDetailId,
          batchId: batch.batchId,
          productId: item.productId,
          qtyReturned: item.quantity,
          unitPrice: detail.unitPrice,
          returnValue,
          vatAmount,
          totalWithVat,
        });

        // kurangi stok (barang keluar ke supplier)
        const actualReturnQty = item.quantity;

        await inventoryBatchRepository.decrementBatchStock(
          batch.batchId,
          actualReturnQty,
          prismaTransaction
        );

        await productRepository.decrementStock(
          item.productId,
          actualReturnQty,
          prismaTransaction
        );

        // Recalculate COGS & update harga jual
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
            status: 'PROCESSED',
            journalId: journal.journalId,
          },
          prismaTransaction
        );

      // buat purchase return detail
      await purchaseReturnDetailRepository.createManyPurchaseReturnDetails(
        purchaseReturn.returnId,
        returnDetailsData,
        prismaTransaction
      );

      // buat journal entries
      const journalEntries: JournalEntryForm[] = [];

      // Kredit Inventory (barang keluar)
      journalEntries.push({
        journalId: journal.journalId,
        accountId: inventoryAccount.accountId,
        debit: new Decimal(0),
        credit: subtotal,
      });

      // Kredit VAT Input
      if (vat.gt(0)) {
        journalEntries.push({
          journalId: journal.journalId,
          accountId: vatInputAccount.accountId,
          debit: new Decimal(0),
          credit: vat,
        });
      }

      // Debit Payable / Cash (pengurangan oetang/uang)
      let reduceFromPayable = new Decimal(0);
      let reduceFromCash = new Decimal(0);

      switch (paymentType) {
        case 'CASH':
          reduceFromCash = total;
          journalEntries.push({
            journalId: journal.journalId,
            accountId: cashAccount.accountId,
            debit: total,
            credit: new Decimal(0),
          });
          break;

        case 'CREDIT':
          if (!payable)
            throw new ResponseError(
              404,
              'Payable not found for CREDIT purchase'
            );
          reduceFromPayable = total;
          journalEntries.push({
            journalId: journal.journalId,
            accountId: payableAccount.accountId,
            debit: total,
            credit: new Decimal(0),
          });
          break;

        case 'MIXED':
          if (!payable)
            throw new ResponseError(
              404,
              'Payable not found for MIXED purchase'
            );
          reduceFromPayable = Decimal.min(payable.remainingAmount, total);
          reduceFromCash = total.minus(reduceFromPayable);

          if (reduceFromPayable.gt(0)) {
            journalEntries.push({
              journalId: journal.journalId,
              accountId: payableAccount.accountId,
              debit: reduceFromPayable,
              credit: new Decimal(0),
            });
          }
          if (reduceFromCash.gt(0)) {
            journalEntries.push({
              journalId: journal.journalId,
              accountId: cashAccount.accountId,
              debit: reduceFromCash,
              credit: new Decimal(0),
            });
          }
          break;

        default:
          throw new ResponseError(
            400,
            `Unsupported paymentType: ${paymentType}`
          );
      }

      await journalEntryRepository.createManyJournalEntries(
        journalEntries,
        prismaTransaction
      );

      // update payable
      if ((paymentType === 'CREDIT' || paymentType === 'MIXED') && payable) {
        const newRemaining = new Decimal(payable.remainingAmount).minus(
          reduceFromPayable
        );
        const status = newRemaining.lte(0)
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL;

        await payableRepository.applyPurchaseReturnToPayable(
          {
            payableId: payable.payableId,
            reduceFromPayable: reduceFromPayable.toNumber(),
            remainingAmount: Math.max(0, newRemaining.toNumber()),
            status,
          },
          prismaTransaction
        );
      }

      // update saldo account
      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccount.accountCode,
          balance: inventoryAccount.balance.minus(subtotal),
        },
        prismaTransaction
      );

      if (vat.gt(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: vatInputAccount.accountCode,
            balance: vatInputAccount.balance.minus(vat),
          },
          prismaTransaction
        );
      }

      if (reduceFromPayable.gt(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: payableAccount.accountCode,
            balance: payableAccount.balance.minus(reduceFromPayable),
          },
          prismaTransaction
        );
      }

      if (reduceFromCash.gt(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.plus(reduceFromCash),
          },
          prismaTransaction
        );
      }

      return purchaseReturn;
    });
  }

  async deletePurchaseReturn(returnId: string): Promise<void> {
    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil PurchaseReturn LENGKAP
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
        total,
        journalId,
        status,
        returnDetails: purchaseReturnDetails,
        purchase,
      } = purchaseReturn;

      if (status !== ReturnStatus.PROCESSED) {
        throw new ResponseError(400, 'Only PROCESSED returns can be deleted');
      }

      const { paymentType, payable } = purchase;

      // Ambil account default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const { inventoryAccount, vatInputAccount, payableAccount, cashAccount } =
        accountDefault;

      // Ambil inventory method
      const { inventoryMethod } =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // reverse stok dan harga
      for (const detail of purchaseReturnDetails) {
        const { batchId, productId, qtyReturned } = detail;

        await inventoryBatchRepository.incrementBatchStock(
          batchId,
          qtyReturned,
          prismaTransaction
        );
        await productRepository.incrementStock(
          productId,
          qtyReturned,
          prismaTransaction
        );

        const cogs = await recalculateCOGS(
          productId,
          inventoryMethod,
          prismaTransaction
        );
        await productRepository.updateProductPriceById(
          {
            productId,
            avgPurchasePrice: cogs,
            sellingPrice: cogs.add(detail.product.profitMargin || 0),
          },
          prismaTransaction
        );
      }

      // reverese payable / cash
      let reduceFromPayable = new Decimal(0);
      let reduceFromCash = new Decimal(0);

      switch (paymentType) {
        case PaymentType.CASH:
          reduceFromCash = total;
          break;

        case PaymentType.CREDIT:
          if (!payable) throw new ResponseError(404, 'Payable not found');
          reduceFromPayable = total;
          break;

        case PaymentType.MIXED:
          if (!payable) throw new ResponseError(404, 'Payable not found');
          reduceFromPayable = Decimal.min(payable.remainingAmount, total);
          reduceFromCash = total.minus(reduceFromPayable);
          break;
      }

      if (
        (paymentType === PaymentType.CREDIT ||
          paymentType === PaymentType.MIXED) &&
        payable
      ) {
        const amount = new Decimal(payable.amount);
        const currentRemaining = new Decimal(payable.remainingAmount);
        const reverseAmount = reduceFromPayable;

        const newRemaining = currentRemaining.plus(reverseAmount);
        const newPaidAmount = amount.minus(newRemaining);

        if (newPaidAmount.lt(0)) {
          throw new ResponseError(
            400,
            'Cannot reverse: paid amount would be negative'
          );
        }

        const newStatus = newRemaining.lte(0)
          ? PaymentStatus.PAID
          : newRemaining.gte(amount)
            ? PaymentStatus.UNPAID
            : PaymentStatus.PARTIAL;

        await payableRepository.recordPayablePayment(
          {
            payableId: payable.payableId,
            remainingAmount: newRemaining,
            paidAmount: newPaidAmount,
            status: newStatus,
          },
          prismaTransaction
        );
      }

      // reverse saldo account
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

      if (reduceFromCash.gt(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.minus(reduceFromCash),
          },
          prismaTransaction
        );
      }

      // Hapus Detail purchase return
      await purchaseReturnDetailRepository.deleteByReturnId(
        returnId,
        prismaTransaction
      );

      // Hapus Journal Entries
      await journalEntryRepository.deleteByJournalId(
        journalId,
        prismaTransaction
      );

      // Hapus Journal
      await prismaTransaction.journal.delete({ where: { journalId } });
    });
  }
}

export const purchaseReturnService = new PurchaseReturnService();
