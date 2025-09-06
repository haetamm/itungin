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
import { PaymentStatus, Prisma } from '@prisma/client';

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
    } = saleReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil akun default
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

      // Hitung subtotal & COGS (Cost of Goods Sold)
      let subtotal = new Decimal(0);
      let cogs = new Decimal(0);
      const saleDetailsData: SaleDetailForm[] = [];

      // Loop semua item yang dijual
      for (const item of items) {
        // Validasi produk
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
            `Insufficient stock for product ${item.productId}`
          );
        }

        let unitPrice: Decimal;
        let itemCogs: Decimal = new Decimal(0);
        const batchAssignments: {
          batchId: string | null;
          quantity: number;
          purchasePrice: Decimal;
        }[] = [];

        // Perhitungan untuk metode AVG
        if (setting.inventoryMethod === 'AVG') {
          const avgPurchasePrice =
            await inventoryBatchRepository.calculateAvgPurchasePrice(
              item.productId,
              prismaTransaction
            );

          unitPrice = avgPurchasePrice
            .times(
              new Decimal(1).plus(new Decimal(product.profitMargin).div(100))
            )
            .toDecimalPlaces(2);

          itemCogs = new Decimal(item.quantity).times(avgPurchasePrice);

          const batches = await inventoryBatchRepository.findBatchesForProduct(
            item.productId,
            setting.inventoryMethod,
            prismaTransaction
          );
          if (
            batches.reduce((sum, b) => sum + b.remainingStock, 0) <
            item.quantity
          ) {
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
              batchId: null,
              quantity: deduct,
              purchasePrice: new Decimal(batch.purchasePrice),
            });

            remainingToDeduct -= deduct;
          }
        } else {
          // FIFO / LIFO
          const batches = await inventoryBatchRepository.findBatchesForProduct(
            item.productId,
            setting.inventoryMethod,
            prismaTransaction
          );
          if (
            batches.reduce((sum, b) => sum + b.remainingStock, 0) <
            item.quantity
          ) {
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

          unitPrice = new Decimal(batches[0].purchasePrice)
            .times(
              new Decimal(1).plus(new Decimal(product.profitMargin).div(100))
            )
            .toDecimalPlaces(2);
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

      // ===== Validasi & penentuan cash berdasarkan paymentType =====
      // - CASH  => otomatis cash = total
      // - MIXED => cashAmount wajib dan harus < total
      // - CREDIT => cash tetap null (seluruhnya piutang)
      let cash: Decimal | null = null;

      if (paymentType === 'CASH') {
        // Untuk CASH kita anggap tunai penuh (tidak perlu cashAmount di request)
        cash = total;
      } else if (paymentType === 'MIXED') {
        // Untuk MIXED, cashAmount wajib dan < total
        if (cashAmount === undefined || cashAmount === null) {
          throw new ResponseError(
            400,
            'Cash amount is required for MIXED payment'
          );
        }
        cash = new Decimal(cashAmount);
        if (cash.comparedTo(total) >= 0) {
          throw new ResponseError(
            400,
            'Cash amount must be less than total for mixed payment'
          );
        }
      } else {
        // CREDIT -> tidak ada cash, semua piutang
        cash = null;
      }

      // Buat Journal (header)
      const journal = await journalRepository.createJournal(
        {
          date,
          description: `Penjualan ${paymentType.toLowerCase()} ${invoiceNumber}`,
          reference: invoiceNumber,
        },
        prismaTransaction
      );

      // Buat Sale (header)
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

      // Journal Entries
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
        // safe: cash sudah di-set dan dipastikan < total
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

        if (!receivableJournalEntryId) {
          throw new ResponseError(500, 'Receivable journal entry id not found');
        }

        await receivableRepository.createReceivable(
          {
            journalEntryId: receivableJournalEntryId,
            status: PaymentStatus.UNPAID,
            customerId,
            saleId: sale.saleId,
            amount: receivableAmount,
            dueDate: new Date(
              new Date(date).setDate(new Date(date).getDate() + 30)
            ),
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

      // Return sale sebagai hasil transaksi
      return sale;
    });
  }
}

export const saleService = new SaleService();
