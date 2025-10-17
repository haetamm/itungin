import {
  Journal,
  JournalEntry,
  PaymentType,
  Prisma,
  Receivable,
  Sale,
  SaleDetail,
} from '@prisma/client';
import { SaleForm, UpdateSaleForm } from '../utils/interface';
import { paginate } from '../utils/pagination';
import { prismaClient } from '../application/database';

export class SaleRepository {
  async getAllSale(
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

    const result = await paginate<Sale>(prismaClient.sale, {
      page,
      limit,
      where: filters,
      orderBy: { date: 'asc' },
    });

    return { sales: result.items, total: result.total };
  }

  async findSaleDetailById(saleId: string) {
    return await prismaClient.sale.findUnique({
      where: { saleId },
      select: {
        saleId: true,
        date: true,
        invoiceNumber: true,
        paymentType: true,
        vat: true,
        subtotal: true,
        total: true,

        customer: {
          select: {
            customerId: true,
            customerName: true,
            phone: true,
            address: true,
          },
        },

        saleDetails: {
          select: {
            saleDetailId: true,
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

  async findInvoiceNumber(
    invoiceNumber: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Sale | null> {
    return await prismaTransaction.sale.findUnique({
      where: { invoiceNumber },
    });
  }

  async createSale(
    data: SaleForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Sale> {
    return prismaTransaction.sale.create({
      data: {
        date: data.date instanceof Date ? data.date : new Date(data.date),
        customerId: data.customerId,
        journalId: data.journalId,
        invoiceNumber: data.invoiceNumber,
        paymentType: data.paymentType,
        subtotal: data.subtotal,
        vat: data.vat,
        total: data.total,
      },
    });
  }

  async findSaleByIdTransaction(
    saleId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Sale | null> {
    return await prismaTransaction.sale.findUnique({
      where: { saleId },
    });
  }

  async getSaleByIdTransaction(
    saleId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<
    | (Sale & {
        journal: Journal & { journalEntries: JournalEntry[] };
        receivable: Receivable | null;
        saleDetails: SaleDetail[];
      })
    | null
  > {
    return await prismaTransaction.sale.findUnique({
      where: { saleId },
      include: {
        journal: {
          include: {
            journalEntries: true,
          },
        },
        receivable: true,
        saleDetails: true,
      },
    });
  }

  async deleteSaleByIdTransaction(
    saleId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.sale.delete({
      where: { saleId },
    });
  }

  async updateSaleTransaction(
    data: UpdateSaleForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Sale> {
    return prismaTransaction.sale.update({
      where: { saleId: data.saleId },
      data: {
        date: data.date,
        customerId: data.customerId,
        invoiceNumber: data.invoiceNumber,
        paymentType: data.paymentType,
      },
    });
  }
}

export const saleRepository = new SaleRepository();
