import { Payment, Prisma } from '@prisma/client';
import { PayablePaymentForm } from '../utils/interface';
import { Decimal } from '@prisma/client/runtime/library';
import { prismaClient } from '../application/database';

export class PayablePaymentRepository {
  async getPaymentByPayableId(
    payableId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Payment[]> {
    return await prismaTransaction.payment.findMany({
      where: { payableId },
    });
  }

  async createPayment(
    data: PayablePaymentForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Payment> {
    const { payableId, journalEntryId, paymentAmount, paymentDate, method } =
      data;
    return await prismaTransaction.payment.create({
      data: {
        payableId,
        journalEntryId: journalEntryId,
        amount: paymentAmount,
        paymentDate: new Date(paymentDate),
        method,
      },
    });
  }

  async getPaymentById(
    paymentId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Payment | null> {
    return await prismaTransaction.payment.findUnique({
      where: { paymentId },
    });
  }

  async updatePayment(
    data: {
      paymentId: string;
      paymentAmount: Decimal;
      paymentDate: Date;
      method: string;
    },
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Payment> {
    const { paymentId, paymentAmount, paymentDate, method } = data;
    return await prismaTransaction.payment.update({
      data: {
        amount: paymentAmount,
        paymentDate: new Date(paymentDate),
        method,
      },
      where: { paymentId },
    });
  }

  async deletePayment(
    paymentId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.payment.delete({
      where: { paymentId },
    });
  }

  async getPaymentDetail(paymentId: string) {
    return await prismaClient.payment.findUnique({
      where: { paymentId },
      select: {
        paymentId: true,
        amount: true,
        paymentDate: true,
        method: true,
        createdAt: true,
        updatedAt: true,
        payable: {
          select: {
            payableId: true,
            amount: true,
            paidAmount: true,
            remainingAmount: true,
            dueDate: true,
            status: true,
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
                subtotal: true,
                vat: true,
                total: true,
                paymentType: true,
              },
            },
          },
        },
      },
    });
  }
}

export const payablePaymentRepository = new PayablePaymentRepository();
