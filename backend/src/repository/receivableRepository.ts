import { PaymentStatus, Prisma, Receivable } from '@prisma/client';
import { ReceivableForm, UpdateReceivableForm } from '../utils/interface';
import { Decimal } from '@prisma/client/runtime/library';

export class ReceivableRepository {
  async createReceivable(
    data: ReceivableForm,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.receivable.create({
      data: {
        journalEntryId: data.journalEntryId,
        saleId: data.saleId,
        customerId: data.customerId,
        amount: data.amount,
        dueDate: data.dueDate,
        status: data.status,
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

  async updateByReceivableId(
    data: UpdateReceivableForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Receivable> {
    return prismaTransaction.receivable.update({
      where: { receivableId: data.receivableId },
      data: {
        receivableId: data.receivableId,
        customerId: data.customerId,
        dueDate: data.dueDate,
        status: data.status as PaymentStatus,
        amount: data.amount,
      },
    });
  }

  async getTotalReceivables(
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Decimal> {
    const result = await prismaTransaction.receivable.aggregate({
      _sum: { amount: true },
    });
    return new Decimal(result._sum.amount || 0);
  }
}

export const receivableRepository = new ReceivableRepository();
