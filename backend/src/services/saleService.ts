import { vatService } from './vatService';
import { prismaClient } from '../application/database';
import { ResponseError } from '../entities/responseError';
import { productRepository } from '../repository/productRepository';
import {
  JournalEntryForm,
  SaleDetailForm,
  SaleRequest,
} from '../utils/interface';
import { saleSchema } from '../validation/saleValidation';
import { validate } from '../validation/validation';
import { journalRepository } from '../repository/journalRepository';
import { saleRepository } from '../repository/saleRepository';
import { inventoryBatchRepository } from '../repository/inventoryBatchRepository';
import { saleDetailRepository } from '../repository/saleDetailRepository';
import { journalEntryRepository } from '../repository/journalEntryRepository';
import { receivableRepository } from '../repository/receivableRepository';
import { accountRepository } from '../repository/accountRepository';
import { Decimal } from '@prisma/client/runtime/library';
import {
  EntryType,
  PaymentStatus,
  PaymentType,
  Prisma,
  Sale,
  SaleDetail,
} from '@prisma/client';
import { recalculateCOGS } from '../utils/cogs';
import { purchaseRepository } from '../repository/purchaseRepository';
import { receivablePaymentRepository } from '../repository/receivablePaymentRepository';
import { accountService } from './accountService';
import { generalsettingService } from './generalSettingService';
import { customerService } from './customerService';
import { productService } from './productService';

export class SaleService {
  private async ensureInvoiceNumberUnique(
    invoiceNumber: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const existing = await saleRepository.findInvoiceNumber(
      invoiceNumber,
      prismaTransaction
    );

    if (existing) {
      throw new ResponseError(400, 'Invoice number already exists');
    }
  }

  private async validateBatchDates(
    batches: { purchaseDate: Date; remainingStock: number }[],
    saleDate: Date,
    productId: string,
    neededQuantity: number
  ) {
    let remainingQty = neededQuantity;

    for (const batch of batches) {
      if (remainingQty <= 0) break;

      // Hanya validasi batch yang akan digunakan
      if (batch.purchaseDate > saleDate) {
        throw new ResponseError(
          400,
          `Invalid sale date for product ${productId}: sale date (${saleDate.toISOString().split('T')[0]}) must be after batch purchase date (${batch.purchaseDate.toISOString().split('T')[0]})`
        );
      }

      // Kurangi quantity yang sudah divalidasi
      const useQty = Math.min(batch.remainingStock, remainingQty);
      remainingQty -= useQty;
    }

    // Cek jika masih ada sisa yang butuh validasi
    if (remainingQty > 0) {
      throw new ResponseError(
        400,
        `Insufficient valid batches for product ${productId}. Need ${neededQuantity} units but only ${neededQuantity - remainingQty} available from batches with valid dates`
      );
    }
  }

  private async validateSalesReceivableStatus(
    paymentType: PaymentType,
    receivable: any | null,
    prismaTransaction: Prisma.TransactionClient,
    action: 'delete' | 'update'
  ) {
    if (
      paymentType === PaymentType.CREDIT ||
      paymentType === PaymentType.MIXED
    ) {
      if (receivable) {
        const payments =
          await receivablePaymentRepository.getPaymentReceivableByReceivableId(
            receivable.receivableId,
            prismaTransaction
          );

        if (payments.length > 0) {
          throw new ResponseError(
            400,
            `Cannot ${action} sale with associated payments for receivable ${receivable.receivableId}. Please process a sales return instead`
          );
        }

        if (receivable.status === PaymentStatus.PAID) {
          throw new ResponseError(
            400,
            `Cannot ${action} sale with paid receivable ${receivable.receivableId}. Please process a sales return instead`
          );
        }
      }
    }
  }

