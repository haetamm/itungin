import {
  DeletePurchaseRequest,
  JournalEntryForm,
  PurchaseRequest,
  PurchaseResult,
  UpdatePurchaseDataRelation,
} from '../utils/interface';
import { validate } from '../validation/validation';
import { vatSettingRepository } from '../repository/vatSettingRepository';
import {
  deletePurchaseSchema,
  purchaseSchema,
} from '../validation/purchaseValidation';
import { supplierRepository } from '../repository/supplierRepository';
import { productRepository } from '../repository/productRepository';
import { Decimal } from '@prisma/client/runtime/library';
import { ResponseError } from '../entities/responseError';
import {
  JournalEntry,
  PaymentStatus,
  PaymentType,
  Prisma,
  Purchase,
} from '@prisma/client';
import { accountRepository } from '../repository/accountRepository';
import { journalRepository } from '../repository/journalRepository';
import { purchaseRepository } from '../repository/purchaseRepository';
import { purchaseDetailRepository } from '../repository/purchaseDetailRepository';
import { inventoryBatchRepository } from '../repository/inventoryBatchRepository';
import { prismaClient } from '../application/database';
import { journalEntryRepository } from '../repository/journalEntryRepository';
import { payableRepository } from '../repository/paybleRepository';
import { generalSettingRepository } from '../repository/generalSettingRepository';
import { recalculateCOGS } from '../utils/cogs';
import { accountDefaultRepository } from '../repository/accountDefaultRepository';

