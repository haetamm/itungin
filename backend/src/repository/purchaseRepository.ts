import { Prisma, Purchase } from '@prisma/client';
import { PurchaseForm } from '../utils/interface';

export class PurchaseRepository {
  async createPurchase(
    data: PurchaseForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Purchase> {
    return prismaTransaction.purchase.create({
      data: {
        date: data.date instanceof Date ? data.date : new Date(data.date),
        supplierId: data.supplierId,
        invoiceNumber: data.invoiceNumber,
        paymentType: data.paymentType,
        subtotal: data.subtotal,
        vat: data.vat,
        total: data.total,
        journalId: data.journalId,
      },
    });
  }
}

export const purchaseRepository = new PurchaseRepository();