  private async validateSaleProductChronology(
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
          `Cannot modify sale because there are subsequent purchases of product ${detail.productId}. Please process a sales return instead.`
        );
      }
    }
  }

  async getSale(saleId: string, prismaTransaction: Prisma.TransactionClient) {
    const sale = await saleRepository.getSaleByIdTransaction(
      saleId,
      prismaTransaction
    );
    if (!sale) throw new ResponseError(404, 'Sale not found');
    return sale;
  }

  async createSales(body: SaleRequest) {
    const saleReq = validate(saleSchema, body);
    const {
      date,
      customerId,
      invoiceNumber,
      receiveVoucher,
      vatRateId,
      items,
      paymentType,
      cashAmount,
      dueDate,
    } = saleReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil akun default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);

      const {
        cashAccount,
        receivableAccount,
        inventoryAccount,
        salesAccount,
        vatOutputAccount,
        costOfGoodsSoldAccount,
      } = accountDefault;

      await this.ensureInvoiceNumberUnique(invoiceNumber, prismaTransaction);

      // Ambil inventory method (AVG / FIFO / LIFO)
      const setting =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // Validasi customer
      await customerService.getCustomer(customerId, prismaTransaction);

      // Validasi VAT (Pajak)
      const vatSetting = await vatService.getVatSetting(
        vatRateId,
        prismaTransaction,
        new Date(date)
      );

      // Hitung subtotal & COGS
      let subtotal = new Decimal(0);
      let cogs = new Decimal(0);
      const saleDetailsData: SaleDetailForm[] = [];

      for (const item of items) {
        // ambil product
        const product = await productService.getProduct(
          item.productId,
          prismaTransaction
        );

        // Validasi stok
        if (product.stock < item.quantity) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${product.productName}, only ${product.stock} available`
          );
        }

        const unitPrice = new Decimal(product.sellingPrice);
        let itemCogs = new Decimal(0);
        const batchAssignments: {
          batchId: string;
          quantity: number;
          purchasePrice: Decimal;
        }[] = [];

        // Ambil batch sesuai metode (AVG, FIFO, LIFO)
        const batches = await inventoryBatchRepository.findBatchesForProduct(
          item.productId,
          setting.inventoryMethod,
          prismaTransaction
        );

        const totalAvailable = batches.reduce(
          (sum, b) => sum + b.remainingStock,
          0
        );

        if (totalAvailable < item.quantity) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${product.productName}, only ${product.stock} available`
          );
        }

        // Validasi HANYA batch yang akan digunakan
        await this.validateBatchDates(
          batches,
          new Date(date),
          item.productId,
          item.quantity // Quantity yang dibutuhkan
        );

        let remainingToDeduct = item.quantity;
        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;

          // Skip batch yang tidak valid
          if (batch.purchaseDate > new Date(date)) {
            continue;
          }

          const deduct = Math.min(batch.remainingStock, remainingToDeduct);

          await inventoryBatchRepository.decrementBatchStock(
            batch.batchId,
            deduct,
            prismaTransaction
          );

          batchAssignments.push({
            batchId: batch.batchId,
            quantity: deduct,
            purchasePrice: new Decimal(batch.purchasePrice),
          });

          itemCogs = itemCogs.plus(
            new Decimal(deduct).times(batch.purchasePrice)
          );
          remainingToDeduct -= deduct;
        }

        // Double check: pastikan semua quantity terpenuhi
        if (remainingToDeduct > 0) {
          throw new ResponseError(
            400,
            `Unexpected error: Unable to fulfill quantity for product ${product.productName}`
          );
        }

        cogs = cogs.plus(itemCogs);

        await productRepository.decrementStock(
          item.productId,
          item.quantity,
          prismaTransaction
        );

        const itemSubtotal = new Decimal(item.quantity).times(unitPrice);
        subtotal = subtotal.plus(itemSubtotal);

        batchAssignments.forEach((a) => {
          saleDetailsData.push({
            saleId: '',
            productId: item.productId,
            batchId: a.batchId,
            quantity: a.quantity,
            unitPrice,
            subtotal: new Decimal(a.quantity).times(unitPrice),
          });
        });
      }

      // Hitung pajak & total
      const vat = subtotal.times(vatSetting.vatRate).div(100);
      const total = subtotal.plus(vat);

      // Validasi cash / credit / mixed=
      let cash: Decimal | null = null;
      if (paymentType === PaymentType.CASH) {
        cash = total;
      } else if (paymentType === PaymentType.MIXED) {
        cash = new Decimal(cashAmount!);
        if (cash.comparedTo(total) >= 0)
          throw new ResponseError(
            400,
            `Cash amount ${cash} must be less than total ${total} for MIXED payment`
          );
      }

      // buat journal header
      const journal = await journalRepository.createJournal(
        {
          date,
          description: `Penjualan ${paymentType.toLowerCase()} ${invoiceNumber} (diperbarui ${new Date().toISOString().split('T')[0]})`,
          reference: invoiceNumber,
          paymentReference: receiveVoucher,
        },
        prismaTransaction
      );

      // buat penjualan
      const sale = await saleRepository.createSale(
        {
          date,
          customerId,
          journalId: journal.journalId,
          invoiceNumber,
          paymentType,
          subtotal,
          vat,
          total,
        },
        prismaTransaction
      );

      saleDetailsData.forEach((d) => (d.saleId = sale.saleId));
      for (const detail of saleDetailsData) {
        await saleDetailRepository.createSaleDetail(detail, prismaTransaction);
      }

      // Buat journal entries
      let receivableJournalEntryId: string | null = null;
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
      ];

      if (paymentType === PaymentType.CASH) {
        journalEntries.push({
          accountId: cashAccount.accountId,
          debit: total,
          credit: new Decimal(0),
        });
      } else if (paymentType === PaymentType.CREDIT) {
        journalEntries.push({
          accountId: receivableAccount.accountId,
          debit: total,
          credit: new Decimal(0),
        });
      } else if (paymentType === PaymentType.MIXED) {
        journalEntries.push(
          {
            accountId: cashAccount.accountId,
            debit: cash!,
            credit: new Decimal(0),
          },
          {
            accountId: receivableAccount.accountId,
            debit: total.minus(cash!),
            credit: new Decimal(0),
          }
        );
      }

      for (const je of journalEntries) {
        const createdJE = await journalEntryRepository.createJournalEntries(
          {
            journalId: journal.journalId,
            accountId: je.accountId,
            debit: je.debit,
            credit: je.credit,
          },
          prismaTransaction
        );

        if (
          (paymentType === PaymentType.CREDIT ||
            paymentType === PaymentType.MIXED) &&
          je.accountId === receivableAccount.accountId
        ) {
          receivableJournalEntryId = createdJE.journalEntryId;
        }
      }
      const status =
        paymentType === PaymentType.CREDIT
          ? PaymentStatus.UNPAID
          : PaymentStatus.PARTIAL;

      // Buat receivable
      if (
        paymentType === PaymentType.CREDIT ||
        paymentType === PaymentType.MIXED
      ) {
        const receivableAmount =
          paymentType === PaymentType.CREDIT ? total : total.minus(cash!);

        if (!receivableJournalEntryId)
          throw new ResponseError(400, 'Receivable journal entry id not found');

        await receivableRepository.createReceivable(
          {
            journalEntryId: receivableJournalEntryId,
            customerId,
            saleId: sale.saleId,
            amount: receivableAmount,
            remainingAmount: receivableAmount,
            dueDate: new Date(dueDate!),
            status,
          },
          prismaTransaction
        );
      }

      // Update saldo akun
      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccount.accountCode,
          balance: inventoryAccount.balance.minus(cogs),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: costOfGoodsSoldAccount.accountCode,
          balance: costOfGoodsSoldAccount.balance.plus(cogs),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: salesAccount.accountCode,
          balance: salesAccount.balance.plus(subtotal),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: vatOutputAccount.accountCode,
          balance: vatOutputAccount.balance.plus(vat),
        },
        prismaTransaction
      );

      if (paymentType === PaymentType.CASH) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.plus(total),
          },
          prismaTransaction
        );
      } else if (paymentType === PaymentType.CREDIT) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: receivableAccount.accountCode,
            balance: receivableAccount.balance.plus(total),
          },
          prismaTransaction
        );
      } else if (paymentType === PaymentType.MIXED) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.plus(cash!),
          },
          prismaTransaction
        );

        await accountRepository.updateAccountTransaction(
          {
            accountCode: receivableAccount.accountCode,
            balance: receivableAccount.balance.plus(total.minus(cash!)),
          },
          prismaTransaction
        );
      }

      return sale;
    });
  }

  async updateSale(body: SaleRequest, saleId: string): Promise<Sale> {
    const saleReq = validate(saleSchema, body);
    const {
      date,
      customerId,
      invoiceNumber,
      receiveVoucher,
      vatRateId,
      items,
      paymentType,
      cashAmount,
      dueDate,
    } = saleReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil setting inventory method
      const setting =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // Validasi tarif VAT
      const vatSetting = await vatService.getVatSetting(
        vatRateId,
        prismaTransaction,
        new Date(date)
      );

      // Validasi customer
      await customerService.getCustomer(customerId, prismaTransaction);

      // Ambil akun default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      let {
        cashAccount,
        receivableAccount,
        inventoryAccount,
        salesAccount,
        vatOutputAccount,
        costOfGoodsSoldAccount,
      } = accountDefault;

      // Ambil data penjualan existing beserta relasinya
      const existingSale = await this.getSale(saleId, prismaTransaction);

      const {
        journalId,
        paymentType: oldPaymentType,
        invoiceNumber: oldInvoiceNumber,
        receivable,
        journal,
        saleDetails,
      } = existingSale;

      // Validasi nomor invoice unik
      if (invoiceNumber !== oldInvoiceNumber) {
        await this.ensureInvoiceNumberUnique(invoiceNumber, prismaTransaction);
      }

      // Validasi payment type dan receivable
      await this.validateSalesReceivableStatus(
        oldPaymentType,
        receivable,
        prismaTransaction,
        'update'
      );

      // Validasi apakah ada pembelian baru untuk produk dalam sale (sale detail)
      await this.validateSaleProductChronology(
        saleDetails,
        existingSale.date,
        prismaTransaction
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

        let balanceAdjustment = new Decimal(0);

        // Jika akun normalnya DEBIT, pembalikan = -debit + credit
        if (account.normalBalance === EntryType.DEBIT) {
          balanceAdjustment = new Decimal(0)
            .minus(entry.debit)
            .plus(entry.credit);
        }
        // Jika akun normalnya CREDIT, pembalikan = +debit - credit
        else if (account.normalBalance === EntryType.CREDIT) {
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

      // Kembalikan stok lama dari saleDetails
      for (const detail of saleDetails) {
        // ambil product
        await productService.getProduct(detail.productId, prismaTransaction);

        await productRepository.incrementStock(
          detail.productId,
          detail.quantity,
          prismaTransaction
        );

        if (detail.batchId) {
          await inventoryBatchRepository.incrementBatchStock(
            detail.batchId,
            detail.quantity,
            prismaTransaction
          );
        }
      }

      // Hapus saleDetails lama
      await saleDetailRepository.deleteBySaleId(saleId, prismaTransaction);

      // Hapus receivable lama (jika ada) untuk menghindari foreign key constraint
      if (existingSale.receivable) {
        await receivableRepository.deleteReceivable(
          existingSale.receivable.receivableId,
          prismaTransaction
        );
      }

      // Hapus journal entries lama
      await journalEntryRepository.deleteByJournalId(
        journalId,
        prismaTransaction
      );

      // Hitung ulang subtotal, COGS, VAT, dan total berdasarkan items baru
      let subtotal = new Decimal(0);
      let cogs = new Decimal(0);
      const saleDetailsData: SaleDetailForm[] = [];

      for (const item of items) {
        // ambil product
        const product = await productService.getProduct(
          item.productId,
          prismaTransaction
        );

        // Validasi stok
        if (product.stock < item.quantity) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${product.productName}, only ${product.stock} available`
          );
        }

        const unitPrice = product.sellingPrice;
        let itemCogs = new Decimal(0);
        const batchAssignments: {
          batchId: string;
          quantity: number;
          purchasePrice: Decimal;
        }[] = [];

        // Ambil batch sesuai metode (AVG, FIFO, LIFO)
        const batches = await inventoryBatchRepository.findBatchesForProduct(
          item.productId,
          setting.inventoryMethod,
          prismaTransaction
        );

        const totalAvailable = batches.reduce(
          (sum, b) => sum + b.remainingStock,
          0
        );

        if (totalAvailable < item.quantity) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${product.productName}, only ${totalAvailable} available`
          );
        }

        // Validasi tanggal batch
        await this.validateBatchDates(
          batches,
          new Date(date),
          item.productId,
          item.quantity
        );

        let remainingToDeduct = item.quantity;
        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;

          if (batch.purchaseDate > new Date(date)) {
            continue;
          }

          const deduct = Math.min(batch.remainingStock, remainingToDeduct);

          await inventoryBatchRepository.decrementBatchStock(
            batch.batchId,
            deduct,
            prismaTransaction
          );

          batchAssignments.push({
            batchId: batch.batchId,
            quantity: deduct,
            purchasePrice: new Decimal(batch.purchasePrice),
          });

          itemCogs = itemCogs.plus(
            new Decimal(deduct).times(batch.purchasePrice)
          );
          remainingToDeduct -= deduct;
        }

        if (remainingToDeduct > 0) {
          throw new ResponseError(
            400,
            `Unable to fulfill quantity for product ${product.productName}`
          );
        }

        cogs = cogs.plus(itemCogs);

        await productRepository.decrementStock(
          item.productId,
          item.quantity,
          prismaTransaction
        );

        const itemSubtotal = new Decimal(item.quantity).times(unitPrice);
        subtotal = subtotal.plus(itemSubtotal);

        batchAssignments.forEach((a) => {
          saleDetailsData.push({
            saleId,
            productId: item.productId,
            batchId: a.batchId,
            quantity: a.quantity,
            unitPrice,
            subtotal: new Decimal(a.quantity).times(unitPrice),
          });
        });
      }

      // Hitung pajak dan total
      const vat = subtotal.times(vatSetting.vatRate).div(100);
      const total = subtotal.plus(vat);

      // Validasi cash amount
      let cash: Decimal | null = null;
      if (paymentType === PaymentType.CASH) {
        cash = total;
      } else if (paymentType === PaymentType.MIXED) {
        cash = new Decimal(cashAmount!);
        if (cash.gte(total)) {
          throw new ResponseError(
            400,
            `Cash amount ${cash} must be less than total ${total} for MIXED payment`
          );
        }
      }

      // Update tabel sales
      const sale = await saleRepository.updateSaleTransaction(
        {
          saleId,
          date: new Date(date),
          customerId,
          invoiceNumber,
          paymentType,
          subtotal,
          vat,
          total,
        },
        prismaTransaction
      );

      // Buat sale details baru
      for (const detail of saleDetailsData) {
        await saleDetailRepository.createSaleDetail(detail, prismaTransaction);
      }

      // Update header jurnal
      await journalRepository.updateJournalTransaction(
        {
          journalId: journalId,
          date: new Date(date),
          description: `Penjualan ${paymentType.toLowerCase()} ${invoiceNumber} (diperbarui ${new Date().toISOString().split('T')[0]})`,
          reference: invoiceNumber,
          paymentReference: receiveVoucher ? receiveVoucher : null,
        },
        prismaTransaction
      );

      // Buat journal entries baru
      let receivableJournalEntryId: string | null = null;
      const journalEntries: JournalEntryForm[] = [
        {
          journalId: journalId,
          accountId: salesAccount.accountId,
          debit: new Decimal(0),
          credit: subtotal,
        },
        {
          journalId: journalId,
          accountId: vatOutputAccount.accountId,
          debit: new Decimal(0),
          credit: vat,
        },
        {
          journalId: journalId,
          accountId: costOfGoodsSoldAccount.accountId,
          debit: cogs,
          credit: new Decimal(0),
        },
        {
          journalId: journalId,
          accountId: inventoryAccount.accountId,
          debit: new Decimal(0),
          credit: cogs,
        },
      ];

      if (paymentType === PaymentType.CASH) {
        journalEntries.push({
          journalId: journalId,
          accountId: cashAccount.accountId,
          debit: total,
          credit: new Decimal(0),
        });
      } else if (paymentType === PaymentType.CREDIT) {
        journalEntries.push({
          journalId: journalId,
          accountId: receivableAccount.accountId,
          debit: total,
          credit: new Decimal(0),
        });
      } else if (paymentType === PaymentType.MIXED) {
        const cashValue = new Decimal(cashAmount!);
        journalEntries.push(
          {
            journalId: journalId,
            accountId: cashAccount.accountId,
            debit: cashValue,
            credit: new Decimal(0),
          },
          {
            journalId: journalId,
            accountId: receivableAccount.accountId,
            debit: total.minus(cashValue),
            credit: new Decimal(0),
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
          je.accountId === receivableAccount.accountId
        ) {
          receivableJournalEntryId = createdJE.journalEntryId;
        }
      }

      // Buat receivable baru jika diperlukan
      if (
        paymentType === PaymentType.CREDIT ||
        paymentType === PaymentType.MIXED
      ) {
        const receivableAmount =
          paymentType === PaymentType.CREDIT
            ? total
            : total.minus(new Decimal(cashAmount!));
        const status =
          paymentType === PaymentType.CREDIT
            ? PaymentStatus.UNPAID
            : PaymentStatus.PARTIAL;

        if (!receivableJournalEntryId) {
          throw new ResponseError(400, 'Receivable journal entry ID not found');
        }

        await receivableRepository.createReceivable(
          {
            journalEntryId: receivableJournalEntryId,
            customerId,
            saleId,
            amount: receivableAmount,
            remainingAmount: receivableAmount,
            dueDate: new Date(dueDate || date),
            status,
          },
          prismaTransaction
        );
      }

      // Ambil akun default lagi untuk saldo terbaru
      const updatedAccountDefault =
        await accountService.getAccountDefault(prismaTransaction);
      const {
        cashAccount: updatedCashAccount,
        receivableAccount: updatedReceivableAccount,
        inventoryAccount: updatedInventoryAccount,
        salesAccount: updatedSalesAccount,
        vatOutputAccount: updatedVatOutputAccount,
        costOfGoodsSoldAccount: updatedCostOfGoodsSoldAccount,
      } = updatedAccountDefault;

      // Update saldo akun
      const accountUpdates = [
        {
          accountCode: updatedInventoryAccount.accountCode,
          balance: updatedInventoryAccount.balance.minus(cogs),
        },
        {
          accountCode: updatedCostOfGoodsSoldAccount.accountCode,
          balance: updatedCostOfGoodsSoldAccount.balance.plus(cogs),
        },
        {
          accountCode: updatedSalesAccount.accountCode,
          balance: updatedSalesAccount.balance.plus(subtotal),
        },
        {
          accountCode: updatedVatOutputAccount.accountCode,
          balance: updatedVatOutputAccount.balance.plus(vat),
        },
      ];

      if (paymentType === PaymentType.CASH) {
        accountUpdates.push({
          accountCode: updatedCashAccount.accountCode,
          balance: updatedCashAccount.balance.plus(total),
        });
      } else if (paymentType === PaymentType.CREDIT) {
        accountUpdates.push({
          accountCode: updatedReceivableAccount.accountCode,
          balance: updatedReceivableAccount.balance.plus(total),
        });
      } else if (paymentType === PaymentType.MIXED) {
        const cashValue = new Decimal(cashAmount!);
        accountUpdates.push(
          {
            accountCode: updatedCashAccount.accountCode,
            balance: updatedCashAccount.balance.plus(cashValue),
          },
          {
            accountCode: updatedReceivableAccount.accountCode,
            balance: updatedReceivableAccount.balance.plus(
              total.minus(cashValue)
            ),
          }
        );
      }

      for (const update of accountUpdates) {
        await accountRepository.updateAccountTransaction(
          update,
          prismaTransaction
        );
      }

      return sale;
    });
  }

  async deleteSale(saleId: string): Promise<void> {
    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil setting inventory method
      const setting =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // ambil sale beserta data relasinya
      const sale = await this.getSale(saleId, prismaTransaction);

      // Ambil journal entries
      const { journal, receivable, saleDetails } = sale;
      const { journalEntries } = journal;

      // Validasi payment type dan receivable
      await this.validateSalesReceivableStatus(
        sale.paymentType,
        receivable,
        prismaTransaction,
        'delete'
      );

      // Validasi apakah ada pembelian baru untuk produk dalam sale (sale detail)
      await this.validateSaleProductChronology(
        saleDetails,
        sale.date,
        prismaTransaction
      );

      // Reverse efek akun lama berdasarkan journal entries
      for (const entry of journalEntries) {
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

        // Jika akun normalnya DEBIT, pembalikan = -debit + credit
        if (account.normalBalance === EntryType.DEBIT) {
          balanceAdjustment = new Decimal(0)
            .minus(entry.debit)
            .plus(entry.credit);
        }
        // Jika akun normalnya CREDIT, pembalikan = +debit - credit
        else if (account.normalBalance === EntryType.CREDIT) {
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

      // Revert stok produk dan batch
      for (const detail of sale.saleDetails) {
        // ambil product
        const product = await productService.getProduct(
          detail.productId,
          prismaTransaction
        );

        // Tambah kembali stok produk
        const newStock = product.stock + detail.quantity;

        // Update stok batch jika ada
        if (detail.batchId) {
          const batch = await inventoryBatchRepository.findBatchById(
            detail.batchId,
            prismaTransaction
          );
          if (!batch) {
            throw new ResponseError(404, `Batch ${detail.batchId} not found`);
          }

          await inventoryBatchRepository.incrementBatchStock(
            detail.batchId,
            detail.quantity,
            prismaTransaction
          );
        }

        // Hitung ulang harga pokok (COGS)
        const cogs = await recalculateCOGS(
          product.productId,
          setting.inventoryMethod,
          prismaTransaction
        );

        const sellingPrice = cogs.equals(0)
          ? product.profitMargin
          : cogs.plus(product.profitMargin);

        // Update stok dan harga produk
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

      // Hapus receivable terkait
      if (receivable) {
        await receivableRepository.deleteReceivable(
          receivable.receivableId,
          prismaTransaction
        );
      }

      // Hapus sale details
      await saleDetailRepository.deleteManySaleDetails(
        sale.saleDetails.map((detail) => detail.saleDetailId),
        prismaTransaction
      );

      // Hapus journal entries
      await journalEntryRepository.deleteManyJournalEntries(
        journalEntries.map((entry) => entry.journalEntryId),
        prismaTransaction
      );

      // Hapus journal
      await journalRepository.deleteJournal(
        sale.journal.journalId,
        prismaTransaction
      );
    });
  }

  async getAllSale(
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

    const { sales, total } = await saleRepository.getAllSale(
      page,
      limit,
      search,
      paymentType,
      from,
      to
    );

    return {
      sales,
      pagination: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
    };
  }

  async getSaleById(id: string) {
    const sale = await saleRepository.findSaleDetailById(id);
    if (!sale) throw new ResponseError(404, 'Sale not found');
    return sale;
  }
}

export const saleService = new SaleService();
