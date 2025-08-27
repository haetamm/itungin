import { prismaClient } from '../application/database';

export class InventoryBatchRepository {
  async getBatchesByProduct(productId: string) {
    return await prismaClient.inventoryBatch.findMany({
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
