import { Payable, Prisma } from '@prisma/client';
import {
  PayableForm,
  RecordPayablePaymentForm,
  UpdatePayableForm,
} from '../utils/interface';
import { Decimal } from '@prisma/client/runtime/library';

export class PayableRepository {
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

  async updatePayableByPayableId(
    data: UpdatePayableForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Payable> {
    const { payableId, supplierId, dueDate, status, amount } = data;
    return prismaTransaction.payable.update({
      where: { payableId },
      data: {
        payableId,
        supplierId,
        dueDate,
        status,
        amount,
      },
    });
  }

  async getTotalPayables(
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Decimal> {
    const result = await prismaTransaction.payable.aggregate({
      _sum: { amount: true },
    });
    return new Decimal(result._sum.amount || 0);
  }

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
}

export const payableRepository = new PayableRepository();
