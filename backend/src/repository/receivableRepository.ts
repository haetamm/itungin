import { PaymentStatus, Prisma, Receivable } from '@prisma/client';
import {
  PaginatedReceivablesResult,
  ReceivableForm,
  RecordReceivablePaymentForm,
} from '../utils/interface';
import { prismaClient } from '../application/database';
import { paginate } from '../utils/pagination';

export class ReceivableRepository {
  async getAllReceivable(
    page: number,
    limit: number,
    search: string,
    customerId?: string,
    paymentStatus?: PaymentStatus,
    fromDueDate?: Date,
    toDueDate?: Date,
    minAmount?: number,
    maxAmount?: number,
    isPaid?: boolean
  ): Promise<PaginatedReceivablesResult> {
    console.log({
      page,
      limit,
      search,
      customerId,
      paymentStatus,
      fromDueDate,
      toDueDate,
      minAmount,
      maxAmount,
      isPaid,
    });
    // Buat filter untuk query
    const filters: any = {};

    // Filter pencarian (berdasarkan saleId)
    if (search && search.trim() !== '') {
      filters.OR = [{ saleId: { contains: search, mode: 'insensitive' } }];
    }

    // Filter customer
    if (customerId) {
      filters.customerId = customerId;
    }

    // Filter status pembayaran
    if (paymentStatus) {
      filters.status = paymentStatus;
    }

    // Filter rentang tanggal jatuh tempo
    if (fromDueDate && toDueDate) {
      filters.dueDate = { gte: fromDueDate, lte: toDueDate };
    } else if (fromDueDate) {
      filters.dueDate = { gte: fromDueDate };
    } else if (toDueDate) {
      filters.dueDate = { lte: toDueDate };
    }

    // Filter rentang jumlah
    if (minAmount !== undefined && maxAmount !== undefined) {
      filters.amount = { gte: minAmount, lte: maxAmount };
    } else if (minAmount !== undefined) {
      filters.amount = { gte: minAmount };
    } else if (maxAmount !== undefined) {
      filters.amount = { lte: maxAmount };
    }

    // Filter status pembayaran (lunas/belum lunas)
    if (isPaid !== undefined) {
      filters.remainingAmount = isPaid ? { equals: 0 } : { gt: 0 };
    }

    // Include data relasi
    const include = {
      customer: {
        select: {
          customerId: true,
          customerName: true,
          phone: true,
          address: true,
        },
      },
    };

    const result = await paginate<Receivable>(prismaClient.receivable, {
      page,
      limit,
      where: filters,
      include,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return result;
  }

  async getReceivableDetail(receivableId: string) {
    return await prismaClient.receivable.findUnique({
      where: { receivableId },
      include: {
        customer: {
          select: {
            customerId: true,
            customerName: true,
            phone: true,
            address: true,
          },
        },
        sale: {
          select: {
            saleId: true,
            invoiceNumber: true,
            date: true,
          },
        },
        payments: {
          select: {
            paymentId: true,
            amount: true,
            paymentDate: true,
            method: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async createReceivable(
    data: ReceivableForm,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const {
      journalEntryId,
      saleId,
      customerId,
      amount,
      remainingAmount,
      dueDate,
      status,
    } = data;
    return await prismaTransaction.receivable.create({
      data: {
        journalEntryId,
        saleId,
        customerId,
        amount,
        remainingAmount,
        dueDate,
        status,
      },
    });
  }

  async deleteReceivable(
    receivableId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.receivable.delete({
      where: { receivableId },
    });
  }

  async getReceivableById(
    receivableId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Prisma.ReceivableGetPayload<{
    include: { journalEntry: true; sale: true; customer: true };
  }> | null> {
    return prismaTransaction.receivable.findUnique({
      where: { receivableId },
      include: { journalEntry: true, sale: true, customer: true },
    });
  }

  async recordReceivablePayment(
    params: RecordReceivablePaymentForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Receivable> {
    const { receivableId, paidAmount, remainingAmount, status } = params;

    const updatedPayable = await prismaTransaction.receivable.update({
      where: { receivableId },
      data: {
        paidAmount,
        remainingAmount,
        status,
      },
    });
    return updatedPayable;
  }
}

export const receivableRepository = new ReceivableRepository();
