import { Prisma, ReturnStatus } from '@prisma/client';
import { PurchaseReturnForm } from '../utils/interface';

export class PurchaseReturnRepository {
  async createPurchaseReturn(
    data: PurchaseReturnForm,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.purchaseReturn.create({
      data,
    });
  }

  async getPurchaseReturnById(
    returnId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.purchaseReturn.findUnique({
      where: { returnId },
      include: {
        purchase: {
          include: {
            supplier: true,
            payable: {
              include: {
                payments: {
                  include: {
                    journalEntry: true,
                  },
                },
              },
            },
          },
        },
        returnDetails: {
          include: {
            product: true,
            inventoryBatch: true,
          },
        },
        journal: {
          include: {
            journalEntries: true,
          },
        },
      },
    });
  }

  async updatePurchaseReturnStatus(
    returnId: string,
    status: ReturnStatus,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.purchaseReturn.update({
      where: { returnId },
      data: { status },
    });
  }

  async deletePurchaseReturnById(
    returnId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.purchaseReturn.delete({
      where: { returnId },
    });
  }
}

export const purchaseReturnRepository = new PurchaseReturnRepository();
