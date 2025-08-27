import { SaleDetail } from '@prisma/client';
import { prismaClient } from '../application/database';

export class SaleDetailRepository {
  async getSalesByProduct(productId: string): Promise<SaleDetail[]> {
    return prismaClient.saleDetail.findMany({
      where: { productId },
    });
  }
}

export const saleDetailRepository = new SaleDetailRepository();
