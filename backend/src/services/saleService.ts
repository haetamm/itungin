import { prismaClient } from '../application/database';
import { ResponseError } from '../entities/responseError';
import { accountDefaultRepository } from '../repository/accountDefaultRepository';
import { customerRepository } from '../repository/customerRepository';
import { generalSettingRepository } from '../repository/generalSettingRepository';
import { productRepository } from '../repository/productRepository';
import { vatSettingRepository } from '../repository/vatSettingRepository';
import { SaleDetailForm, SaleRequest } from '../utils/interface';
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
import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';
import { recalculateCOGS } from '../utils/cogs';
import { purchaseRepository } from '../repository/purchaseRepository';

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
      const accountDefault =
        await accountDefaultRepository.findOne(prismaTransaction);
      if (!accountDefault)
        throw new ResponseError(404, 'Account not configured');

      const {
        cashAccount,
        receivableAccount,
        inventoryAccount,
        salesAccount,
        vatOutputAccount,
        costOfGoodsSoldAccount,
      } = accountDefault;

      await this.ensureInvoiceNumberUnique(invoiceNumber, prismaTransaction);

      // Ambil setting inventory method (AVG / FIFO / LIFO)
      const setting =
        await generalSettingRepository.getSettingTransaction(prismaTransaction);
      if (!setting)
        throw new ResponseError(400, 'Inventory method not configured');

      // Validasi customer
      const customer = await customerRepository.findCustomerTransaction(
        customerId,
        prismaTransaction
      );
      if (!customer) throw new ResponseError(404, 'Customer not found');

      // Validasi VAT (Pajak)
      const vatSetting = await vatSettingRepository.findVatTransaction(
        vatRateId,
        prismaTransaction
      );
      if (!vatSetting) throw new ResponseError(404, 'VAT rate not found');
      if (vatSetting.effectiveDate > new Date(date))
        throw new ResponseError(400, 'VAT rate not effective');

      // Hitung subtotal & COGS
      let subtotal = new Decimal(0);
      let cogs = new Decimal(0);
      const saleDetailsData: SaleDetailForm[] = [];

      for (const item of items) {
        const product = await productRepository.findProductTransaction(
          item.productId,
          prismaTransaction
        );

        if (!product)
          throw new ResponseError(404, `Product ${item.productId} not found`);

        // Validasi stok
        if (product.stock < item.quantity) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${product.productName}`
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

        // ✅ Validasi tanggal batch vs tanggal penjualan
        const saleDate = new Date(date);
        for (const batch of batches) {
          if (batch.purchaseDate > saleDate) {
            throw new ResponseError(
              400,
              `Invalid sale date for product ${item.productId}: sale date (${saleDate.toISOString().split('T')[0]}) must be after batch purchase date (${batch.purchaseDate.toISOString().split('T')[0]})`
            );
          }
        }

        const totalAvailable = batches.reduce(
          (sum, b) => sum + b.remainingStock,
          0
        );

        if (totalAvailable < item.quantity) {
          throw new ResponseError(
            400,
            `Insufficient stock for product ${item.productId}`
          );
        }

        let remainingToDeduct = item.quantity;
        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;
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

      // Journal header
      const journal = await journalRepository.createJournal(
        {
          date,
          description: `Penjualan ${paymentType.toLowerCase()} ${invoiceNumber}`,
          reference: invoiceNumber,
        },
        prismaTransaction
      );

      // Sale header
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

      // Journal entries
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

      // Receivable
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
      // Cari sale beserta data relasinya
      const sale = await saleRepository.getSaleByIdTransaction(
        saleId,
        prismaTransaction
      );

      if (!sale) {
        throw new ResponseError(404, 'Sale not found');
      }

      // Ambil account default
      const accountDefault =
        await accountDefaultRepository.findOne(prismaTransaction);
      if (!accountDefault) {
        throw new ResponseError(400, 'Account default not configured');
      }

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
      if (
        sale.paymentType === PaymentType.CREDIT ||
        sale.paymentType === PaymentType.MIXED
      ) {
        for (const receivable of sale.receivables) {
          // Periksa apakah ada Payment terkait Receivable
          const payments = await prismaTransaction.payment.findMany({
            where: { payableId: receivable.receivableId },
          });

          if (payments.length > 0) {
            throw new ResponseError(
              400,
              `Cannot delete sale with associated payments for receivable ${receivable.receivableId}`
            );
          }

          if (receivable.status === PaymentStatus.PAID) {
            throw new ResponseError(
              400,
              `Cannot delete sale with paid receivable ${receivable.receivableId}`
            );
          }
        }
      }

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
            `Cannot delete sale due to subsequent purchases of the same product`
          );
        }
      }

      // Ambil setting inventory method
      const setting =
        await generalSettingRepository.getSettingTransaction(prismaTransaction);
      if (!setting) {
        throw new ResponseError(400, 'Inventory method not configured');
      }

      // Revert stok produk dan batch
      for (const detail of sale.saleDetails) {
        const product = await productRepository.findProductTransaction(
          detail.productId,
          prismaTransaction
        );
        if (!product) {
          throw new ResponseError(404, `Product ${detail.productId} not found`);
        }

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

      // Hapus semua receivable terkait
      if (sale.receivables.length > 0) {
        for (const receivable of sale.receivables) {
          await receivableRepository.deleteReceivable(
            receivable.receivableId,
            prismaTransaction
          );
        }
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
