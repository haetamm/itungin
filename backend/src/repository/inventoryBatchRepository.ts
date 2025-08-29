import { InventoryBatch, Prisma } from '@prisma/client';
import { prismaClient } from '../application/database';
import { InventoryBatchForm } from '../utils/interface';

export class InventoryBatchRepository {
  async getBatchesByProduct(
    productId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.inventoryBatch.findMany({
      where: { productId },
      orderBy: { purchaseDate: 'asc' },
    });
  }

  async updateRemainingStock(batchId: string, remainingStock: number) {
    return prismaClient.inventoryBatch.update({
      where: { batchId },
      data: { remainingStock },
    });
  }

  async createInventoryBatch(
    data: InventoryBatchForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<InventoryBatch> {
    return prismaTransaction.inventoryBatch.create({
      data: {
        productId: data.productId,
        purchaseDate:
          data.purchaseDate instanceof Date
            ? data.purchaseDate
            : new Date(data.purchaseDate),
        quantity: data.quantity,
        purchasePrice: data.purchasePrice,
        remainingStock: data.remainingStock,
      },
    });
  }
}

export const inventoryBatchRepository = new InventoryBatchRepository();
