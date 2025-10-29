import { Prisma } from '@prisma/client';
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
}

export const purchaseReturnRepository = new PurchaseReturnRepository();
