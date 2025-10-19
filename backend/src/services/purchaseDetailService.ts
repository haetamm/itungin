import { updatePurchaseDetailSchema } from '../validation/purchaseDetailValidation';
import { UpdatePurchaseDetail } from '../utils/interface';
import { validate } from '../validation/validation';
import { ResponseError } from '../entities/responseError';
import { PaymentStatus, PaymentType, Prisma, Purchase } from '@prisma/client';
import { purchaseRepository } from '../repository/purchaseRepository';
import { purchaseDetailRepository } from '../repository/purchaseDetailRepository';
import { inventoryBatchRepository } from '../repository/inventoryBatchRepository';
import { journalEntryRepository } from '../repository/journalEntryRepository';
import { accountDefaultRepository } from '../repository/accountDefaultRepository';
import { productRepository } from '../repository/productRepository';
import { saleDetailRepository } from '../repository/saleDetailRepository';
import { vatSettingRepository } from '../repository/vatSettingRepository';
import { accountRepository } from '../repository/accountRepository';
import { prismaClient } from '../application/database';
import { Decimal } from '@prisma/client/runtime/library';
import { payableRepository } from '../repository/paybleRepository';
import { recalculateCOGS } from '../utils/cogs';
import { generalSettingRepository } from '../repository/generalSettingRepository';
import { paymentRepository } from '../repository/paymentRepository';

export class PurchaseDetailService {
  private async getSettingInventory(
    prismaTransaction: Prisma.TransactionClient
  ) {
    const settings =
      await generalSettingRepository.getSettingTransaction(prismaTransaction);
    if (!settings)
      throw new ResponseError(404, 'Inventory method not configured');
    return settings;
  }

  private async getAccountDefault(prismaTransaction: Prisma.TransactionClient) {
    const accountDefault =
      await accountDefaultRepository.findOne(prismaTransaction);
    if (!accountDefault)
      throw new ResponseError(404, 'Default account not configured');
    return accountDefault;
  }

  private async getPurchase(
    purchaseId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const purchase = await purchaseRepository.findPurchaseByIdTransaction(
      purchaseId,
      prismaTransaction
    );
    if (!purchase) throw new ResponseError(404, 'Purchase not found');
    return purchase;
  }

  private async getVatSetting(
    id: string,
    prismaTransaction: Prisma.TransactionClient,
    date: Date
  ) {
    const vatSetting = await vatSettingRepository.findVatTransaction(
      id,
      prismaTransaction
    );
    if (!vatSetting) throw new ResponseError(404, 'VAT rate not found');
    if (vatSetting.effectiveDate > new Date(date))
      throw new ResponseError(400, 'VAT rate is not yet effective');
    return vatSetting;
  }

