import {
  Journal,
  JournalEntry,
  Payable,
  PaymentType,
  Prisma,
  Purchase,
  PurchaseDetail,
} from '@prisma/client';
import { PurchaseForm, UpdatePurchaseForm } from '../utils/interface';
import { paginate } from '../utils/pagination';
import { prismaClient } from '../application/database';

export class PurchaseRepository {
  async getAllPurchase(
    page: number = 1,
    limit: number = 10,
    search: string = '',
    paymentType?: PaymentType,
    from?: Date,
    to?: Date
  ) {
    const filters: any = {};

    // Filter search berdasarkan invoice number
    if (search && search.trim() !== '') {
      filters.invoiceNumber = { contains: search, mode: 'insensitive' };
    }

    // Filter berdasarkan paymentType (enum)
    if (paymentType) {
      filters.paymentType = paymentType;
    }

    // Filter berdasarkan tanggal pembelian (range)
    if (from && to) {
      filters.date = { gte: from, lte: to };
    } else if (from) {
      filters.date = { gte: from };
    } else if (to) {
      filters.date = { lte: to };
    }

    const result = await paginate<Purchase>(prismaClient.purchase, {
      page,
      limit,
      where: filters,
      orderBy: { date: 'asc' },
    });

    return { purchases: result.items, total: result.total };
  }

  async createPurchase(
    data: PurchaseForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Purchase> {
    return prismaTransaction.purchase.create({
      data: {
        date: data.date,
        supplierId: data.supplierId,
        invoiceNumber: data.invoiceNumber,
        paymentType: data.paymentType,
        subtotal: data.subtotal,
        vat: data.vat,
        total: data.total,
        journalId: data.journalId,
      },
    });
  }

  async findPurchaseDetailById(purchaseId: string) {
    return await prismaClient.purchase.findUnique({
      where: { purchaseId },
      select: {
        purchaseId: true,
        date: true,
        invoiceNumber: true,
        paymentType: true,
        vat: true,
        subtotal: true,
        total: true,

        supplier: {
          select: {
            supplierId: true,
            supplierName: true,
            phone: true,
            address: true,
          },
        },

        purchaseDetails: {
          select: {
            purchaseDetailId: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            product: {
              select: {
                productId: true,
                productCode: true,
                productName: true,
              },
            },
          },
        },
      },
    });
  }

  async findPurchaseByIdTransaction(
    purchaseId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<
    | (Purchase & {
        journal: Journal & { journalEntries: JournalEntry[] };
        payable: Payable | null;
        purchaseDetails: PurchaseDetail[];
      })
    | null
  > {
    return await prismaTransaction.purchase.findUnique({
      where: { purchaseId },
      include: {
        journal: {
          include: {
            journalEntries: true,
          },
        },
        payable: true,
        purchaseDetails: true,
      },
    });
  }

  async updatePurchaseTransaction(
    data: UpdatePurchaseForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Purchase> {
    return prismaTransaction.purchase.update({
      where: { purchaseId: data.purchaseId },
      data: {
        date: data.date,
        supplierId: data.supplierId,
        invoiceNumber: data.invoiceNumber,
        paymentType: data.paymentType,
      },
    });
  }
}

export const purchaseRepository = new PurchaseRepository();
