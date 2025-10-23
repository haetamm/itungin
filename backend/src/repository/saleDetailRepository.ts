import { Prisma, SaleDetail } from '@prisma/client';
import { SaleDetailForm } from '../utils/interface';

export class SaleDetailRepository {
  async getSalesByProduct(
    productId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<SaleDetail[]> {
    return prismaTransaction.saleDetail.findMany({
      where: { productId },
    });
  }

  async createSaleDetail(
    data: SaleDetailForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<SaleDetail> {
    return prismaTransaction.saleDetail.create({
      data: {
        saleId: data.saleId,
        batchId: data.batchId,
        productId: data.productId,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        subtotal: data.subtotal,
      },
    });
  }

  async countByBatchId(
    batchId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<number> {
    return await prismaTransaction.saleDetail.count({
      where: { batchId },
    });
  }

  async deleteManySaleDetails(
    saleDetailIds: string[],
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.saleDetail.deleteMany({
      where: {
        saleDetailId: { in: saleDetailIds },
      },
    });
  }

  async deleteBySaleId(
    saleId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.saleDetail.deleteMany({
      where: { saleId },
    });
  }
}

export const saleDetailRepository = new SaleDetailRepository();
