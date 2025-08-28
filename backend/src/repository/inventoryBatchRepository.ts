import { Prisma } from '@prisma/client';
import { prismaClient } from '../application/database';

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
}

export const inventoryBatchRepository = new InventoryBatchRepository();
