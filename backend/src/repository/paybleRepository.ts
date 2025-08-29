import { Payable, Prisma } from '@prisma/client';
import { PayableForm } from '../utils/interface';

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
}

export const payableRepository = new PayableRepository();
