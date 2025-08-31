import {
  CashPurchaseRequest,
  CreatePurchase,
  CreditPurchaseRequest,
  JournalEntryForm,
  MixedPurchaseRequest,
  PurchaseResult,
} from '../utils/interface';
import { validate } from '../validation/validation';
import { vatSettingRepository } from '../repository/vatSettingRepository';
import {
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

    const setting = await generalSettingRepository.getSetting();
    if (!setting) {
      throw new ResponseError(400, 'Method inventory not configured');
    }

    const supplier = await supplierRepository.findSupplierById(supplierId);
    if (!supplier) throw new Error('Supplier not found');

    const vatSetting = await vatSettingRepository.findVatById(vatRateId);
    if (!vatSetting) throw new Error('VAT rate not found');
    if (vatSetting.effectiveDate > new Date(date))
      throw new ResponseError(400, 'VAT rate not effective');

    for (const item of items) {
      const product = await productRepository.findProductById(item.productId);
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
    const inventoryAccount =
      await accountRepository.findAccountByAccountCodeTransaction(
        inventoryAccountCode,
        prismaTransaction
      );
    const vatInputAccount =
      await accountRepository.findAccountByAccountCodeTransaction(
        vatInputAccountCode,
        prismaTransaction
      );
    if (!inventoryAccount || !vatInputAccount) {
      throw new ResponseError(404, 'Inventory or VAT input account not found');
    }

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

    // Update Product stock and buat InventoryBatch
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

      // Buat batch baru terlebih dahulu
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

      // Hitung COGS setelah batch baru disimpan
      let cogs = await recalculateCOGS(
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

      // Update produk
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

    // Validate cash account
    const cashAccount = await this.findAccountByAccountCode(
      'Cash',
      cashAccountCode
    );

    return await prismaClient.$transaction(async (prismaTransaction) => {
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

      // Update account balances
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

    // Validasi payable account
    const payableAccount = await this.findAccountByAccountCode(
      'Payable',
      payableAccountCode
    );

    return await prismaClient.$transaction(async (prismaTransaction) => {
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

      // Create Payable entry
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + 30); // Assume 30-day credit term

      // Cari journalEntry terakhir dengan kredit = total
      const journalEntry = await journalEntryRepository.findLatestCreditEntry(
        journal.journalId,
        total,
        prismaTransaction
      );

      if (!journalEntry)
        throw new ResponseError(400, 'Failed to find payable journal entry');

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

      // Update account balances
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
          balance: payableAccount.balance.minus(total),
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

    // Validasi cash account
    const cashAccount = await this.findAccountByAccountCode(
      'Cash',
      cashAccountCode
    );

    // Validasi payable account
    const payableAccount = await this.findAccountByAccountCode(
      'Payable',
      payableAccountCode
    );

    return await prismaClient.$transaction(async (prismaTransaction) => {
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

      // Validate cash balance
      if (cashAccount.balance.comparedTo(cashAmount) < 0) {
        throw new ResponseError(400, 'Insufficient cash balance');
      }

      const cash = new Decimal(cashAmount);
      const tot = new Decimal(total);
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
          credit: cashAmount,
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

      // Create Payable entry
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + 30); // Assume 30-day credit term

      // Cari journalEntry terakhir dengan kredit = total
      const journalEntry = await journalEntryRepository.findLatestCreditEntry(
        journal.journalId,
        total,
        prismaTransaction
      );

      if (!journalEntry)
        throw new ResponseError(400, 'Failed to find payable journal entry');

      await payableRepository.createPayable(
        {
          journalEntryId: journalEntry.journalEntryId,
          supplierId,
          purchaseId: purchase.purchaseId,
          amount: total.minus(cashAmount),
          dueDate,
          status: PaymentStatus.UNPAID,
        },
        prismaTransaction
      );

      // Update account balances
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
          balance: cashAccount.balance.minus(cashAmount),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: payableAccountCode,
          balance: payableAccount.balance.plus(total.minus(cashAmount)),
        },
        prismaTransaction
      );

      return purchase;
    });
  }

  private async findAccountByAccountCode(
    accountName: string,
    accountCode: string
  ): Promise<Account> {
    const account =
      await accountRepository.findAccountByAccountCode(accountCode);

    if (!account)
      throw new ResponseError(404, `${accountName} account not found`);

    return account;
  }
}

export const purchaseService = new PurchaseService();
