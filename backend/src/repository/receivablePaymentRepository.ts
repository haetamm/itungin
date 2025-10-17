import { Prisma, ReceivablePayment } from '@prisma/client';

export class ReceivablePaymentRepository {
  async getPaymentReceivableByReceivableId(
    receivableId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<ReceivablePayment[]> {
    return await prismaTransaction.receivablePayment.findMany({
      where: { receivableId },
    });
  }
}

export const receivablePaymentRepository = new ReceivablePaymentRepository();
