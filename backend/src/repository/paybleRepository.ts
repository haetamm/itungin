import { Payable, Prisma, PaymentStatus } from '@prisma/client';
import { PayableForm, UpdatePayableForm } from '../utils/interface';
import { Decimal } from '@prisma/client/runtime/library';

export class PayableRepository {
  async createPayable(
    data: PayableForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Payable> {
    return prismaTransaction.payable.create({
      data: {
        journalEntryId: data.journalEntryId,
        supplierId: data.supplierId,
        purchaseId: data.purchaseId,
        amount: data.amount,
        dueDate: data.dueDate,
        status: data.status,
      },
    });
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
    return prismaTransaction.payable.update({
      where: { payableId: data.payableId },
      data: {
        payableId: data.payableId,
        supplierId: data.supplierId,
        dueDate: data.dueDate,
        status: data.status as PaymentStatus,
        amount: data.amount,
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
}

export const payableRepository = new PayableRepository();
