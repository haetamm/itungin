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
import { payableRepository } from '../repository/payableRepository';
import { recalculateCOGS } from '../utils/cogs';
import { saleDetailRepository } from '../repository/saleDetailRepository';
import { saleRepository } from '../repository/saleRepository';
import { generalsettingService } from './generalSettingService';
import { supplierService } from './supplierService';
import { vatService } from './vatService';
import { productService } from './productService';
import { accountService } from './accountService';
import { payablePaymentRepository } from '../repository/payablePaymentRepository';

export class PurchaseService {
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

  private async updatePurchaseDataRelation(
    data: UpdatePurchaseDataRelation,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<PurchaseResult> {
    const { date, supplierId, invoiceNumber, items, vatRateId, paymentType } =
      data;

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

  async deletePurchase(purchaseId: string): Promise<void> {
    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil purchase
      const purchase = await this.getPurchase(purchaseId, prismaTransaction);

      const { payable } = purchase;

      // Ambil account default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);

      const { cashAccount, payableAccount, inventoryAccount, vatInputAccount } =
        accountDefault;

      // Validasi apakah ada SaleDetail yang menggunakan batchId dari pembelian ini
      for (const detail of purchase.purchaseDetails) {
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
              `Cannot delete purchase because its inventory batch (ID: ${batch.batchId}) has been used in sales. Please process a purchase return instead.`
            );
          }
        }
      }

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

      // Validasi payment type dan payable
      if (
        purchase.paymentType === PaymentType.CREDIT ||
        purchase.paymentType === PaymentType.MIXED
      ) {
        if (payable) {
          // Periksa apakah ada Payment terkait payable
          const payments = await payablePaymentRepository.getPaymentByPayableId(
            payable.payableId,
            prismaTransaction
          );

          if (payments.length > 0) {
            throw new ResponseError(
              400,
              `Cannot delete purchase with associated payments for payable ${payable.payableId}.  Please process a purchase return instead`
            );
          }

          if (payable.status === PaymentStatus.PAID) {
            throw new ResponseError(
              400,
              `Cannot delete purchase with paid payable ${payable.payableId}.  Please process a purchase return instead`
            );
          }
        }
      }

      if (payable) {
        await payableRepository.deletePayable(
          payable.payableId,
          prismaTransaction
        );
      }

      // Ambil setting inventory method
      const setting =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // Revert product stock and delete inventory batches
      for (const detail of purchase.purchaseDetails) {
        const product = await productService.getProduct(
          detail.productId,
          prismaTransaction
        );

        const newStock = product.stock - detail.quantity;
        if (newStock < 0) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${product.productId}`
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

        // Hitung ulang harga pokok
        const cogs = await recalculateCOGS(
          product.productId,
          setting.inventoryMethod,
          prismaTransaction
        );

        const sellingPrice = cogs.equals(0)
          ? product.profitMargin
          : cogs.plus(product.profitMargin);

        // Update kembali produk
        await productRepository.updateProductTransaction(
          {
            productId: detail.productId,
            stock: newStock,
            avgPurchasePrice: cogs,
            profitMargin: product.profitMargin,
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

  async updatePurchase(
    { body }: { body: PurchaseRequest },
    purchaseId: string
  ): Promise<Purchase> {
    const purchaseReq = validate(purchaseSchema, body);
    const {
      date,
      supplierId,
      invoiceNumber,
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

      // Ambil data pembelian existing beserta relasinya
      const existingPurchase = await this.getPurchase(
        purchaseId,
        prismaTransaction
      );

      const { purchaseDetails, journal } = existingPurchase;

      // Validasi apakah tanggal pembelian baru tidak melanggar kronologi dengan sales
      for (const detail of purchaseDetails) {
        const inventoryBatches =
          await inventoryBatchRepository.findBatchesByPurchaseDetail(
            detail.purchaseDetailId,
            prismaTransaction
          );

        for (const batch of inventoryBatches) {
          const saleDetails = await saleDetailRepository.findSalesByBatchId(
            batch.batchId,
            prismaTransaction
          );

          for (const saleDetail of saleDetails) {
            const sale = await saleRepository.findSaleByIdTransaction(
              saleDetail.saleId,
              prismaTransaction
            );

            if (sale && new Date(date) > new Date(sale.date)) {
              const formattedPurchaseDate = new Date(date)
                .toISOString()
                .slice(0, 10);
              const formattedSaleDate = new Date(sale.date)
                .toISOString()
                .slice(0, 10);
              throw new ResponseError(
                400,
                `Invalid purchase date: new purchase date (${formattedPurchaseDate}) cannot be after sale date (${formattedSaleDate}) for product ${detail.productId}`
              );
            }
          }
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
          // Perbaikan: Ganti PaymentType.CREDIT dengan string 'CREDIT'
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

      // Kembalikan stok lama dari purchaseDetails
      for (const detail of purchaseDetails) {
        // validasi product
        await productService.getProduct(detail.productId, prismaTransaction);

        await productRepository.decrementStock(
          detail.productId,
          detail.quantity,
          prismaTransaction
        );

        const batch = await inventoryBatchRepository.findByPurchaseDetailId(
          detail.purchaseDetailId,
          prismaTransaction
        );

        if (batch) {
          await inventoryBatchRepository.decrementBatchStock(
            batch.batchId,
            detail.quantity,
            prismaTransaction
          );
        }
      }

      // Hapus purchase details lama
      await purchaseDetailRepository.deleteByPurchaseId(
        purchaseId,
        prismaTransaction
      );

      // **Perbaikan**: Hapus payable lama jika ada, sebelum menghapus journal entries
      if (existingPurchase.payable) {
        console.log(`Deleting existing payable for purchaseId: ${purchaseId}`);
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

      // Buat purchase details baru
      for (const detail of purchaseDetailsData) {
        const createdDetail =
          await purchaseDetailRepository.createPurchaseDetail(
            detail,
            prismaTransaction
          );

        // Update batch inventory untuk setiap detail pembelian
        await inventoryBatchRepository.createInventoryBatch(
          {
            productId: detail.productId,
            purchaseDate: new Date(date),
            quantity: detail.quantity,
            purchasePrice: detail.unitPrice,
            remainingStock: detail.quantity,
            purchaseDetailId: createdDetail.purchaseDetailId,
          },
          prismaTransaction
        );

        await productRepository.incrementStock(
          detail.productId,
          detail.quantity,
          prismaTransaction
        );
      }

      // Update header jurnal
      await journalRepository.updateJournalTransaction(
        {
          journalId: journal.journalId,
          date: new Date(date),
          description: `Pembelian ${paymentType.toLowerCase()} ${invoiceNumber} (diperbarui ${new Date().toISOString().split('T')[0]})`,
          reference: invoiceNumber,
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

      for (const je of journalEntries) {
        const createdJE = await journalEntryRepository.createJournalEntries(
          {
            journalId: je.journalId,
            accountId: je.accountId,
            debit: je.debit,
            credit: je.credit,
          },
          prismaTransaction
        );

        if (
          (paymentType === PaymentType.CREDIT ||
            paymentType === PaymentType.MIXED) &&
          je.accountId === payableAccount.accountId
        ) {
          payableJournalEntryId = createdJE.journalEntryId;
        }
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
        if (!supplierId) {
          throw new ResponseError(
            400,
            'Supplier ID is required for CREDIT or MIXED payment'
          );
        }
        if (!dueDate && paymentType === PaymentType.CREDIT) {
          throw new ResponseError(
            400,
            'Due date is required for CREDIT payment'
          );
        }

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
