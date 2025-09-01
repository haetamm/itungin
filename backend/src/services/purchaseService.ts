import {
  CashPurchaseRequest,
  CreatePurchase,
  CreditPurchaseRequest,
  DeletePurchaseRequest,
  JournalEntryForm,
  MixedPurchaseRequest,
  PurchaseResult,
} from '../utils/interface';
import { validate } from '../validation/validation';
import { vatSettingRepository } from '../repository/vatSettingRepository';
import {
  deletePurchaseSchema,
  purchaseCashSchema,
  purchaseCreditSchema,
  purchaseMixedSchema,
} from '../validation/purchaseValidation';
import { supplierRepository } from '../repository/supplierRepository';
import { productRepository } from '../repository/productRepository';
import { Decimal } from '@prisma/client/runtime/library';
import { ResponseError } from '../entities/responseError';
import {
  Account,
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

export class PurchaseService {
  private async createPurchase(
    data: CreatePurchase,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<PurchaseResult> {
    const {
      date,
      supplierId,
      invoiceNumber,
      items,
      vatRateId,
      inventoryAccountCode,
      vatInputAccountCode,
      paymentType,
    } = data;

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

    // Validasi inventory account and VAT Input accounts
    const inventoryAccount = await this.findAccountByAccountCode(
      'Inventory',
      inventoryAccountCode,
      prismaTransaction
    );
    const vatInputAccount = await this.findAccountByAccountCode(
      'Input VAT',
      vatInputAccountCode,
      prismaTransaction
    );

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

    // Buat detail pembelian
    await purchaseDetailRepository.createManyPurchaseDetails(
      data.items.map((item) => ({
        purchaseId: purchase.purchaseId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: new Decimal(item.quantity).times(item.unitPrice),
      })),
      prismaTransaction
    );

    // Buat Inventory batch dan update stok produk
    for (const item of data.items) {
      const product = await productRepository.findProductTransaction(
        item.productId,
        prismaTransaction
      );

      if (!product) {
        throw new ResponseError(404, 'Product not found');
      }

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
      inventoryAccount,
      vatInputAccount,
    };
  }

  async createCashPurchase({
    body,
  }: {
    body: CashPurchaseRequest;
  }): Promise<Purchase> {
    const vatReq = validate(purchaseCashSchema, body);
    const {
      date,
      supplierId,
      invoiceNumber,
      vatRateId,
      items,
      cashAccountCode,
      inventoryAccountCode,
      vatInputAccountCode,
    } = vatReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Validasi cash account
      const cashAccount = await this.findAccountByAccountCode(
        'Cash',
        cashAccountCode,
        prismaTransaction
      );

      const {
        purchase,
        journal,
        subtotal,
        vat,
        total,
        inventoryAccount,
        vatInputAccount,
      } = await this.createPurchase(
        {
          date,
          supplierId,
          invoiceNumber,
          items,
          vatRateId,
          inventoryAccountCode,
          vatInputAccountCode,
          paymentType: PaymentType.CASH,
        },
        prismaTransaction
      );

      // Validate cash balance
      if (cashAccount.balance.comparedTo(total) < 0) {
        throw new ResponseError(400, 'Insufficient cash balance');
      }

      // Prepare Journal Entries
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
        {
          journalId: journal.journalId,
          accountId: cashAccount.accountId,
          debit: new Decimal(0),
          credit: total,
        },
      ];

      await journalEntryRepository.createManyJournalEntries(
        journalEntries,
        prismaTransaction
      );

      // update account balances
      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccountCode,
          balance: inventoryAccount.balance.plus(subtotal),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: vatInputAccountCode,
          balance: vatInputAccount.balance.plus(vat),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: cashAccountCode,
          balance: cashAccount.balance.minus(total),
        },
        prismaTransaction
      );

      return purchase;
    });
  }

  async createCreditPurchase({
    body,
  }: {
    body: CreditPurchaseRequest;
  }): Promise<Purchase> {
    const vatReq = validate(purchaseCreditSchema, body);
    const {
      date,
      supplierId,
      invoiceNumber,
      vatRateId,
      items,
      payableAccountCode,
      inventoryAccountCode,
      vatInputAccountCode,
    } = vatReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Validasi payable account
      const payableAccount = await this.findAccountByAccountCode(
        'Payable',
        payableAccountCode,
        prismaTransaction
      );

      const {
        purchase,
        journal,
        subtotal,
        vat,
        total,
        inventoryAccount,
        vatInputAccount,
      } = await this.createPurchase(
        {
          date,
          supplierId,
          invoiceNumber,
          items,
          vatRateId,
          inventoryAccountCode,
          vatInputAccountCode,
          paymentType: PaymentType.CREDIT,
        },
        prismaTransaction
      );

      // Prepare Journal Entries
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
        {
          journalId: journal.journalId,
          accountId: payableAccount.accountId,
          debit: new Decimal(0),
          credit: total,
        },
      ];

      await journalEntryRepository.createManyJournalEntries(
        journalEntries,
        prismaTransaction
      );

      // Buat Payable entry
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + 30); // 30-day credit term

      const journalEntry = await journalEntryRepository.findLatestCreditEntry(
        journal.journalId,
        total,
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
          amount: total,
          dueDate,
          status: PaymentStatus.UNPAID,
        },
        prismaTransaction
      );

      // update account balance
      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccountCode,
          balance: inventoryAccount.balance.plus(subtotal),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: vatInputAccountCode,
          balance: vatInputAccount.balance.plus(vat),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: payableAccountCode,
          balance: payableAccount.balance.plus(total),
        },
        prismaTransaction
      );

      return purchase;
    });
  }

  async createMixedPurchase({
    body,
  }: {
    body: MixedPurchaseRequest;
  }): Promise<Purchase> {
    const vatReq = validate(purchaseMixedSchema, body);
    const {
      date,
      supplierId,
      invoiceNumber,
      vatRateId,
      items,
      cashAccountCode,
      cashAmount,
      payableAccountCode,
      inventoryAccountCode,
      vatInputAccountCode,
    } = vatReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Validasi cash and payable accounts
      const cashAccount = await this.findAccountByAccountCode(
        'Cash',
        cashAccountCode,
        prismaTransaction
      );
      const payableAccount = await this.findAccountByAccountCode(
        'Payable',
        payableAccountCode,
        prismaTransaction
      );

      const {
        purchase,
        journal,
        subtotal,
        vat,
        total,
        inventoryAccount,
        vatInputAccount,
      } = await this.createPurchase(
        {
          date,
          supplierId,
          invoiceNumber,
          items,
          vatRateId,
          inventoryAccountCode,
          vatInputAccountCode,
          paymentType: PaymentType.MIXED,
        },
        prismaTransaction
      );

      // Validate cash balance
      const cash = new Decimal(cashAmount);
      const tot = new Decimal(total);
      if (cashAccount.balance.comparedTo(cash) < 0) {
        throw new ResponseError(400, 'Insufficient cash balance');
      }
      if (cash.comparedTo(tot) >= 0) {
        throw new ResponseError(
          400,
          'Cash amount must be less than total for mixed payment'
        );
      }

      // Prepare Journal Entries
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
        {
          journalId: journal.journalId,
          accountId: cashAccount.accountId,
          debit: new Decimal(0),
          credit: cash,
        },
        {
          journalId: journal.journalId,
          accountId: payableAccount.accountId,
          debit: new Decimal(0),
          credit: total.minus(cash),
        },
      ];

      await journalEntryRepository.createManyJournalEntries(
        journalEntries,
        prismaTransaction
      );

      // Create Payable entry
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + 30);

      const journalEntry = await journalEntryRepository.findLatestCreditEntry(
        journal.journalId,
        total.minus(cash),
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
          amount: total.minus(cash),
          dueDate,
          status: PaymentStatus.UNPAID,
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccountCode,
          balance: inventoryAccount.balance.plus(subtotal),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: vatInputAccountCode,
          balance: vatInputAccount.balance.plus(vat),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: cashAccountCode,
          balance: cashAccount.balance.minus(cash),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: payableAccountCode,
          balance: payableAccount.balance.plus(total.minus(cash)),
        },
        prismaTransaction
      );

      return purchase;
    });
  }

  async deletePurchase({
    body,
  }: {
    body: DeletePurchaseRequest;
  }): Promise<void> {
    const vatReq = validate(deletePurchaseSchema, body);
    const {
      purchaseId,
      inventoryAccountCode,
      vatInputAccountCode,
      cashAccountCode,
      payableAccountCode,
    } = vatReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Find purchase with related data
      const purchase = await purchaseRepository.findPurchaseByIdTransaction(
        purchaseId,
        prismaTransaction
      );
      if (!purchase) {
        throw new ResponseError(404, 'Purchase not found');
      }

      // Fetch accounts
      const inventoryAccount = await this.findAccountByAccountCode(
        'Inventory',
        inventoryAccountCode,
        prismaTransaction
      );
      const vatInputAccount = await this.findAccountByAccountCode(
        'Input VAT',
        vatInputAccountCode,
        prismaTransaction
      );

      let cashAccount: Account | null = null;
      let payableAccount: Account | null = null;

      if (
        purchase.paymentType === PaymentType.CASH ||
        purchase.paymentType === PaymentType.MIXED
      ) {
        cashAccount = await this.findAccountByAccountCode(
          'Cash',
          cashAccountCode,
          prismaTransaction
        );
      }

      if (
        purchase.paymentType === PaymentType.CREDIT ||
        purchase.paymentType === PaymentType.MIXED
      ) {
        payableAccount = await this.findAccountByAccountCode(
          'Payable',
          payableAccountCode,
          prismaTransaction
        );
      }

      // AMbil journal entries
      const journalEntries: JournalEntry[] = purchase.journal.journalEntries;

      // Initialize amounts to reverse
      let inventoryDebit = new Decimal(0);
      let vatDebit = new Decimal(0);
      let cashCredit = new Decimal(0);
      let payableCredit = new Decimal(0);

      // Hitung amounts berdasarkan payment type
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

      // Hapus payables (for credit or mixed)
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
          purchaseDetail.productId,
          purchaseDetail.purchase.date,
          purchaseDetail.unitPrice,
          prismaTransaction
        );

        const cogs = await recalculateCOGS(
          product.productId,
          setting.inventoryMethod,
          prismaTransaction
        );
        const sellingPrice = cogs.equals(0)
          ? product.profitMargin
          : cogs.plus(product.profitMargin);

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

      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccount.accountCode,
          balance: inventoryAccount.balance.minus(inventoryDebit),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: vatInputAccountCode,
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

  private async findAccountByAccountCode(
    accountName: string,
    accountCode: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Account> {
    const account = await accountRepository.findAccountByAccountCodeTransaction(
      accountCode,
      prismaTransaction
    );

    if (!account) {
      throw new ResponseError(404, `${accountName} account not found`);
    }

    return account;
  }
}

export const purchaseService = new PurchaseService();
