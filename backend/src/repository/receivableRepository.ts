import { Prisma } from '@prisma/client';
import { ReceivableForm } from '../utils/interface';

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
}

export const receivableRepository = new ReceivableRepository();