export class PurchaseService {
  private async updatePurchaseDataRelation(
    data: UpdatePurchaseDataRelation,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<PurchaseResult> {
    const { date, supplierId, invoiceNumber, items, vatRateId, paymentType } =
      data;

    const setting =
      await generalSettingRepository.getSettingTransaction(prismaTransaction);
    if (!setting) {
      throw new ResponseError(400, 'Inventory method not configured');
    }

    const supplier = await supplierRepository.findSupplierTransaction(
      supplierId,
      prismaTransaction
    );
    if (!supplier) throw new ResponseError(404, 'Supplier not found');

    const vatSetting = await vatSettingRepository.findVatTransaction(
      vatRateId,
      prismaTransaction
    );
    if (!vatSetting) throw new ResponseError(404, 'VAT rate not found');
    if (vatSetting.effectiveDate > new Date(date))
      throw new ResponseError(400, 'VAT rate not effective');

    for (const item of items) {
      const product = await productRepository.findProductTransaction(
        item.productId,
        prismaTransaction
      );
      if (!product)
        throw new ResponseError(404, `Product ${item.productId} not found`);
    }

    // Hitung subtotal = jumlah semua (qty × unitPrice) untuk setiap item
    const subtotal = items.reduce(
      (sum, item) => sum.plus(new Decimal(item.quantity).times(item.unitPrice)),
      new Decimal(0)
    );

    // Hitung pajak (VAT) = subtotal × persentase pajak (vatRate)
    const vat = subtotal.times(vatSetting.vatRate).div(100);

    // Hitung total akhir = subtotal + VAT
    const total = subtotal.plus(vat);

    // Buat Journal (header)
    const journal = await journalRepository.createJournal(
      {
        date: data.date,
        description: `Pembelian ${paymentType.toLowerCase()} ${invoiceNumber}`,
        reference: invoiceNumber,
      },
      prismaTransaction
    );

    // Buat pembelian
    const purchase = await purchaseRepository.createPurchase(
      {
        date: data.date,
        supplierId: data.supplierId,
        invoiceNumber: data.invoiceNumber,
        paymentType: data.paymentType,
        subtotal,
        vat,
        total,
        journalId: journal.journalId,
      },
      prismaTransaction
    );

    // Buat detail pembelian, Inventory batch dan update stok dan harga produk
    for (const item of data.items) {
      const product = await productRepository.findProductTransaction(
        item.productId,
        prismaTransaction
      );

      if (!product) {
        throw new ResponseError(404, 'Product not found');
      }

      // buat detail pembelian
      const detail = await purchaseDetailRepository.createPurchaseDetail(
        {
          purchaseId: purchase.purchaseId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: new Decimal(item.quantity).times(item.unitPrice),
        },
        prismaTransaction
      );

      const currentStock = product.stock;
      const currentAvgPrice = product.avgPurchasePrice;

      let newAvgPrice: Decimal;
      if (currentStock === 0) {
        newAvgPrice = new Decimal(item.unitPrice);
      } else {
        const oldValue = currentAvgPrice.times(currentStock);
        const newValue = new Decimal(item.unitPrice).times(item.quantity);
        newAvgPrice = oldValue.plus(newValue).div(currentStock + item.quantity);
      }

      // Buat batch baru
      await inventoryBatchRepository.createInventoryBatch(
        {
          productId: item.productId,
          purchaseDate: data.date,
          quantity: item.quantity,
          purchasePrice: item.unitPrice,
          remainingStock: item.quantity,
          purchaseDetailId: detail.purchaseDetailId,
        },
        prismaTransaction
      );

      // Hitung COGS (harga pokok) setelah batch disimpan
      const cogs = await recalculateCOGS(
        product.productId,
        setting.inventoryMethod,
        prismaTransaction
      );

      const profitMargin = new Decimal(item.profitMargin);
      const price = new Decimal(item.unitPrice);

      let sellingPrice: Decimal;
      if (cogs.equals(0)) {
        sellingPrice = price.add(profitMargin);
      } else {
        sellingPrice = cogs.add(profitMargin);
      }

      // Update product
      await productRepository.updateProductTransaction(
        {
          productId: item.productId,
          stock: currentStock + item.quantity,
          avgPurchasePrice: newAvgPrice,
          profiteMargin: profitMargin,
          sellingPrice,
        },
        prismaTransaction
      );
    }

    return {
      purchase,
      journal,
      subtotal,
      vat,
      total,
    };
  }

  async createPurchase({ body }: { body: PurchaseRequest }): Promise<Purchase> {
    const purchaseReq = validate(purchaseSchema, body);

    const {
      date,
      supplierId,
      invoiceNumber,
      vatRateId,
      items,
      paymentType,
      cashAmount,
    } = purchaseReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil account default
      const accountDefault =
        await accountDefaultRepository.findOne(prismaTransaction);
      if (!accountDefault)
        throw new ResponseError(400, 'Account not configured');

      const { cashAccount, payableAccount, inventoryAccount, vatInputAccount } =
        accountDefault;

      const { purchase, journal, subtotal, vat, total } =
        await this.updatePurchaseDataRelation(
          {
            date,
            supplierId,
            invoiceNumber,
            items,
            vatRateId,
            paymentType,
          },
          prismaTransaction
        );

      // ==== VALIDASI SALDO CASH ====
      if (paymentType === PaymentType.CASH) {
        if (cashAccount.balance.comparedTo(total) < 0) {
          throw new ResponseError(400, 'Insufficient cash balance');
        }
      }

      let cash: Decimal;
      if (cashAmount) {
        cash = new Decimal(cashAmount);
      }

      if (paymentType === PaymentType.MIXED) {
        if (cashAccount.balance.comparedTo(cash!) < 0) {
          throw new ResponseError(400, 'Insufficient cash balance');
        }
        if (cash!.comparedTo(total) >= 0) {
          throw new ResponseError(
            400,
            'Cash amount must be less than total for mixed payment'
          );
        }
      }

      // ==== JOURNAL ENTRIES ====
      const journalEntries: JournalEntryForm[] = [
        {
          journalId: journal.journalId,
          accountId: inventoryAccount.accountId,
          debit: subtotal,
          credit: new Decimal(0),
        },
        {
          journalId: journal.journalId,
          accountId: vatInputAccount.accountId,
          debit: vat,
          credit: new Decimal(0),
        },
      ];

      if (paymentType === PaymentType.CASH) {
        journalEntries.push({
          journalId: journal.journalId,
          accountId: cashAccount.accountId,
          debit: new Decimal(0),
          credit: total,
        });
      }

      if (paymentType === PaymentType.CREDIT) {
        journalEntries.push({
          journalId: journal.journalId,
          accountId: payableAccount.accountId,
          debit: new Decimal(0),
          credit: total,
        });
      }

      if (paymentType === PaymentType.MIXED) {
        journalEntries.push(
          {
            journalId: journal.journalId,
            accountId: cashAccount.accountId,
            debit: new Decimal(0),
            credit: cash!,
          },
          {
            journalId: journal.journalId,
            accountId: payableAccount.accountId,
            debit: new Decimal(0),
            credit: total.minus(cash!),
          }
        );
      }

      await journalEntryRepository.createManyJournalEntries(
        journalEntries,
        prismaTransaction
      );

      // ==== PAYABLE ENTRY (CREDIT / MIXED) ====
      if (
        paymentType === PaymentType.CREDIT ||
        paymentType === PaymentType.MIXED
      ) {
        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + 30);

        const creditAmount =
          paymentType === PaymentType.CREDIT ? total : total.minus(cash!);

        const journalEntry = await journalEntryRepository.findLatestCreditEntry(
          journal.journalId,
          creditAmount,
          prismaTransaction
        );

        if (!journalEntry) {
          throw new ResponseError(400, 'Failed to find payable journal entry');
        }

        await payableRepository.createPayable(
          {
            journalEntryId: journalEntry.journalEntryId,
            supplierId,
            purchaseId: purchase.purchaseId,
            amount: creditAmount,
            dueDate,
            status: PaymentStatus.UNPAID,
          },
          prismaTransaction
        );
      }

      // ==== UPDATE ACCOUNT BALANCES ====
      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccount.accountCode,
          balance: inventoryAccount.balance.plus(subtotal),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: vatInputAccount.accountCode,
          balance: vatInputAccount.balance.plus(vat),
        },
        prismaTransaction
      );

      if (paymentType === PaymentType.CASH) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.minus(total),
          },
          prismaTransaction
        );
      }

      if (paymentType === PaymentType.CREDIT) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: payableAccount.accountCode,
            balance: payableAccount.balance.plus(total),
          },
          prismaTransaction
        );
      }

      if (paymentType === PaymentType.MIXED) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.minus(cash!),
          },
          prismaTransaction
        );

        await accountRepository.updateAccountTransaction(
          {
            accountCode: payableAccount.accountCode,
            balance: payableAccount.balance.plus(total.minus(cash!)),
          },
          prismaTransaction
        );
      }

      return purchase;
    });
  }

  async deletePurchase({
    body,
  }: {
    body: DeletePurchaseRequest;
  }): Promise<void> {
    const { purchaseId } = validate(deletePurchaseSchema, body);

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Cari purchase
      const purchase = await purchaseRepository.findPurchaseByIdTransaction(
        purchaseId,
        prismaTransaction
      );
      if (!purchase) {
        throw new ResponseError(404, 'Purchase not found');
      }

      // Ambil account default
      const accountDefault =
        await accountDefaultRepository.findOne(prismaTransaction);
      if (!accountDefault) {
        throw new ResponseError(400, 'Account default not configured');
      }

      const { cashAccount, payableAccount, inventoryAccount, vatInputAccount } =
        accountDefault;

      // Ambil journal entries
      const journalEntries: JournalEntry[] = purchase.journal.journalEntries;

      let inventoryDebit = new Decimal(0);
      let vatDebit = new Decimal(0);
      let cashCredit = new Decimal(0);
      let payableCredit = new Decimal(0);

      switch (purchase.paymentType) {
        case PaymentType.CASH:
          for (const entry of journalEntries) {
            if (entry.accountId === inventoryAccount.accountId) {
              inventoryDebit = entry.debit;
            } else if (entry.accountId === vatInputAccount.accountId) {
              vatDebit = entry.debit;
            } else if (
              cashAccount &&
              entry.accountId === cashAccount.accountId
            ) {
              cashCredit = entry.credit;
            }
          }
          break;

        case PaymentType.CREDIT:
          for (const entry of journalEntries) {
            if (entry.accountId === inventoryAccount.accountId) {
              inventoryDebit = entry.debit;
            } else if (entry.accountId === vatInputAccount.accountId) {
              vatDebit = entry.debit;
            } else if (
              payableAccount &&
              entry.accountId === payableAccount.accountId
            ) {
              payableCredit = entry.credit;
            }
          }
          break;

        case PaymentType.MIXED:
          for (const entry of journalEntries) {
            if (entry.accountId === inventoryAccount.accountId) {
              inventoryDebit = entry.debit;
            } else if (entry.accountId === vatInputAccount.accountId) {
              vatDebit = entry.debit;
            } else if (
              cashAccount &&
              entry.accountId === cashAccount.accountId
            ) {
              cashCredit = entry.credit;
            } else if (
              payableAccount &&
              entry.accountId === payableAccount.accountId
            ) {
              payableCredit = entry.credit;
            }
          }
          break;

        default:
          throw new ResponseError(400, 'Invalid payment type');
      }

      for (const payable of purchase.payables) {
        await payableRepository.deletePayable(
          payable.payableId,
          prismaTransaction
        );
      }

      // Revert product stock and delete inventory batches
      const setting =
        await generalSettingRepository.getSettingTransaction(prismaTransaction);
      if (!setting) {
        throw new ResponseError(400, 'Inventory method not configured');
      }

      for (const detail of purchase.purchaseDetails) {
        const product = await productRepository.findProductTransaction(
          detail.productId,
          prismaTransaction
        );
        if (!product) {
          throw new ResponseError(404, `Product ${detail.productId} not found`);
        }

        const newStock = product.stock - detail.quantity;
        if (newStock < 0) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${detail.productId}`
          );
        }

        const purchaseDetail =
          await purchaseDetailRepository.findPurchaseDetailById(
            detail.purchaseDetailId,
            prismaTransaction
          );
        if (!purchaseDetail) {
          throw new ResponseError(
            404,
            `Purchase detail ${detail.purchaseDetailId} not found`
          );
        }

        await inventoryBatchRepository.deleteBatchByPurchaseDetail(
          purchaseDetail.purchaseDetailId,
          prismaTransaction
        );

        // hitung ulang harga pokok
        const cogs = await recalculateCOGS(
          product.productId,
          setting.inventoryMethod,
          prismaTransaction
        );

        const sellingPrice = cogs.equals(0)
          ? product.profitMargin
          : cogs.plus(product.profitMargin);

        // update kembali produk
        await productRepository.updateProductTransaction(
          {
            productId: detail.productId,
            stock: newStock,
            avgPurchasePrice: cogs,
            profiteMargin: product.profitMargin,
            sellingPrice,
          },
          prismaTransaction
        );
      }

      // Delete purchase details
      await purchaseDetailRepository.deleteManyPurchaseDetails(
        purchase.purchaseDetails.map((detail) => detail.purchaseDetailId),
        prismaTransaction
      );

      // Delete journal entries
      await journalEntryRepository.deleteManyJournalEntries(
        journalEntries.map((entry) => entry.journalEntryId),
        prismaTransaction
      );

      // Delete journal
      await journalRepository.deleteJournal(
        purchase.journal.journalId,
        prismaTransaction
      );

      // Update akun-akun
      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccount.accountCode,
          balance: inventoryAccount.balance.minus(inventoryDebit),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: vatInputAccount.accountCode,
          balance: vatInputAccount.balance.minus(vatDebit),
        },
        prismaTransaction
      );

      if (cashAccount && cashCredit.greaterThan(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.plus(cashCredit),
          },
          prismaTransaction
        );
      }

      if (payableAccount && payableCredit.greaterThan(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: payableAccount.accountCode,
            balance: payableAccount.balance.minus(payableCredit),
          },
          prismaTransaction
        );
      }
    });
  }

  async getAllPurchase(
    page: number,
    limit: number,
    search: string,
    paymentType?: PaymentType,
    from?: Date,
    to?: Date
  ) {
    if (page < 1 || limit < 1) {
      throw new ResponseError(400, 'Halaman dan batas harus bilangan positif');
    }

    if (paymentType && !Object.values(PaymentType).includes(paymentType)) {
      throw new ResponseError(
        400,
        `Invalid paymentType '${paymentType}' Allowed values are: ${Object.values(PaymentType).join(', ')}`
      );
    }

    const { purchases, total } = await purchaseRepository.getAllPurchase(
      page,
      limit,
      search,
      paymentType,
      from,
      to
    );

    return {
      purchases,
      pagination: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
    };
  }

  async getPurchaseById(id: string) {
    const purchase = await purchaseRepository.findPurchaseDetailById(id);
    if (!purchase) throw new ResponseError(404, 'Purchase not found');
    return purchase;
  }
}

export const purchaseService = new PurchaseService();
