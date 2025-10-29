import { PaymentType, Prisma, Purchase } from '@prisma/client';
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
    const {
      date,
      supplierId,
      invoiceNumber,
      paymentType,
      subtotal,
      vat,
      total,
      journalId,
    } = data;
    return prismaTransaction.purchase.create({
      data: {
        date,
        supplierId,
        invoiceNumber,
        paymentType,
        subtotal,
        vat,
        total,
        journalId,
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
            inventoryBatch: {
              select: {
                batchId: true,
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
  ) {
    return await prismaTransaction.purchase.findUnique({
      where: { purchaseId },
      include: {
        journal: {
          include: {
            journalEntries: true,
          },
        },
        payable: true,
        supplier: true,
        purchaseDetails: {
          include: {
            product: true,
            inventoryBatch: true,
            purchaseReturnDetails: true,
          },
        },
      },
    });
  }

  async updatePurchaseTransaction(
    data: UpdatePurchaseForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Purchase> {
    const {
      purchaseId,
      date,
      supplierId,
      paymentType,
      invoiceNumber,
      subtotal,
      vat,
      total,
    } = data;
    return prismaTransaction.purchase.update({
      where: { purchaseId },
      data: {
        date,
        supplierId,
        paymentType,
        invoiceNumber,
        subtotal,
        vat,
        total,
      },
    });
  }

  async getPurchaseCount(): Promise<number> {
    return await prismaClient.purchase.count();
  }

  async findSubsequentPurchases(
    productId: string,
    transactionDate: Date,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Purchase[]> {
    return await prismaTransaction.purchase.findMany({
      where: {
        purchaseDetails: {
          some: {
            productId: productId,
          },
        },
        date: {
          gt: transactionDate, // Pembelian setelah tanggal penjualan
        },
      },
    });
  }
}

export const purchaseRepository = new PurchaseRepository();
