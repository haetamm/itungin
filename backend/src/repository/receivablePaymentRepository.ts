import { Prisma, ReceivablePayment } from '@prisma/client';
import { prismaClient } from '../application/database';
import {
  ReceivablePaymentForm,
  UpdateReceivablePaymentForm,
} from '../utils/interface';

export class ReceivablePaymentRepository {
  async getPaymentReceivableByReceivableId(
    receivableId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<ReceivablePayment[]> {
    return await prismaTransaction.receivablePayment.findMany({
      where: { receivableId },
    });
  }

  async getPaymentDetail(paymentId: string) {
    return await prismaClient.receivablePayment.findUnique({
      where: { paymentId },
      select: {
        paymentId: true,
        amount: true,
        paymentDate: true,
        method: true,
        createdAt: true,
        updatedAt: true,
        receivable: {
          select: {
            receivableId: true,
            amount: true,
            paidAmount: true,
            remainingAmount: true,
            dueDate: true,
            status: true,
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

  async getPaymentById(
    paymentId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<ReceivablePayment | null> {
    return await prismaTransaction.receivablePayment.findUnique({
      where: { paymentId },
    });
  }

  async createPayment(
    data: ReceivablePaymentForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<ReceivablePayment> {
    const {
      receivableId,
      receiveVoucher,
      journalEntryId,
      paymentAmount,
      paymentDate,
      method,
    } = data;
    return await prismaTransaction.receivablePayment.create({
      data: {
        receivableId,
        receiveVoucher,
        journalEntryId: journalEntryId,
        amount: paymentAmount,
        paymentDate: new Date(paymentDate),
        method,
      },
    });
  }

  async deletePayment(
    paymentId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.receivablePayment.delete({
      where: { paymentId },
    });
  }

  async updatePayment(
    data: UpdateReceivablePaymentForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<ReceivablePayment> {
    const { paymentId, receiveVoucher, paymentAmount, paymentDate, method } =
      data;
    return await prismaTransaction.receivablePayment.update({
      data: {
        receiveVoucher,
        amount: paymentAmount,
        paymentDate: new Date(paymentDate),
        method,
      },
      where: { paymentId },
    });
  }
}

export const receivablePaymentRepository = new ReceivablePaymentRepository();
