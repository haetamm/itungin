import { SaleDetailForm, UpdateSaleDetail } from '../utils/interface';
import { validate } from '../validation/validation';
import { ResponseError } from '../entities/responseError';
import { Prisma, Sale, SaleDetail } from '@prisma/client';
import { purchaseRepository } from '../repository/purchaseRepository';
import { inventoryBatchRepository } from '../repository/inventoryBatchRepository';
import { journalEntryRepository } from '../repository/journalEntryRepository';
import { productRepository } from '../repository/productRepository';
import { saleDetailRepository } from '../repository/saleDetailRepository';
import { prismaClient } from '../application/database';
import { Decimal } from '@prisma/client/runtime/library';
import { updateSaleDetailSchema } from '../validation/saleDetailValidation';
import { saleRepository } from '../repository/saleRepository';
import { receivableRepository } from '../repository/receivableRepository';
import { accountRepository } from '../repository/accountRepository';
import { journalRepository } from '../repository/journalRepository';
import { generalsettingService } from './generalSettingService';
import { accountService } from './accountService';
import { saleService } from './saleService';
import { vatService } from './vatService';
import { productService } from './productService';

export class SaleDetailService {
  private async checkSubsequentPurchases(
    saleDetails: SaleDetail[],
    saleDate: Date,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    for (const detail of saleDetails) {
      const subsequentPurchases =
        await purchaseRepository.findSubsequentPurchases(
          detail.productId,
          saleDate,
          prismaTransaction
        );
      if (subsequentPurchases.length > 0) {
        throw new ResponseError(
          400,
          `Cannot update this sale because a later purchase already exists for product ${detail.productId}.`
        );
      }
    }
  }

  async updateSaleDetailBySaleId({
    body,
  }: {
    body: UpdateSaleDetail;
  }): Promise<Sale> {
    const saleDetailReq = validate(updateSaleDetailSchema, body);
    const { saleId, vatRateId, items } = saleDetailReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil inventory method
      const setting =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // Ambil akun default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const {
        inventoryAccount,
        vatOutputAccount,
        cashAccount,
        receivableAccount,
        costOfGoodsSoldAccount,
        salesAccount,
      } = accountDefault;

      // Ambil data penjualan lama
      const existingSale = await saleService.getSale(saleId, prismaTransaction);
      if (!existingSale) {
        throw new ResponseError(404, `Sale with ID ${saleId} not found`);
      }
      const {
        journal,
        receivable,
        saleDetails,
        date,
        paymentType,
        invoiceNumber,
      } = existingSale;

      // Validasi tarif VAT
      const vatSetting = await vatService.getVatSetting(
        vatRateId,
        prismaTransaction,
        date
      );

      // Validasi Receivable
      await saleService.validateReceivableForModification(
        paymentType,
        receivable,
        prismaTransaction,
        'update'
      );

      // Cek pembelian setelah transaksi ini
      await this.checkSubsequentPurchases(saleDetails, date, prismaTransaction);

      // Kembalikan stok lama dan batalkan efek batch lama
      for (const detail of saleDetails) {
        const product = await productService.getProduct(
          detail.productId,
          prismaTransaction
        );
        if (!product) {
          throw new ResponseError(
            404,
            `Product with ID ${detail.productId} not found`
          );
        }

        await productRepository.incrementStock(
          detail.productId,
          detail.quantity,
          prismaTransaction
        );

        await inventoryBatchRepository.incrementBatchStock(
          detail.batchId,
          detail.quantity,
          prismaTransaction
        );

        const batch = await inventoryBatchRepository.findById(
          detail.batchId,
          prismaTransaction
        );
        if (!batch) {
          throw new ResponseError(
            404,
            `Inventory batch ${detail.batchId} not found`
          );
        }
      }

      // Reverse efek akun lama berdasarkan journal entries
      for (const entry of journal.journalEntries) {
        const account = await accountRepository.findById(
          entry.accountId,
          prismaTransaction
        );
        if (!account) {
          throw new ResponseError(
            404,
            `Account with ID ${entry.accountId} not found`
          );
        }

        let balanceAdjustment = new Decimal(0);
        if (account.normalBalance === 'DEBIT') {
          balanceAdjustment = new Decimal(0)
            .minus(entry.debit)
            .plus(entry.credit);
        } else if (account.normalBalance === 'CREDIT') {
          balanceAdjustment = new Decimal(0)
            .plus(entry.debit)
            .minus(entry.credit);
        }
        const currentBalance = account.balance ?? new Decimal(0);
        const newBalance = currentBalance.plus(balanceAdjustment);

        await accountRepository.updateAccountTransaction(
          { accountCode: account.accountCode, balance: newBalance },
          prismaTransaction
        );
      }

      // Hitung ulang subtotal, COGS, VAT, dan total baru
      let subtotal = new Decimal(0);
      let cogs = new Decimal(0);
      const saleDetailsData: SaleDetailForm[] = [];

