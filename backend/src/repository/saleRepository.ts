import { Prisma, Sale } from '@prisma/client';
import { SaleForm } from '../utils/interface';

export class SaleRepository {
  async findInvoiceNumber(
    invoiceNumber: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Sale | null> {
    return await prismaTransaction.sale.findUnique({
      where: { invoiceNumber },
    });
  }

  async createSale(
    data: SaleForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Sale> {
    return prismaTransaction.sale.create({
      data: {
        date: data.date instanceof Date ? data.date : new Date(data.date),
        customerId: data.customerId,
        journalId: data.journalId,
        invoiceNumber: data.invoiceNumber,
        paymentType: data.paymentType,
        subtotal: data.subtotal,
        vat: data.vat,
        total: data.total,
      },
    });
  }

  async findSaleByIdTransaction(
    saleId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Sale | null> {
    return await prismaTransaction.sale.findUnique({
      where: { saleId },
    });
  }
}

export const saleRepository = new SaleRepository();
