import { Payment, Prisma } from '@prisma/client';

export class PaymentRepository {
  async getPaymentByPayableId(
    payableId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Payment[]> {
    return await prismaTransaction.payment.findMany({
      where: { payableId },
    });
  }
}

export const paymentRepository = new PaymentRepository();
