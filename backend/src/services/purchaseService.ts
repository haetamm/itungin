import {
  DeletePurchaseRequest,
  JournalEntryForm,
  PurchaseRequest,
  PurchaseResult,
  UpdatePurchaseDataRelation,
  UpdatePurchaseRequest,
} from '../utils/interface';
import { validate } from '../validation/validation';
import { vatSettingRepository } from '../repository/vatSettingRepository';
import {
  deletePurchaseSchema,
  purchaseSchema,
  updatePurchaseSchema,
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
import { saleDetailRepository } from '../repository/saleDetailRepository';
import { saleRepository } from '../repository/saleRepository';
import { paymentRepository } from '../repository/paymentRepository';

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
            dueDate: new Date(dueDate!),
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

      const { payable } = purchase;

      // Ambil account default
      const accountDefault =
        await accountDefaultRepository.findOne(prismaTransaction);
      if (!accountDefault) {
        throw new ResponseError(400, 'Account default not configured');
      }

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
          const payments = await paymentRepository.getPaymentByPayableId(
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
        await generalSettingRepository.getSettingTransaction(prismaTransaction);
      if (!setting) {
        throw new ResponseError(400, 'Inventory method not configured');
      }

      // Revert product stock and delete inventory batches
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

  async updatePurchase(
    { body }: { body: UpdatePurchaseRequest },
    purchaseId: string
  ): Promise<Purchase> {
    const purchaseReq = validate(updatePurchaseSchema, body);
    const {
      date,
      supplierId,
      invoiceNumber,
      paymentType,
      cashAmount,
      dueDate,
    } = purchaseReq;

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // 1. Ambil akun default (kas dan hutang)
      const accountDefault =
        await accountDefaultRepository.findOne(prismaTransaction);
      if (!accountDefault)
        throw new ResponseError(400, 'Account has not been configured');

      let { cashAccount, payableAccount } = accountDefault;

      // 2. Ambil data pembelian existing beserta relasinya
      const existingPurchase =
        await purchaseRepository.findPurchaseByIdTransaction(
          purchaseId,
          prismaTransaction
        );
      if (!existingPurchase) throw new ResponseError(404, 'Purchase not found');

      // Simpan data lama untuk keperluan perbandingan
      const oldPaymentType = existingPurchase.paymentType;
      const { total, purchaseDetails } = existingPurchase;

      // 3. Validasi apakah tanggal pembelian baru tidak melanggar kronologi dengan sales
      for (const detail of purchaseDetails) {
        const inventoryBatches =
          await inventoryBatchRepository.findBatchesByPurchaseDetail(
            detail.purchaseDetailId,
            prismaTransaction
          );

        for (const batch of inventoryBatches) {
          // Ambil semua sale detail yang pakai batch ini
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

      // 4. Update tabel Purchase
      const purchase = await purchaseRepository.updatePurchaseTransaction(
        {
          purchaseId,
          date: new Date(date),
          supplierId,
          invoiceNumber,
          paymentType,
        },
        prismaTransaction
      );

      // 5. Update header jurnal
      await journalRepository.updateJournalTransaction(
        {
          journalId: existingPurchase.journalId,
          date: new Date(date),
          description: `Pembelian ${paymentType.toLowerCase()} ${invoiceNumber}`,
          reference: invoiceNumber,
        },
        prismaTransaction
      );

      // 6. Update batch inventory untuk setiap detail pembelian
      for (const detail of purchaseDetails) {
        await inventoryBatchRepository.updateBatchByPurchaseDetailId(
          {
            purchaseDetailId: detail.purchaseDetailId,
            productId: detail.productId,
            purchaseDate: new Date(date),
            quantity: detail.quantity,
            purchasePrice: detail.unitPrice,
            remainingStock: detail.quantity,
          },
          prismaTransaction
        );
      }

      // 7. Update hutang (Payable) - buat atau perbarui journal entry untuk payable
      let payableJournalEntryId: string | null = null; // Simpan ID journal entry untuk payable
      if (
        paymentType === PaymentType.CREDIT ||
        paymentType === PaymentType.MIXED
      ) {
        const payable = existingPurchase.payable;

        if (payable) {
          // Jika hutang sudah ada (jika dari CREDIT ke MIXED)
          const creditAmount =
            paymentType === PaymentType.CREDIT
              ? total
              : total.minus(new Decimal(cashAmount!));

          // Perbarui journal entry yang sudah ada untuk payable
          await journalEntryRepository.updateJournalEntryAmounts(
            {
              journalEntryId: payable.journalEntryId,
              debit: new Decimal(0),
              credit: creditAmount,
            },
            prismaTransaction
          );
          payableJournalEntryId = payable.journalEntryId;

          // Perbarui data hutang, termasuk amount untuk MIXED
          await payableRepository.updatePayableByPayableId(
            {
              payableId: payable.payableId,
              supplierId,
              dueDate: new Date(dueDate!),
              amount: creditAmount, // Update amount untuk mencerminkan MIXED
              status: PaymentStatus.UNPAID,
            },
            prismaTransaction
          );
        } else {
          // Jika belum ada hutang (misalnya dari CASH ke CREDIT/MIXED)
          const creditAmount =
            paymentType === PaymentType.CREDIT
              ? total
              : total.minus(new Decimal(cashAmount!));

          // Buat journal entry baru untuk hutang
          const journalEntry =
            await journalEntryRepository.createJournalEntries(
              {
                journalId: existingPurchase.journalId,
                accountId: payableAccount.accountId,
                debit: new Decimal(0),
                credit: creditAmount,
              },
              prismaTransaction
            );
          payableJournalEntryId = journalEntry.journalEntryId;

          // Buat hutang baru dengan journal entry baru
          await payableRepository.createPayable(
            {
              journalEntryId: payableJournalEntryId,
              supplierId,
              purchaseId: existingPurchase.purchaseId,
              amount: creditAmount,
              dueDate: new Date(dueDate!),
              status: PaymentStatus.UNPAID,
            },
            prismaTransaction
          );
        }
      } else if (paymentType === PaymentType.CASH && existingPurchase.payable) {
        // Jika beralih ke CASH dan ada hutang, hapus hutang
        await payableRepository.deletePayable(
          existingPurchase.payable.payableId,
          prismaTransaction
        );
      }

      // 8. Update Journal Entries (hapus yang lama, buat yang baru hanya jika perlu)
      if (oldPaymentType !== paymentType) {
        // Cari journal entries lama terkait pembayaran, kecualikan journal entry untuk payable
        const paymentEntries = existingPurchase.journal.journalEntries.filter(
          (entry) =>
            entry.accountId === cashAccount.accountId ||
            (entry.accountId === payableAccount.accountId &&
              entry.journalEntryId !== payableJournalEntryId)
        );

        const paymentEntryIds = paymentEntries.map((e) => e.journalEntryId);

        // Hapus journal entries lama
        await journalEntryRepository.deleteJournalEntriesByIds(
          paymentEntryIds,
          prismaTransaction
        );

        // Buat journal entries baru sesuai tipe pembayaran
        if (paymentType === PaymentType.CASH) {
          await journalEntryRepository.createJournalEntries(
            {
              journalId: existingPurchase.journalId,
              accountId: cashAccount.accountId,
              debit: new Decimal(0),
              credit: new Decimal(total),
            },
            prismaTransaction
          );
        }

        if (paymentType === PaymentType.MIXED) {
          if (!cashAmount) {
            throw new ResponseError(
              400,
              'Cash amount must be less than total for mixed payment'
            );
          }

          // Hanya buat journal entry untuk kas, karena journal entry untuk hutang sudah diperbarui di langkah 7
          await journalEntryRepository.createJournalEntries(
            {
              journalId: existingPurchase.journalId,
              accountId: cashAccount.accountId,
              debit: new Decimal(0),
              credit: new Decimal(cashAmount),
            },
            prismaTransaction
          );
        }
      }

      // 9. Update Saldo Akun (jika tipe pembayaran berubah)
      if (oldPaymentType !== paymentType) {
        // Batalkan saldo lama
        let oldPayableAmount = new Decimal(0);
        if (oldPaymentType === PaymentType.CASH) {
          const updatedCashAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: cashAccount.accountCode,
                balance: cashAccount.balance.plus(total),
              },
              prismaTransaction
            );

          cashAccount = { ...cashAccount, balance: updatedCashAccount.balance }; // Update cashAccount
        } else if (oldPaymentType === PaymentType.CREDIT) {
          oldPayableAmount = total; // Simpan jumlah hutang lama

          const updatedPayableAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: payableAccount.accountCode,
                balance: payableAccount.balance.minus(total),
              },
              prismaTransaction
            );

          payableAccount = {
            ...payableAccount,
            balance: updatedPayableAccount.balance,
          }; // Update payableAccount
        } else if (oldPaymentType === PaymentType.MIXED) {
          const oldCashEntry = existingPurchase.journal.journalEntries.find(
            (e) => e.accountId === cashAccount.accountId
          );
          const oldCashAmount = oldCashEntry
            ? new Decimal(oldCashEntry.credit)
            : new Decimal(0);
          oldPayableAmount = total.minus(oldCashAmount); // Simpan jumlah hutang lama

          const updatedCashAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: cashAccount.accountCode,
                balance: cashAccount.balance.plus(oldCashAmount),
              },
              prismaTransaction
            );

          cashAccount = { ...cashAccount, balance: updatedCashAccount.balance }; // Update cashAccount

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
          }; // Update payableAccount
        }

        // Terapkan saldo baru
        if (paymentType === PaymentType.CASH) {
          const updatedCashAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: cashAccount.accountCode,
                balance: cashAccount.balance.minus(total),
              },
              prismaTransaction
            );

          cashAccount = { ...cashAccount, balance: updatedCashAccount.balance }; // Update cashAccount
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
          }; // Update payableAccount
        } else if (paymentType === PaymentType.MIXED) {
          if (!cashAmount) {
            throw new ResponseError(
              400,
              'Cash amount must be less than total for mixed payment'
            );
          }

          const newPayableAmount = total.minus(new Decimal(cashAmount));

          const updatedCashAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: cashAccount.accountCode,
                balance: cashAccount.balance.minus(cashAmount),
              },
              prismaTransaction
            );

          const updatedPayableAccount =
            await accountRepository.updateAccountTransaction(
              {
                accountCode: payableAccount.accountCode,
                balance: payableAccount.balance.plus(newPayableAmount),
              },
              prismaTransaction
            );

          cashAccount = { ...cashAccount, balance: updatedCashAccount.balance }; // Update cashAccount

          payableAccount = {
            ...payableAccount,
            balance: updatedPayableAccount.balance,
          }; // Update payableAccount
        }

        // Validasi saldo Accounts Payable
        const totalPayables =
          await payableRepository.getTotalPayables(prismaTransaction);
        const expectedPayableBalance = new Decimal(totalPayables || 0);

        if (!payableAccount.balance.equals(expectedPayableBalance)) {
          throw new ResponseError(
            400,
            `Accounts Payable balance mismatch: expected ${expectedPayableBalance.toString()}, but got ${payableAccount.balance.toString()}`
          );
        }
      }

      return purchase;
    });
  }
}

export const purchaseService = new PurchaseService();
