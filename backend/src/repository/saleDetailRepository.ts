import { Prisma, SaleDetail } from '@prisma/client';
// import { prismaClient } from '../application/database';

export class SaleDetailRepository {
  async getSalesByProduct(
    productId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<SaleDetail[]> {
    return prismaTransaction.saleDetail.findMany({
      where: { productId },
    });
  }
}

export const saleDetailRepository = new SaleDetailRepository();
