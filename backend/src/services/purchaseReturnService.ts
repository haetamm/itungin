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
import { PaymentStatus } from '@prisma/client';
import { ResponseError } from '../entities/responseError';
import { Decimal } from '@prisma/client/runtime/library';
import { recalculateCOGS } from '../utils/cogs';
import { purchaseReturnRepository } from '../repository/purchaseReturnRepository';
import { purchaseReturnDetailRepository } from '../repository/purchaseReturnDetailRepository copy';

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

      // Ambil purchase LENGKAP
      const purchase = await purchaseService.getPurchase(
        purchaseId,
        prismaTransaction
      );
      const { supplier, payable, purchaseDetails, paymentType } = purchase;

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
      if (!vatSetting)
        throw new ResponseError(400, 'VAT setting not found for purchase date');
      const vatRate = new Decimal(vatSetting.vatRate);

      // Ambil inventory method
      const { inventoryMethod } =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // Hitung subtotal, VAT, total + update stok & harga
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

        // Validasi: tidak boleh return lebih dari qty dibeli
        const returnedBefore = detail.purchaseReturnDetails.reduce(
          (s, r) => s + r.qtyReturned,
          0
        );
        const totalReturned = returnedBefore + item.quantity;
        if (totalReturned > detail.quantity) {
          throw new ResponseError(
            400,
            `Cannot return more than purchased: ${totalReturned} > ${detail.quantity} for ${detail.product.productName}`
          );
        }

        const batch = detail.inventoryBatch;
        if (!batch) {
          throw new ResponseError(
            500,
            `Batch not found for purchase detail ${detail.purchaseDetailId}`
          );
        }

        // Hitung nilai return
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

        // UPDATE STOK & HARGA hanya jika ada stock
        if (batch.remainingStock >= item.quantity) {
          const returnableQty = item.quantity;

          await inventoryBatchRepository.decrementBatchStock(
            batch.batchId,
            returnableQty,
            prismaTransaction
          );

          await productRepository.decrementStock(
            item.productId,
            returnableQty,
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
      }

      const vat = subtotal.mul(vatRate).div(100);
      const total = subtotal.plus(vat);

      // Buat Journal
      const journal = await journalRepository.createJournal(
        {
          date: new Date(returnDate),
          description: `Retur Pembelian #${purchase.invoiceNumber}`,
          reference: purchase.invoiceNumber,
        },
        prismaTransaction
      );

      // Buat PurchaseReturn
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

      // Buat detail
      await purchaseReturnDetailRepository.createManyPurchaseReturnDetails(
        purchaseReturn.returnId,
        returnDetailsData,
        prismaTransaction
      );

      // Journal Entries & Account Updates berdasarkan paymentType
      const journalEntries: JournalEntryForm[] = [
        {
          journalId: journal.journalId,
          accountId: inventoryAccount.accountId,
          debit: new Decimal(0),
          credit: subtotal,
        },
      ];

      if (vat.gt(0)) {
        journalEntries.push({
          journalId: journal.journalId,
          accountId: vatInputAccount.accountId,
          debit: new Decimal(0),
          credit: vat,
        });
      }

      // create journal entris berdasarkan pyamentType
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
            404,
            `Unsupported paymentType: ${paymentType}`
          );
      }

      await journalEntryRepository.createManyJournalEntries(
        journalEntries,
        prismaTransaction
      );

      // 10. Update Payable (hanya jika CREDIT atau MIXED)
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

      // 11. Update Account Balances
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
}

export const purchaseReturnService = new PurchaseReturnService();
