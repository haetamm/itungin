import { Prisma, PurchaseDetail } from '@prisma/client';
import { PurchaseDetailForm } from '../utils/interface';

export class PurchaseDetailRepository {
  async createPurchaseDetail(
    data: PurchaseDetailForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<PurchaseDetail> {
    const { purchaseId, productId, quantity, unitPrice, subtotal } = data;
    return prismaTransaction.purchaseDetail.create({
      data: {
        purchaseId,
        productId,
        quantity,
        unitPrice,
        subtotal,
      },
    });
  }

  async deleteByPurchaseId(
    purchaseId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.purchaseDetail.deleteMany({
      where: {
        purchaseId,
      },
    });
  }
}

export const purchaseDetailRepository = new PurchaseDetailRepository();
