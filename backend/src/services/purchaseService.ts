import { purchaseSchema } from './../validation/purchaseValidation';
import {
  JournalEntryForm,
  PurchaseDetailForm,
  PurchaseRequest,
  PurchaseResult,
  UpdatePurchaseDataRelation,
} from '../utils/interface';
import { validate } from '../validation/validation';
import { productRepository } from '../repository/productRepository';
import { Decimal } from '@prisma/client/runtime/library';
import { ResponseError } from '../entities/responseError';
import {
  EntryType,
  GeneralSetting,
  Payable,
  PaymentStatus,
  PaymentType,
  Prisma,
  Purchase,
  PurchaseDetail,
} from '@prisma/client';
import { accountRepository } from '../repository/accountRepository';
import { journalRepository } from '../repository/journalRepository';
import { purchaseRepository } from '../repository/purchaseRepository';
import { purchaseDetailRepository } from '../repository/purchaseDetailRepository';
import { inventoryBatchRepository } from '../repository/inventoryBatchRepository';
import { prismaClient } from '../application/database';
import { journalEntryRepository } from '../repository/journalEntryRepository';
import { payableRepository } from '../repository/payableRepository';
import { recalculateCOGS } from '../utils/cogs';
import { saleDetailRepository } from '../repository/saleDetailRepository';
import { generalsettingService } from './generalSettingService';
import { supplierService } from './supplierService';
import { vatService } from './vatService';
import { productService } from './productService';
import { accountService } from './accountService';
import { payablePaymentRepository } from '../repository/payablePaymentRepository';
import { stringToDate } from '../utils/helper';

export class PurchaseService {
  private async validatePurchasePayableStatus(
    paymentType: PaymentType,
    payable: Payable | null,
    prismaTransaction: Prisma.TransactionClient,
    status = 'modify'
  ) {
    if (
      paymentType === PaymentType.CREDIT ||
      paymentType === PaymentType.MIXED
    ) {
      if (payable) {
        const payments = await payablePaymentRepository.getPaymentByPayableId(
          payable.payableId,
          prismaTransaction
        );

        if (payments.length > 0) {
          throw new ResponseError(
            400,
            `Cannot ${status} purchase with associated payments for payable ${payable.payableId}. Please process a purchase return instead`
          );
        }

        if (payable.status === PaymentStatus.PAID) {
          throw new ResponseError(
            400,
            `Cannot ${status} purchase with paid payable ${payable.payableId}. Please process a purchase return instead`
          );
        }
      }
    }
  }

