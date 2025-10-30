import { Payable, PaymentStatus, Prisma } from '@prisma/client';
import {
  PaginatedPayablesResult,
  PayableForm,
  RecordPayablePaymentForm,
} from '../utils/interface';
import { paginate } from '../utils/pagination';
import { prismaClient } from '../application/database';

export class PayableRepository {
  async getPayableById(
    payableId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Prisma.PayableGetPayload<{
    include: { journalEntry: true; purchase: true; supplier: true };
  }> | null> {
    return prismaTransaction.payable.findUnique({
      where: { payableId },
      include: { journalEntry: true, purchase: true, supplier: true },
    });
  }

  async getAllPayables(
    page: number,
    limit: number,
    search: string,
    supplierId?: string,
    paymentStatus?: PaymentStatus,
    fromDueDate?: Date,
    toDueDate?: Date,
    minAmount?: number,
    maxAmount?: number,
    isPaid?: boolean
  ): Promise<PaginatedPayablesResult> {
    // Buat filter untuk query
    const filters: any = {};

    // Filter pencarian (berdasarkan purchaseId)
    if (search && search.trim() !== '') {
      filters.OR = [{ purchaseId: { contains: search, mode: 'insensitive' } }];
    }

    // Filter supplier
    if (supplierId) {
      filters.supplierId = supplierId;
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
      supplier: {
        select: {
          supplierId: true,
          supplierName: true,
          phone: true,
          email: true,
          address: true,
        },
      },
    };

    const result = await paginate<Payable>(prismaClient.payable, {
      page,
      limit,
      where: filters,
      include,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return result;
  }

  async getPayableDetail(payableId: string) {
    return await prismaClient.payable.findUnique({
      where: { payableId },
      include: {
        supplier: {
          select: {
            supplierId: true,
            supplierName: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        purchase: {
          select: {
            purchaseId: true,
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

  async createPayable(
    data: PayableForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Payable> {
    const {
      journalEntryId,
      supplierId,
      purchaseId,
      amount,
      remainingAmount,
      dueDate,
      status,
    } = data;
    return prismaTransaction.payable.create({
      data: {
        journalEntryId,
        supplierId,
        purchaseId,
        amount,
        remainingAmount,
        dueDate,
        status,
      },
    });
  }

  async recordPayablePayment(
    params: RecordPayablePaymentForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Payable> {
    const { payableId, paidAmount, remainingAmount, status } = params;

    const updatedPayable = await prismaTransaction.payable.update({
      where: { payableId },
      data: {
        paidAmount,
        remainingAmount,
        status,
      },
    });
    return updatedPayable;
  }

  async deletePayable(
    payableId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.payable.delete({
      where: { payableId },
    });
  }

  async applyPurchaseReturnToPayable(
    data: {
      payableId: string;
      reduceFromPayable: number;
      remainingAmount: number;
      status: PaymentStatus;
    },
    prismaTransaction: Prisma.TransactionClient
  ) {
    const { payableId, reduceFromPayable, remainingAmount, status } = data;
    return prismaTransaction.payable.update({
      where: { payableId },
      data: {
        amount: { decrement: reduceFromPayable },
        remainingAmount,
        status,
      },
    });
  }
}

export const payableRepository = new PayableRepository();
