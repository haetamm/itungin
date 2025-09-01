import { InventoryBatch, Prisma } from '@prisma/client';
import { prismaClient } from '../application/database';
import { InventoryBatchForm } from '../utils/interface';
import { Decimal } from '@prisma/client/runtime/library';

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

  async deleteBatchByPurchaseDetail(
    productId: string,
    purchaseDate: Date,
    purchasePrice: Decimal,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.inventoryBatch.deleteMany({
      where: {
        productId,
        purchaseDate,
        purchasePrice,
      },
    });
  }

  async findBatchesByProduct(
    productId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<InventoryBatch[]> {
    return await prismaTransaction.inventoryBatch.findMany({
      where: { productId },
    });
  }
}

export const inventoryBatchRepository = new InventoryBatchRepository();
