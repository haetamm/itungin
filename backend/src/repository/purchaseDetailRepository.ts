import { Prisma, PurchaseDetail } from '@prisma/client';
import { PurchaseDetailForm } from '../utils/interface';

export class PurchaseDetailRepository {
  async createPurchaseDetail(
    data: PurchaseDetailForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<PurchaseDetail> {
    return prismaTransaction.purchaseDetail.create({
      data: {
        purchaseId: data.purchaseId,
        productId: data.productId,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        subtotal: data.subtotal,
      },
    });
  }

  async createManyPurchaseDetails(
    data: PurchaseDetailForm[],
    prismaTransaction: Prisma.TransactionClient
  ): Promise<PurchaseDetail[]> {
    return Promise.all(
      data.map((item) =>
        prismaTransaction.purchaseDetail.create({
          data: {
            purchaseId: item.purchaseId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          },
        })
      )
    );
  }

  async deleteManyPurchaseDetails(
    purchaseDetailIds: string[],
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.purchaseDetail.deleteMany({
      where: {
        purchaseDetailId: { in: purchaseDetailIds },
      },
    });
  }

  async findPurchaseDetailById(
    purchaseDetailId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<
    | (PurchaseDetail & {
        purchase: { date: Date };
      })
    | null
  > {
    return await prismaTransaction.purchaseDetail.findUnique({
      where: { purchaseDetailId },
      include: { purchase: { select: { date: true } } },
    });
  }
}

export const purchaseDetailRepository = new PurchaseDetailRepository();
