import {
  Journal,
  JournalEntry,
  Payable,
  Prisma,
  Purchase,
  PurchaseDetail,
} from '@prisma/client';
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

  async findPurchaseByIdTransaction(
    purchaseId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<
    | (Purchase & {
        journal: Journal & { journalEntries: JournalEntry[] };
        payables: Payable[];
        purchaseDetails: PurchaseDetail[];
      })
    | null
  > {
    return await prismaTransaction.purchase.findUnique({
      where: { purchaseId },
      include: {
        journal: {
          include: {
            journalEntries: true,
          },
        },
        payables: true,
        purchaseDetails: true,
      },
    });
  }
}

export const purchaseRepository = new PurchaseRepository();