  private async updatePurchaseDataRelation(
    data: UpdatePurchaseDataRelation,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<PurchaseResult> {
    const {
      date,
      supplierId,
      invoiceNumber,
      paymentReference,
      items,
      vatRateId,
      paymentType,
    } = data;

    // ambil inventory method
    const setting =
      await generalsettingService.getSettingInventory(prismaTransaction);

    // validasi supplier
    await supplierService.getSupplierTransaction(supplierId, prismaTransaction);

    // validasi VAT input
    const vatSetting = await vatService.getVatSetting(
      vatRateId,
      prismaTransaction,
      new Date(date)
    );

    for (const item of items) {
      // validasi produk
      await productService.getProduct(item.productId, prismaTransaction);
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
        date: new Date(data.date),
        description: `Pembelian ${paymentType.toLowerCase()} ${invoiceNumber}`,
        reference: invoiceNumber,
        paymentReference,
      },
      prismaTransaction
    );

    // Buat pembelian
    const purchase = await purchaseRepository.createPurchase(
      {
        date: new Date(data.date),
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
      // ambil product
      const product = await productService.getProduct(
        item.productId,
        prismaTransaction
      );

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
          purchaseDate: new Date(data.date),
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
          profitMargin: profitMargin,
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

  private async validateInventoryBatchUsage(
    purchaseDetails: PurchaseDetail[],
    prismaTransaction: Prisma.TransactionClient,
    status = 'modify'
  ): Promise<void> {
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
            `Cannot ${status} purchase because its inventory batch (ID: ${batch.batchId}) has been used in sales. Please process a purchase return instead.`
          );
        }
      }
    }
  }

  private async reversePurchaseEffects(
    purchaseDetails: PurchaseDetail[],
    setting: GeneralSetting,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    for (const detail of purchaseDetails) {
      const product = await productService.getProduct(
        detail.productId,
        prismaTransaction
      );

      const currentStock = product.stock;
      const currentAvgPrice = product.avgPurchasePrice;
      const profitMargin = product.profitMargin;

      // Ambil batch terkait detail
      const batch = await inventoryBatchRepository.findByPurchaseDetailId(
        detail.purchaseDetailId,
        prismaTransaction
      );

      if (batch) {
        // Hitung ulang avg purchase price setelah menghapus batch (reverse weighted average)
        const oldValue = currentAvgPrice.times(currentStock);
        const removedValue = new Decimal(batch.purchasePrice).times(
          detail.quantity
        );
        const newTotalValue = oldValue.minus(removedValue);
        const newStock = currentStock - detail.quantity;
        let newAvgPrice: Decimal = new Decimal(0);

        if (newStock > 0) {
          newAvgPrice = newTotalValue.div(newStock);
        }

        // Hapus batch
        await inventoryBatchRepository.deleteBatchByPurchaseDetail(
          detail.purchaseDetailId,
          prismaTransaction
        );

        // Kurangi stok
        await productRepository.decrementStock(
          detail.productId,
          detail.quantity,
          prismaTransaction
        );

        // Hitung ulang COGS setelah perubahan
        const cogs = await recalculateCOGS(
          detail.productId,
          setting.inventoryMethod,
          prismaTransaction
        );

        // Hitung ulang selling price
        let sellingPrice: Decimal = new Decimal(0);
        if (newStock > 0 && !cogs.equals(0)) {
          sellingPrice = cogs.add(profitMargin);
        }

        // Update product
        await productRepository.updateProductTransaction(
          {
            productId: detail.productId,
            stock: newStock,
            avgPurchasePrice: newAvgPrice,
            profitMargin,
            sellingPrice,
          },
          prismaTransaction
        );
      }
    }
  }

  async createPurchase({ body }: { body: PurchaseRequest }): Promise<Purchase> {
    const purchaseReq = validate(purchaseSchema, body);

    const {
      date,
      supplierId,
      invoiceNumber,
      paymentVoucher,
      vatRateId,
      items,
      paymentType,
      cashAmount,
      dueDate,
    } = purchaseReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil account default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);

      const { cashAccount, payableAccount, inventoryAccount, vatInputAccount } =
        accountDefault;

      const { purchase, journal, subtotal, vat, total } =
        await this.updatePurchaseDataRelation(
          {
            date,
            supplierId,
            invoiceNumber,
            paymentReference: paymentVoucher,
            items,
            vatRateId,
            paymentType,
          },
          prismaTransaction
        );

      // validasi saldo cash
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

      // journal entries
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

      // payable entries
      if (
        paymentType === PaymentType.CREDIT ||
        paymentType === PaymentType.MIXED
      ) {
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

        const status =
          paymentType === PaymentType.CREDIT
            ? PaymentStatus.UNPAID
            : PaymentStatus.PARTIAL;

        await payableRepository.createPayable(
          {
            journalEntryId: journalEntry.journalEntryId,
            supplierId,
            purchaseId: purchase.purchaseId,
            amount: creditAmount,
            remainingAmount: creditAmount,
            dueDate: new Date(dueDate!),
            status,
          },
          prismaTransaction
        );
      }

      // update saldo account
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

  async updatePurchase(
    { body }: { body: PurchaseRequest },
    purchaseId: string
  ): Promise<Purchase> {
    const purchaseReq = validate(purchaseSchema, body);
    const {
      date,
      supplierId,
      invoiceNumber,
      paymentVoucher,
      vatRateId,
      items,
      paymentType,
      cashAmount,
      dueDate,
    } = purchaseReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil account default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);

      let { cashAccount, payableAccount, inventoryAccount, vatInputAccount } =
        accountDefault;

      // ambil method inventory
      const setting =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // Ambil data pembelian existing beserta relasinya
      const existingPurchase = await this.getPurchase(
        purchaseId,
        prismaTransaction
      );

      const {
        purchaseDetails,
        journal,
        paymentType: oldPaymentType,
        payable,
      } = existingPurchase;

      // Validasi payment type dan payable
      await this.validatePurchasePayableStatus(
        oldPaymentType,
        payable,
        prismaTransaction
      );

      // validasi dgn inventory batches (batchId)
      await this.validateInventoryBatchUsage(
        purchaseDetails,
        prismaTransaction
      );

      // Reverse efek account lama berdasarkan journal entries
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
        if (account.normalBalance === EntryType.DEBIT) {
          balanceAdjustment = new Decimal(0)
            .minus(entry.debit)
            .plus(entry.credit);
        } else if (account.normalBalance === EntryType.CREDIT) {
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

      // Reverse efek inventory lama (stok, batch, COGS, product updates)
      await this.reversePurchaseEffects(
        purchaseDetails,
        setting,
        prismaTransaction
      );

      // Hapus purchase details lama
      await purchaseDetailRepository.deleteByPurchaseId(
        purchaseId,
        prismaTransaction
      );

      // Hapus payable lama jika ada, sebelum menghapus journal entries
      if (existingPurchase.payable) {
        await payableRepository.deletePayable(
          existingPurchase.payable.payableId,
          prismaTransaction
        );
      }

      // Hapus journal entries lama
      await journalEntryRepository.deleteByJournalId(
        journal.journalId,
        prismaTransaction
      );

      // Hitung ulang subtotal, vat, dan total berdasarkan items baru
      let subtotal = new Decimal(0);
      const purchaseDetailsData: PurchaseDetailForm[] = [];

      for (const item of items) {
        // validasi product
        await productService.getProduct(item.productId, prismaTransaction);

        const unitPrice = new Decimal(item.unitPrice);
        const itemSubtotal = new Decimal(item.quantity).times(unitPrice);
        subtotal = subtotal.plus(itemSubtotal);

        purchaseDetailsData.push({
          purchaseId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          subtotal: itemSubtotal,
        });
      }

      // Validasi tarif VAT
      const vatSetting = await vatService.getVatSetting(
        vatRateId,
        prismaTransaction,
        new Date(date)
      );

      const vat = subtotal
        .times(vatSetting.vatRate)
        .div(100)
        .toDecimalPlaces(2);

      const total = subtotal.plus(vat);

      // Validasi saldo cash
      if (
        paymentType === PaymentType.CASH &&
        cashAccount.balance.comparedTo(total) < 0
      ) {
        throw new ResponseError(400, 'Insufficient cash balance');
      }

      if (
        paymentType === PaymentType.MIXED &&
        (!cashAmount ||
          cashAccount.balance.comparedTo(new Decimal(cashAmount)) < 0 ||
          new Decimal(cashAmount).comparedTo(total) >= 0)
      ) {
        throw new ResponseError(
          400,
          'Invalid cash amount for MIXED payment: insufficient balance or cash amount must be less than total'
        );
      }

      // Update tabel Purchase
      const purchase = await purchaseRepository.updatePurchaseTransaction(
        {
          purchaseId,
          date: new Date(date),
          supplierId,
          invoiceNumber,
          paymentType,
          subtotal,
          vat,
          total,
        },
        prismaTransaction
      );

      // Buat purchase details baru dan update inventory/product
      for (const item of items) {
        // Ambil product sebelum update
        const product = await productService.getProduct(
          item.productId,
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
          newAvgPrice = oldValue
            .plus(newValue)
            .div(currentStock + item.quantity);
        }

        const newStock = currentStock + item.quantity;

        // Buat detail pembelian
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

        // Buat batch baru
        await inventoryBatchRepository.createInventoryBatch(
          {
            productId: item.productId,
            purchaseDate: new Date(date),
            quantity: item.quantity,
            purchasePrice: item.unitPrice,
            remainingStock: item.quantity,
            purchaseDetailId: detail.purchaseDetailId,
          },
          prismaTransaction
        );

        // Tambah stok
        await productRepository.incrementStock(
          item.productId,
          item.quantity,
          prismaTransaction
        );

        // Hitung COGS (harga pokok) setelah batch disimpan
        const cogs = await recalculateCOGS(
          item.productId,
          setting.inventoryMethod,
          prismaTransaction
        );

        const profitMargin = new Decimal(
          item.profitMargin || product.profitMargin
        );
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
            stock: newStock,
            avgPurchasePrice: newAvgPrice,
            profitMargin,
            sellingPrice,
          },
          prismaTransaction
        );
      }

      // Update header jurnal
      await journalRepository.updateJournalTransaction(
        {
          journalId: journal.journalId,
          date: new Date(date),
          description: `Pembelian ${paymentType.toLowerCase()} ${invoiceNumber} (diperbarui ${stringToDate(new Date())})`,
          reference: invoiceNumber,
          paymentReference: paymentVoucher ? paymentVoucher : null,
        },
        prismaTransaction
      );

      // Buat journal entries baru
      let payableJournalEntryId: string | null = null;
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
      } else if (paymentType === PaymentType.CREDIT) {
        journalEntries.push({
          journalId: journal.journalId,
          accountId: payableAccount.accountId,
          debit: new Decimal(0),
          credit: total,
        });
      } else if (paymentType === PaymentType.MIXED) {
        const cash = new Decimal(cashAmount!);
        journalEntries.push(
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
          }
        );
      }

      // Create all journal entries at once
      await journalEntryRepository.createManyJournalEntries(
        journalEntries,
        prismaTransaction
      );

      // Find the payable journal entry ID
      if (
        paymentType === PaymentType.CREDIT ||
        paymentType === PaymentType.MIXED
      ) {
        const creditAmount =
          paymentType === PaymentType.CREDIT
            ? total
            : total.minus(new Decimal(cashAmount!));

        const journalEntry = await journalEntryRepository.findLatestCreditEntry(
          journal.journalId,
          creditAmount,
          prismaTransaction
        );

        if (!journalEntry) {
          throw new ResponseError(400, 'Failed to find payable journal entry');
        }

        payableJournalEntryId = journalEntry.journalEntryId;
      }

      // Update atau buat payable
      const status =
        paymentType === PaymentType.CREDIT
          ? PaymentStatus.UNPAID
          : PaymentStatus.PARTIAL;

      if (
        paymentType === PaymentType.CREDIT ||
        paymentType === PaymentType.MIXED
      ) {
        const payableAmount =
          paymentType === PaymentType.CREDIT
            ? total
            : total.minus(new Decimal(cashAmount!));

        if (!payableJournalEntryId) {
          throw new ResponseError(400, 'Payable journal entry ID not found');
        }
        await payableRepository.createPayable(
          {
            journalEntryId: payableJournalEntryId,
            supplierId,
            purchaseId,
            amount: payableAmount,
            remainingAmount: payableAmount,
            dueDate: new Date(dueDate || date),
            status,
          },
          prismaTransaction
        );
      }

      // Ambil akun default lagi untuk mendapatkan saldo terbaru
      const updatedAccountDefault =
        await accountService.getAccountDefault(prismaTransaction);

      const {
        cashAccount: updatedCashAccount,
        payableAccount: updatedPayableAccount,
        inventoryAccount: updatedInventoryAccount,
        vatInputAccount: updatedVatInputAccount,
      } = updatedAccountDefault;

      // Update saldo akun
      const accountUpdates = [
        {
          accountCode: updatedInventoryAccount.accountCode,
          balance: updatedInventoryAccount.balance.plus(subtotal),
        },
        {
          accountCode: updatedVatInputAccount.accountCode,
          balance: updatedVatInputAccount.balance.plus(vat),
        },
      ];

      if (paymentType === PaymentType.CASH) {
        accountUpdates.push({
          accountCode: updatedCashAccount.accountCode,
          balance: updatedCashAccount.balance.minus(total),
        });
      } else if (paymentType === PaymentType.CREDIT) {
        accountUpdates.push({
          accountCode: updatedPayableAccount.accountCode,
          balance: updatedPayableAccount.balance.plus(total),
        });
      } else if (paymentType === PaymentType.MIXED) {
        const cash = new Decimal(cashAmount!);
        accountUpdates.push(
          {
            accountCode: updatedCashAccount.accountCode,
            balance: updatedCashAccount.balance.minus(cash),
          },
          {
            accountCode: updatedPayableAccount.accountCode,
            balance: updatedPayableAccount.balance.plus(total.minus(cash)),
          }
        );
      }

      for (const update of accountUpdates) {
        await accountRepository.updateAccountTransaction(
          update,
          prismaTransaction
        );
      }

      return purchase;
    });
  }

  async deletePurchase(purchaseId: string): Promise<void> {
    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil inventory method
      const setting =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // Ambil purchase
      const purchase = await this.getPurchase(purchaseId, prismaTransaction);
      const { payable, purchaseDetails, journal, paymentType } = purchase;

      // Validasi payment type dan payable
      await this.validatePurchasePayableStatus(
        paymentType,
        payable,
        prismaTransaction,
        'delete'
      );

      // validasi dgn inventory batches (batchId)
      await this.validateInventoryBatchUsage(
        purchaseDetails,
        prismaTransaction,
        'delete'
      );

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

        // Hitung penyesuaian saldo berdasarkan tipe saldo normal
        let balanceAdjustment = new Decimal(0);

        if (account.normalBalance === EntryType.DEBIT) {
          // Jika akun normalnya DEBIT, pembalikan berarti minus debit + credit
          balanceAdjustment = new Decimal(0)
            .minus(entry.debit)
            .plus(entry.credit);
        } else if (account.normalBalance === EntryType.CREDIT) {
          // Jika akun normalnya CREDIT, pembalikan berarti plus debit - credit
          balanceAdjustment = new Decimal(0)
            .plus(entry.debit)
            .minus(entry.credit);
        }

        const currentBalance = account.balance ?? new Decimal(0);
        const newBalance = currentBalance.plus(balanceAdjustment);

        await accountRepository.updateAccountTransaction(
          {
            accountCode: account.accountCode,
            balance: newBalance,
          },
          prismaTransaction
        );
      }

      // Hapus payable jika ada
      if (payable) {
        await payableRepository.deletePayable(
          payable.payableId,
          prismaTransaction
        );
      }

      // Reverse efek inventory lama (stok, batch, cogs, product update)
      await this.reversePurchaseEffects(
        purchaseDetails,
        setting,
        prismaTransaction
      );

      // Hapus purchase details, journal entries, journal, dan purchase
      await purchaseDetailRepository.deleteByPurchaseId(
        purchaseId,
        prismaTransaction
      );

      await journalEntryRepository.deleteByJournalId(
        journal.journalId,
        prismaTransaction
      );

      await journalRepository.deleteJournal(
        journal.journalId,
        prismaTransaction
      );
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

  async getPurchase(
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
}

export const purchaseService = new PurchaseService();
