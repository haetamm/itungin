import { vatService } from './vatService';
import { prismaClient } from '../application/database';
import { ResponseError } from '../entities/responseError';
import { productRepository } from '../repository/productRepository';
import {
  SaleDetailForm,
  SaleRequest,
  UpdateSaleRequest,
} from '../utils/interface';
import { saleSchema, updateSaleSchema } from '../validation/saleValidation';
import { validate } from '../validation/validation';
import { journalRepository } from '../repository/journalRepository';
import { saleRepository } from '../repository/saleRepository';
import { inventoryBatchRepository } from '../repository/inventoryBatchRepository';
import { saleDetailRepository } from '../repository/saleDetailRepository';
import { journalEntryRepository } from '../repository/journalEntryRepository';
import { receivableRepository } from '../repository/receivableRepository';
import { accountRepository } from '../repository/accountRepository';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentStatus, PaymentType, Prisma, Sale } from '@prisma/client';
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

  async validateBatchDates(
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

  async validateReceivableForModification(
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

  async getSale(saleId: string, prismaTransaction: Prisma.TransactionClient) {
    const sale = await saleRepository.getSaleByIdTransaction(
      saleId,
      prismaTransaction
    );
    if (!sale) throw new ResponseError(404, 'Sale not found');
    return sale;
  }

  async createSales({ body }: { body: SaleRequest }) {
    const saleReq = validate(saleSchema, body);
    const {
      date,
      customerId,
      invoiceNumber,
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

        // ✅ Validasi HANYA batch yang akan digunakan
        await this.validateBatchDates(
          batches,
          new Date(date),
          item.productId,
          item.quantity // Quantity yang dibutuhkan
        );

        let remainingToDeduct = item.quantity;
        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;

          // ✅ Skip batch yang tidak valid
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

        // ✅ Double check: pastikan semua quantity terpenuhi
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

      //= Validasi cash / credit / mixed=
      let cash: Decimal | null = null;
      if (paymentType === 'CASH') {
        cash = total;
      } else if (paymentType === 'MIXED') {
        if (cashAmount === undefined || cashAmount === null)
          throw new ResponseError(
            400,
            'Cash amount is required for MIXED payment'
          );
        cash = new Decimal(cashAmount);
        if (cash.comparedTo(total) >= 0)
          throw new ResponseError(
            400,
            'Cash amount must be less than total for mixed payment'
          );
      }

      // buat journal header
      const journal = await journalRepository.createJournal(
        {
          date,
          description: `Penjualan ${paymentType.toLowerCase()} ${invoiceNumber}`,
          reference: invoiceNumber,
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

      if (paymentType === 'CASH') {
        journalEntries.push({
          accountId: cashAccount.accountId,
          debit: total,
          credit: new Decimal(0),
        });
      } else if (paymentType === 'CREDIT') {
        journalEntries.push({
          accountId: receivableAccount.accountId,
          debit: total,
          credit: new Decimal(0),
        });
      } else if (paymentType === 'MIXED') {
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
          (paymentType === 'CREDIT' || paymentType === 'MIXED') &&
          je.accountId === receivableAccount.accountId
        ) {
          receivableJournalEntryId = createdJE.journalEntryId;
        }
      }

      // Buat receivable
      if (paymentType === 'CREDIT' || paymentType === 'MIXED') {
        const receivableAmount =
          paymentType === 'CREDIT' ? total : total.minus(cash!);

        if (!receivableJournalEntryId)
          throw new ResponseError(400, 'Receivable journal entry id not found');

        await receivableRepository.createReceivable(
          {
            journalEntryId: receivableJournalEntryId,
            status: PaymentStatus.UNPAID,
            customerId,
            saleId: sale.saleId,
            amount: receivableAmount,
            dueDate: new Date(dueDate!),
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

      if (paymentType === 'CASH') {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.plus(total),
          },
          prismaTransaction
        );
      } else if (paymentType === 'CREDIT') {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: receivableAccount.accountCode,
            balance: receivableAccount.balance.plus(total),
          },
          prismaTransaction
        );
      } else if (paymentType === 'MIXED') {
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

  async deleteSale(saleId: string): Promise<void> {
    return await prismaClient.$transaction(async (prismaTransaction) => {
      // ambil sale beserta data relasinya
      const sale = await this.getSale(saleId, prismaTransaction);

      // Ambil account default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);

      // Ambil setting inventory method
      const setting =
        await generalsettingService.getSettingInventory(prismaTransaction);

      const {
        cashAccount,
        receivableAccount,
        inventoryAccount,
        salesAccount,
        vatOutputAccount,
        costOfGoodsSoldAccount,
      } = accountDefault;

      // Ambil journal entries
      const journalEntries = sale.journal.journalEntries;
      const { receivable } = sale;

      // Inisialisasi variabel untuk menyimpan nilai debit/kredit
      let salesCredit = new Decimal(0);
      let vatCredit = new Decimal(0);
      let cogsDebit = new Decimal(0);
      let inventoryCredit = new Decimal(0);
      let cashDebit = new Decimal(0);
      let receivableDebit = new Decimal(0);

      // Ambil nilai dari journal entries
      for (const entry of journalEntries) {
        if (entry.accountId === salesAccount.accountId) {
          salesCredit = entry.credit;
        } else if (entry.accountId === vatOutputAccount.accountId) {
          vatCredit = entry.credit;
        } else if (entry.accountId === costOfGoodsSoldAccount.accountId) {
          cogsDebit = entry.debit;
        } else if (entry.accountId === inventoryAccount.accountId) {
          inventoryCredit = entry.credit;
        } else if (entry.accountId === cashAccount.accountId) {
          cashDebit = entry.debit;
        } else if (entry.accountId === receivableAccount.accountId) {
          receivableDebit = entry.debit;
        }
      }

      // Validasi payment type dan receivable
      await this.validateReceivableForModification(
        sale.paymentType,
        receivable,
        prismaTransaction,
        'delete'
      );

      // Validasi apakah ada pembelian baru untuk produk dalam sale (sale detail)
      for (const detail of sale.saleDetails) {
        const subsequentPurchases =
          await purchaseRepository.findSubsequentPurchases(
            detail.productId,
            sale.date,
            prismaTransaction
          );

        if (subsequentPurchases.length > 0) {
          throw new ResponseError(
            400,
            `Cannot delete sale due to subsequent purchases of the same product.  Please process a sales return instead`
          );
        }
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

      // Update saldo akun (membalikkan efek createSale)
      await accountRepository.updateAccountTransaction(
        {
          accountCode: inventoryAccount.accountCode,
          balance: inventoryAccount.balance.plus(inventoryCredit),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: costOfGoodsSoldAccount.accountCode,
          balance: costOfGoodsSoldAccount.balance.minus(cogsDebit),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: salesAccount.accountCode,
          balance: salesAccount.balance.minus(salesCredit),
        },
        prismaTransaction
      );

      await accountRepository.updateAccountTransaction(
        {
          accountCode: vatOutputAccount.accountCode,
          balance: vatOutputAccount.balance.minus(vatCredit),
        },
        prismaTransaction
      );

      if (sale.paymentType === PaymentType.CASH && cashDebit.greaterThan(0)) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: cashAccount.accountCode,
            balance: cashAccount.balance.minus(cashDebit),
          },
          prismaTransaction
        );
      }

      if (
        (sale.paymentType === PaymentType.CREDIT ||
          sale.paymentType === PaymentType.MIXED) &&
        receivableDebit.greaterThan(0)
      ) {
        await accountRepository.updateAccountTransaction(
          {
            accountCode: receivableAccount.accountCode,
            balance: receivableAccount.balance.minus(receivableDebit),
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

  async updateSale(
    { body }: { body: UpdateSaleRequest },
    saleId: string
  ): Promise<Sale> {
    const saleReq = validate(updateSaleSchema, body);
    const {
      date,
      customerId,
      invoiceNumber,
      paymentType,
      cashAmount,
      dueDate,
    } = saleReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil setting inventory method
      const setting =
        await generalsettingService.getSettingInventory(prismaTransaction);

      // Validasi customer
      await customerService.getCustomer(customerId, prismaTransaction);

      // Ambil akun default
      const accountDefault =
        await accountService.getAccountDefault(prismaTransaction);

      let { cashAccount, receivableAccount } = accountDefault;

      // Ambil data penjualan existing beserta relasinya
      const existingSale = await this.getSale(saleId, prismaTransaction);

      const {
        journalId,
        paymentType: oldPaymentType,
        invoiceNumber: oldInvoiceNumber,
        total,
        receivable,
        journal,
        saleDetails,
      } = existingSale;

      // Validasi nomor invoice unik
      if (invoiceNumber !== oldInvoiceNumber) {
        await this.ensureInvoiceNumberUnique(invoiceNumber, prismaTransaction);
      }

      for (const detail of saleDetails) {
        // Ambil batch sesuai metode (AVG, FIFO, LIFO)
        const batches = await inventoryBatchRepository.findBatchesForProduct(
          detail.productId,
          setting.inventoryMethod,
          prismaTransaction
        );

        // ✅ Validasi tanggal batch vs tanggal penjualan
        await this.validateBatchDates(
          batches,
          new Date(date),
          detail.productId,
          detail.quantity
        );
      }

      // Validasi cash amount untuk MIXED payment
      let cash: Decimal | null = null;
      if (paymentType === PaymentType.MIXED) {
        cash = new Decimal(cashAmount!);
        if (cash.gte(total)) {
          throw new ResponseError(
            400,
            `Cash amount ${cash} must be less than total ${total} for MIXED payment`
          );
        }
      }

      // Validasi payment type dan receivable
      await this.validateReceivableForModification(
        oldPaymentType,
        receivable,
        prismaTransaction,
        'update'
      );

      // Update tabel sales
      const sale = await saleRepository.updateSaleTransaction(
        {
          saleId,
          date: new Date(date),
          customerId,
          invoiceNumber,
          paymentType,
        },
        prismaTransaction
      );

      // Update header jurnal
      await journalRepository.updateJournalTransaction(
        {
          journalId: journalId,
          date: new Date(date),
          description: `Penjualan ${paymentType.toLowerCase()} ${invoiceNumber}`,
          reference: invoiceNumber,
        },
        prismaTransaction
      );

      // Update Receivable
      let receivableJournalEntryId: string | null = null;
      if (
        paymentType === PaymentType.CREDIT ||
        paymentType === PaymentType.MIXED
      ) {
        const receivableAmount =
          paymentType === PaymentType.CREDIT
            ? new Decimal(total)
            : new Decimal(total).minus(cashAmount!);

        if (receivable) {
          // journal entry yang sudah ada
          await journalEntryRepository.updateJournalEntryAmounts(
            {
              journalEntryId: receivable.journalEntryId,
              debit: receivableAmount,
              credit: new Decimal(0),
            },
            prismaTransaction
          );
          receivableJournalEntryId = receivable.journalEntryId;

          // perbarui data receivable
          await receivableRepository.updateByReceivableId(
            {
              receivableId: receivable.receivableId,
              customerId,
              amount: receivableAmount,
              dueDate: new Date(dueDate!),
              status: PaymentStatus.UNPAID,
            },
            prismaTransaction
          );
        } else {
          // Buat receivable baru jika sebelumnya tidak ada
          const journalEntry =
            await journalEntryRepository.createJournalEntries(
              {
                journalId: journalId,
                accountId: receivableAccount.accountId,
                debit: receivableAmount,
                credit: new Decimal(0),
              },
              prismaTransaction
            );
          receivableJournalEntryId = journalEntry.journalEntryId;

          // buat receivable baru
          await receivableRepository.createReceivable(
            {
              journalEntryId: receivableJournalEntryId,
              customerId,
              saleId,
              amount: receivableAmount,
              dueDate: new Date(dueDate!),
              status: PaymentStatus.UNPAID,
            },
            prismaTransaction
          );
        }
      } else if (paymentType === PaymentType.CASH && receivable) {
        // Hapus receivable jika beralih ke CASH
        await receivableRepository.deleteReceivable(
          receivable.receivableId,
          prismaTransaction
        );

        await journalEntryRepository.deleteJournalEntriesByIds(
          [receivable.journalEntryId],
          prismaTransaction
        );
      }

      // Update Journal Entries untuk pembayaran
      if (oldPaymentType !== paymentType) {
        // Hapus journal entries lama terkait pembayaran (kas atau receivable)
        const paymentEntries = journal.journalEntries.filter(
          (entry) =>
            entry.accountId === cashAccount.accountId ||
            (entry.accountId === receivableAccount.accountId &&
              entry.journalEntryId !== receivableJournalEntryId)
        );
        const paymentEntryIds = paymentEntries.map((e) => e.journalEntryId);

        await journalEntryRepository.deleteJournalEntriesByIds(
          paymentEntryIds,
          prismaTransaction
        );

        // Buat journal entries baru sesuai tipe pembayaran
        if (paymentType === PaymentType.CASH) {
          await journalEntryRepository.createJournalEntries(
            {
              journalId: journal.journalId,
              accountId: cashAccount.accountId,
              debit: new Decimal(total),
              credit: new Decimal(0),
            },
            prismaTransaction
          );
        } else if (paymentType === PaymentType.MIXED) {
          await journalEntryRepository.createJournalEntries(
            {
              journalId: journal.journalId,
              accountId: cashAccount.accountId,
              debit: cashAmount!,
              credit: new Decimal(0),
            },
            prismaTransaction
          );
        }
      }

      // Update Saldo Akun
      if (oldPaymentType !== paymentType) {
        let oldReceivableAmount = new Decimal(0);

        // Batalkan saldo lama
        if (oldPaymentType === PaymentType.CASH) {
          const updatedCashAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: cashAccount.accountCode,
                balance: cashAccount.balance.minus(total),
              },
              prismaTransaction
            );

          cashAccount = { ...cashAccount, balance: updatedCashAccount.balance };
        } else if (oldPaymentType === PaymentType.CREDIT) {
          oldReceivableAmount = total;
          const updatedReceivableAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: receivableAccount.accountCode,
                balance: receivableAccount.balance.minus(total),
              },
              prismaTransaction
            );

          receivableAccount = {
            ...receivableAccount,
            balance: updatedReceivableAccount.balance,
          };
        } else if (oldPaymentType === PaymentType.MIXED) {
          const oldCashEntry = journal.journalEntries.find(
            (e) => e.accountId === cashAccount.accountId
          );
          const oldCashAmount = oldCashEntry
            ? new Decimal(oldCashEntry.debit)
            : new Decimal(0);
          oldReceivableAmount = new Decimal(total).minus(oldCashAmount);

          const updatedCashAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: cashAccount.accountCode,
                balance: cashAccount.balance.minus(oldCashAmount),
              },
              prismaTransaction
            );

          cashAccount = { ...cashAccount, balance: updatedCashAccount.balance };

          const updatedReceivableAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: receivableAccount.accountCode,
                balance: receivableAccount.balance.minus(oldReceivableAmount),
              },
              prismaTransaction
            );

          receivableAccount = {
            ...receivableAccount,
            balance: updatedReceivableAccount.balance,
          };
        }

        // Terapkan saldo baru
        if (paymentType === PaymentType.CASH) {
          const updatedCashAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: cashAccount.accountCode,
                balance: cashAccount.balance.plus(total),
              },
              prismaTransaction
            );

          cashAccount = { ...cashAccount, balance: updatedCashAccount.balance };
        } else if (paymentType === PaymentType.CREDIT) {
          const updatedReceivableAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: receivableAccount.accountCode,
                balance: receivableAccount.balance.plus(total),
              },
              prismaTransaction
            );

          receivableAccount = {
            ...receivableAccount,
            balance: updatedReceivableAccount.balance,
          };
        } else if (paymentType === PaymentType.MIXED) {
          const newReceivableAmount = new Decimal(total).minus(cashAmount!);

          const updatedCashAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: cashAccount.accountCode,
                balance: cashAccount.balance.plus(cashAmount!),
              },
              prismaTransaction
            );

          const updatedReceivableAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: receivableAccount.accountCode,
                balance: receivableAccount.balance.plus(newReceivableAmount),
              },
              prismaTransaction
            );

          cashAccount = { ...cashAccount, balance: updatedCashAccount.balance };

          receivableAccount = {
            ...receivableAccount,
            balance: updatedReceivableAccount.balance,
          };
        }

        // Validasi saldo Receivable
        const totalReceivables =
          await receivableRepository.getTotalReceivables(prismaTransaction);
        const expectedReceivableBalance = new Decimal(totalReceivables || 0);
        if (!receivableAccount.balance.equals(expectedReceivableBalance)) {
          throw new ResponseError(
            400,
            `Accounts Receivable balance mismatch: expected ${expectedReceivableBalance.toString()}, but got ${receivableAccount.balance.toString()}`
          );
        }
      }

      return sale;
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
