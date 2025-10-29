import { Prisma } from '@prisma/client';
import { PurchaseReturnDetailForm } from '../utils/interface';

export class PurchaseReturnDetailRepository {
  async createManyPurchaseReturnDetails(
    returnId: string,
    data: PurchaseReturnDetailForm[],
    prismaTransaction: Prisma.TransactionClient
  ) {
    return prismaTransaction.purchaseReturnDetail.createMany({
      data: data.map((d) => ({ returnId, ...d })),
    });
  }
}

export const purchaseReturnDetailRepository =
  new PurchaseReturnDetailRepository();
