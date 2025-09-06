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
}

export const saleDetailRepository = new SaleDetailRepository();