  async updatePurchaseDetailByPurchaseId({
    body,
  }: {
    body: UpdatePurchaseDetail;
  }): Promise<Purchase> {
    const purchaseReq = validate(updatePurchaseDetailSchema, body);
    const { purchaseId, vatRateId, items } = purchaseReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Validasi pengaturan inventory method
      const setting = await this.getSettingInventory(prismaTransaction);

      // Validasi akun default
      const accountDefault = await this.getAccountDefault(prismaTransaction);

      let { inventoryAccount, vatInputAccount, cashAccount, payableAccount } =
        accountDefault;

      // Ambil data pembelian existing
      const existingPurchase = await this.getPurchase(
        purchaseId,
        prismaTransaction
      );

      const { journal, payable, purchaseDetails } = existingPurchase;
      const paymentType = existingPurchase.paymentType;

      // Validasi VAT rate
      const vatSetting = await this.getVatSetting(
        vatRateId,
        prismaTransaction,
        new Date(existingPurchase.date)
      );

      // Validasi produk terhadap penjualan
      for (const detail of purchaseDetails) {
        const inventoryBatches =
          await inventoryBatchRepository.findBatchesByPurchaseDetail(
            detail.purchaseDetailId,
            prismaTransaction
          );

        for (const batch of inventoryBatches) {
          const saleDetailCount = await saleDetailRepository.countByBatchId(
            batch.batchId,
            prismaTransaction
          );

          if (saleDetailCount > 0) {
            throw new ResponseError(
              400,
              `Cannot update purchase because inventory batch (ID: ${batch.batchId}) has been used in sales. Please process a purchase return.`
            );
          }
        }
      }

      if (
        paymentType === PaymentType.CREDIT ||
        paymentType === PaymentType.MIXED
      ) {
        if (payable) {
          // Periksa apakah ada Payment terkait payable
          const payments = await paymentRepository.getPaymentByPayableId(
            payable.payableId,
            prismaTransaction
          );

          if (payments.length > 0) {
            throw new ResponseError(
              400,
              `Cannot update purchase with associated payments for payable ${payable.payableId}.  Please process a purchase return instead`
            );
          }

          if (payable.status === PaymentStatus.PAID) {
            throw new ResponseError(
              400,
              `Cannot update purchase with paid payable ${payable.payableId}.  Please process a purchase return instead`
            );
          }
        }
      }

      // Hitung ulang subtotal, VAT, dan total
      const subtotal = items.reduce(
        (sum, item) =>
          sum.plus(new Decimal(item.quantity).times(item.unitPrice)),
        new Decimal(0)
      );
      const vat = subtotal.times(vatSetting.vatRate).div(100);
      const total = subtotal.plus(vat);

      // Batalkan efek akun lama
      const oldSubtotal = existingPurchase.subtotal;
      const oldVat = existingPurchase.vat;
      const oldTotal = existingPurchase.total;

      // Batalkan saldo akun inventory
      const updatedInventoryAccount =
        await accountRepository.updateAccountTransaction(
          {
            accountCode: inventoryAccount.accountCode,
            balance: inventoryAccount.balance.minus(oldSubtotal),
          },
          prismaTransaction
        );

      inventoryAccount = {
        ...inventoryAccount,
        balance: updatedInventoryAccount.balance,
      };

      // Batalkan saldo akun VAT input
      const updatedVatInputAccount =
        await accountRepository.updateAccountTransaction(
          {
            accountCode: vatInputAccount.accountCode,
            balance: vatInputAccount.balance.minus(oldVat),
          },
          prismaTransaction
        );

      vatInputAccount = {
        ...vatInputAccount,
        balance: updatedVatInputAccount.balance,
      };

      if (paymentType === PaymentType.CASH) {
        // Batalkan saldo akun kas
        const updatedCashAccount =
          await accountRepository.updateAccountTransaction(
            {
              accountCode: cashAccount.accountCode,
              balance: cashAccount.balance.plus(oldTotal),
            },
            prismaTransaction
          );

        cashAccount = { ...cashAccount, balance: updatedCashAccount.balance };
      } else if (paymentType === PaymentType.CREDIT) {
        // Batalkan saldo akun utang
        const updatedPayableAccount =
          await accountRepository.updateAccountTransaction(
            {
              accountCode: payableAccount.accountCode,
              balance: payableAccount.balance.minus(oldTotal),
            },
            prismaTransaction
          );

        payableAccount = {
          ...payableAccount,
          balance: updatedPayableAccount.balance,
        };
      } else if (paymentType === PaymentType.MIXED) {
        const cashEntry = journal.journalEntries.find(
          (e) => e.accountId === cashAccount.accountId
        );

        if (!cashEntry) {
          throw new ResponseError(
            400,
            'Cash journal entry not found for MIXED payment'
          );
        }

        const oldCashAmount = new Decimal(cashEntry.credit || 0);
        const oldPayableAmount = oldTotal.minus(oldCashAmount);

        // Batalkan saldo akun kas
        const updatedCashAccount =
          await accountRepository.updateAccountTransaction(
            {
              accountCode: cashAccount.accountCode,
              balance: cashAccount.balance.plus(oldCashAmount),
            },
            prismaTransaction
          );

        cashAccount = { ...cashAccount, balance: updatedCashAccount.balance };

        // Batalkan saldo akun utang
        const updatedPayableAccount =
          await accountRepository.updateAccountTransaction(
            {
              accountCode: payableAccount.accountCode,
              balance: payableAccount.balance.minus(oldPayableAmount),
            },
            prismaTransaction
          );

        payableAccount = {
          ...payableAccount,
          balance: updatedPayableAccount.balance,
        };
      }

      // Update tabel purchases
      const updatedPurchase = await purchaseRepository.updatePurchaseTotals(
        purchaseId,
        { subtotal, vat, total },
        prismaTransaction
      );

      // Sinkronisasi purchase_details dan inventory_batches
      const existingDetailsMap = new Map(
        purchaseDetails.map((d) => [d.productId, d])
      );
      const newItemsMap = new Map(items.map((i) => [i.productId, i]));

      // Hapus detail yang sudah tidak ada di request
      for (const [productId, oldDetail] of existingDetailsMap.entries()) {
        if (!newItemsMap.has(productId)) {
          const product = await productRepository.findProductTransaction(
            productId,
            prismaTransaction
          );
          if (!product) continue;

          // Kurangi stok lama
          const newStock = new Decimal(product.stock).minus(oldDetail.quantity);
          const cogs = await recalculateCOGS(
            productId,
            setting.inventoryMethod,
            prismaTransaction
          );

          const sellingPrice =
            newStock.lessThanOrEqualTo(0) || cogs.equals(0)
              ? new Decimal(0)
              : cogs.add(product.profitMargin);

          await productRepository.updateProductTransaction(
            {
              productId,
              stock: Number(newStock.lessThan(0) ? 0 : newStock),
              avgPurchasePrice: newStock.lessThanOrEqualTo(0)
                ? new Decimal(0)
                : product.avgPurchasePrice,
              profitMargin: newStock.lessThanOrEqualTo(0)
                ? new Decimal(0)
                : product.profitMargin,
              sellingPrice,
            },
            prismaTransaction
          );

          await inventoryBatchRepository.deleteBatchByPurchaseDetail(
            oldDetail.purchaseDetailId,
            prismaTransaction
          );

          await purchaseDetailRepository.deletePurchaseDetailById(
            oldDetail.purchaseDetailId,
            prismaTransaction
          );
        }
      }

      // Tambah/update detail baru
      for (const item of items) {
        const existingDetail = existingDetailsMap.get(item.productId);
        const product = await productRepository.findProductTransaction(
          item.productId,
          prismaTransaction
        );
        if (!product) {
          throw new ResponseError(404, `Product ${item.productId} not found`);
        }

        const subtotal = new Decimal(item.quantity).times(item.unitPrice);
        const profitMargin = new Decimal(item.profitMargin);

        if (existingDetail) {
          await purchaseDetailRepository.updatePurchaseDetailById(
            existingDetail.purchaseDetailId,
            {
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
            },
            prismaTransaction
          );

          await inventoryBatchRepository.updateBatchByPurchaseDetailId(
            {
              purchaseDetailId: existingDetail.purchaseDetailId,
              productId: item.productId,
              purchaseDate: existingPurchase.date,
              quantity: item.quantity,
              purchasePrice: item.unitPrice,
              remainingStock: item.quantity,
            },
            prismaTransaction
          );
        } else {
          const newDetail = await purchaseDetailRepository.createPurchaseDetail(
            {
              purchaseId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
            },
            prismaTransaction
          );

          await inventoryBatchRepository.createInventoryBatch(
            {
              productId: item.productId,
              purchaseDate: existingPurchase.date,
              quantity: item.quantity,
              purchasePrice: item.unitPrice,
              remainingStock: item.quantity,
              purchaseDetailId: newDetail.purchaseDetailId,
            },
            prismaTransaction
          );
        }

        // Update stok & harga produk dengan reset stok lama ---
        let currentStock = new Decimal(product.stock);
        if (existingDetail) {
          currentStock = currentStock.minus(existingDetail.quantity);
        }
        const newStock = currentStock.plus(item.quantity);

        const currentAvgPrice = product.avgPurchasePrice;
        let newAvgPrice: Decimal;

        if (newStock.equals(0)) {
          newAvgPrice = new Decimal(0);
        } else {
          const oldValue = currentAvgPrice.times(currentStock);
          const newValue = new Decimal(item.unitPrice).times(item.quantity);
          newAvgPrice = oldValue.plus(newValue).div(newStock);
        }

        // Update product with new stock and price
        const cogs = await recalculateCOGS(
          product.productId,
          setting.inventoryMethod,
          prismaTransaction
        );
        const sellingPrice = cogs.add(profitMargin);

        await productRepository.updateProductTransaction(
          {
            productId: item.productId,
            stock: Number(newStock),
            avgPurchasePrice: newAvgPrice,
            profitMargin,
            sellingPrice,
          },
          prismaTransaction
        );
      }

      // Update journal entries
      const journalEntries = journal.journalEntries;
      const inventoryEntry = journalEntries.find(
        (e) => e.accountId === inventoryAccount.accountId
      );
      const vatEntry = journalEntries.find(
        (e) => e.accountId === vatInputAccount.accountId
      );
      const cashEntry = journalEntries.find(
        (e) => e.accountId === cashAccount.accountId
      );
      const payableEntry = journalEntries.find(
        (e) => e.accountId === payableAccount.accountId
      );

      if (inventoryEntry) {
        await journalEntryRepository.updateJournalEntryAmounts(
          {
            journalEntryId: inventoryEntry.journalEntryId,
            debit: subtotal,
            credit: new Decimal(0),
          },
          prismaTransaction
        );
      }

      if (vatEntry) {
        await journalEntryRepository.updateJournalEntryAmounts(
          {
            journalEntryId: vatEntry.journalEntryId,
            debit: vat,
            credit: new Decimal(0),
          },
          prismaTransaction
        );
      }

      if (cashEntry && paymentType === PaymentType.CASH) {
        await journalEntryRepository.updateJournalEntryAmounts(
          {
            journalEntryId: cashEntry.journalEntryId,
            debit: new Decimal(0),
            credit: total,
          },
          prismaTransaction
        );
      } else if (cashEntry && paymentType === PaymentType.MIXED) {
        const cashAmount = new Decimal(cashEntry.credit || 0);

        await journalEntryRepository.updateJournalEntryAmounts(
          {
            journalEntryId: cashEntry.journalEntryId,
            debit: new Decimal(0),
            credit: cashAmount,
          },
          prismaTransaction
        );
      }

      if (
        payableEntry &&
        (paymentType === PaymentType.CREDIT ||
          paymentType === PaymentType.MIXED)
      ) {
        const cashAmount = cashEntry
          ? new Decimal(cashEntry.credit || 0)
          : new Decimal(0);
        const creditAmount =
          paymentType === PaymentType.CREDIT ? total : total.minus(cashAmount);

        await journalEntryRepository.updateJournalEntryAmounts(
          {
            journalEntryId: payableEntry.journalEntryId,
            debit: new Decimal(0),
            credit: creditAmount,
          },
          prismaTransaction
        );
      }

      // Update payable jika credit atau mixed
      if (
        payable &&
        (paymentType === PaymentType.CREDIT ||
          paymentType === PaymentType.MIXED)
      ) {
        const cashEntry = journalEntries.find(
          (e) => e.accountId === cashAccount.accountId
        );
        const cashAmount = cashEntry
          ? new Decimal(cashEntry.credit || 0)
          : new Decimal(0);
        const creditAmount =
          paymentType === PaymentType.CREDIT ? total : total.minus(cashAmount);

        await payableRepository.updatePayableByPayableId(
          {
            payableId: payable.payableId,
            supplierId: existingPurchase.supplierId,
            dueDate: payable.dueDate,
            status: payable.status,
            amount: creditAmount,
          },
          prismaTransaction
        );
      }

      // Terapkan saldo akun baru
      const updatedInventoryAccount2 =
        await accountRepository.updateAccountTransaction(
          {
            accountCode: inventoryAccount.accountCode,
            balance: inventoryAccount.balance.plus(subtotal),
          },
          prismaTransaction
        );

      inventoryAccount = {
        ...inventoryAccount,
        balance: updatedInventoryAccount2.balance,
      };

      const updatedVatInputAccount2 =
        await accountRepository.updateAccountTransaction(
          {
            accountCode: vatInputAccount.accountCode,
            balance: vatInputAccount.balance.plus(vat),
          },
          prismaTransaction
        );

      vatInputAccount = {
        ...vatInputAccount,
        balance: updatedVatInputAccount2.balance,
      };

      if (paymentType === PaymentType.CASH) {
        const updatedCashAccount =
          await accountRepository.updateAccountTransaction(
            {
              accountCode: cashAccount.accountCode,
              balance: cashAccount.balance.minus(total),
            },
            prismaTransaction
          );

        cashAccount = { ...cashAccount, balance: updatedCashAccount.balance };
      } else if (paymentType === PaymentType.CREDIT) {
        const updatedPayableAccount =
          await accountRepository.updateAccountTransaction(
            {
              accountCode: payableAccount.accountCode,
              balance: payableAccount.balance.plus(total),
            },
            prismaTransaction
          );

        payableAccount = {
          ...payableAccount,
          balance: updatedPayableAccount.balance,
        };
      } else if (paymentType === PaymentType.MIXED) {
        const cashEntry = journal.journalEntries.find(
          (e) => e.accountId === cashAccount.accountId
        );

        const cashAmount = new Decimal(cashEntry?.credit || 0);
        const payableAmount = total.minus(cashAmount);

        const updatedCashAccount =
          await accountRepository.updateAccountTransaction(
            {
              accountCode: cashAccount.accountCode,
              balance: cashAccount.balance.minus(cashAmount),
            },
            prismaTransaction
          );

        cashAccount = { ...cashAccount, balance: updatedCashAccount.balance };

        const updatedPayableAccount =
          await accountRepository.updateAccountTransaction(
            {
              accountCode: payableAccount.accountCode,
              balance: payableAccount.balance.plus(payableAmount),
            },
            prismaTransaction
          );

        payableAccount = {
          ...payableAccount,
          balance: updatedPayableAccount.balance,
        };
      }

      // Validasi saldo akun utang akhir
      const finalTotalPayables =
        await payableRepository.getTotalPayables(prismaTransaction);
      const expectedPayableBalance = new Decimal(finalTotalPayables || 0);

      if (!payableAccount.balance.equals(expectedPayableBalance)) {
        throw new ResponseError(
          400,
          `Payable account balance mismatch: expected ${expectedPayableBalance.toString()}, but got ${payableAccount.balance.toString()}`
        );
      }

      return updatedPurchase;
    });
  }
}

export const purchaseDetailService = new PurchaseDetailService();