      for (const item of items) {
        const product = await productService.getProduct(
          item.productId,
          prismaTransaction
        );
        if (!product) {
          throw new ResponseError(
            404,
            `Product with ID ${item.productId} not found`
          );
        }

        if (product.stock < item.quantity) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${product.productName}, only ${product.stock} available`
          );
        }

        const unitPrice = new Decimal(product.sellingPrice);
        const batches = await inventoryBatchRepository.findBatchesForProduct(
          item.productId,
          setting.inventoryMethod,
          prismaTransaction
        );

        await saleService.validateBatchDates(
          batches,
          new Date(date),
          item.productId
        );

        let remaining = item.quantity;
        let itemCogs = new Decimal(0);
        const batchAssignments: {
          batchId: string;
          quantity: number;
          purchasePrice: Decimal;
        }[] = [];

        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduct = Math.min(batch.remainingStock, remaining);
          await inventoryBatchRepository.decrementBatchStock(
            batch.batchId,
            deduct,
            prismaTransaction
          );
          itemCogs = itemCogs.plus(
            new Decimal(deduct).times(batch.purchasePrice)
          );
          remaining -= deduct;
          batchAssignments.push({
            batchId: batch.batchId,
            quantity: deduct,
            purchasePrice: new Decimal(batch.purchasePrice),
          });
        }

        if (remaining > 0) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${product.productName}`
          );
        }

        await productRepository.decrementStock(
          item.productId,
          item.quantity,
          prismaTransaction
        );

        const itemSubtotal = new Decimal(item.quantity).times(unitPrice);
        subtotal = subtotal.plus(itemSubtotal);
        cogs = cogs.plus(itemCogs);

        batchAssignments.forEach((assignment) => {
          saleDetailsData.push({
            saleId,
            productId: item.productId,
            batchId: assignment.batchId,
            quantity: assignment.quantity,
            unitPrice,
            subtotal: new Decimal(assignment.quantity).times(unitPrice),
          });
        });
      }

      const vat = subtotal
        .times(vatSetting.vatRate)
        .div(100)
        .toDecimalPlaces(2);
      const total = subtotal.plus(vat);

      // Update nilai total penjualan
      const updatedSale = await saleRepository.updateSaleTotals(
        saleId,
        { subtotal, vat, total },
        prismaTransaction
      );

      // Hapus sale_details lama dan buat baru
      await saleDetailRepository.deleteBySaleId(saleId, prismaTransaction);

      for (const detail of saleDetailsData) {
        await saleDetailRepository.createSaleDetail(detail, prismaTransaction);
      }

      // Hapus Receivable & Journal Entry lama
      if (receivable) {
        await receivableRepository.deleteByJournalEntryId(
          journal.journalId,
          prismaTransaction
        );
      }

      await journalEntryRepository.deleteByJournalId(
        journal.journalId,
        prismaTransaction
      );

      // Update Journal description
      await journalRepository.updateJournalTransaction(
        {
          journalId: journal.journalId,
          date: new Date(date),
          description: `Penjualan ${paymentType.toLowerCase()} ${invoiceNumber} (diperbarui ${new Date().toISOString().split('T')[0]})`,
          reference: invoiceNumber,
        },
        prismaTransaction
      );

      // Buat Journal Entry baru
      const journalEntries = [
        {
          accountId: salesAccount.accountId,
          debit: new Decimal(0),
          credit: subtotal,
        },
        {
          accountId: vatOutputAccount.accountId,
          debit: new Decimal(0),
          credit: vat,
        },
        {
          accountId: costOfGoodsSoldAccount.accountId,
          debit: cogs,
          credit: new Decimal(0),
        },
        {
          accountId: inventoryAccount.accountId,
          debit: new Decimal(0),
          credit: cogs,
        },
        {
          accountId: cashAccount.accountId,
          debit: total,
          credit: new Decimal(0),
        },
      ];

      for (const je of journalEntries) {
        await journalEntryRepository.createJournalEntries(
          {
            journalId: journal.journalId,
            accountId: je.accountId,
            debit: je.debit,
            credit: je.credit,
          },
          prismaTransaction
        );
      }

      // Update saldo akun dengan nilai setelah reversal
      const accountUpdates = [
        {
          accountCode: inventoryAccount.accountCode,
          balance: new Decimal(1726000).minus(cogs),
        },
        {
          accountCode: costOfGoodsSoldAccount.accountCode,
          balance: new Decimal(0).plus(cogs),
        },
        {
          accountCode: salesAccount.accountCode,
          balance: new Decimal(0).plus(subtotal),
        },
        {
          accountCode: vatOutputAccount.accountCode,
          balance: new Decimal(0).plus(vat),
        },
        {
          accountCode: cashAccount.accountCode,
          balance: new Decimal(98101400).plus(total),
        },
      ];

      for (const update of accountUpdates) {
        await accountRepository.updateAccountTransaction(
          update,
          prismaTransaction
        );
      }

      // Validasi saldo piutang akhir
      const totalReceivable =
        await receivableRepository.getTotalReceivables(prismaTransaction);
      const expectedBalance = new Decimal(totalReceivable || 0);
      if (!receivableAccount.balance.equals(expectedBalance)) {
        throw new ResponseError(
          400,
          `Receivable account balance mismatch. Expected ${expectedBalance.toString()}, but got ${receivableAccount.balance.toString()}`
        );
      }

      return updatedSale;
    });
  }
}

export const saleDetailService = new SaleDetailService();
