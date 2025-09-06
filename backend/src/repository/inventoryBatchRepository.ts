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
        purchaseDetailId: data.purchaseDetailId,
      },
    });
  }

  async deleteBatchByPurchaseDetail(
    purchaseDetailId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.inventoryBatch.deleteMany({
      where: { purchaseDetailId },
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

  async findBatchesForProduct(
    productId: string,
    inventoryMethod: 'FIFO' | 'LIFO' | 'AVG',
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.inventoryBatch.findMany({
      where: {
        productId,
        remainingStock: { gt: 0 },
      },
      orderBy:
        inventoryMethod === 'FIFO'
          ? { purchaseDate: 'asc' }
          : { purchaseDate: 'desc' },
    });
  }

  async decrementBatchStock(
    batchId: string,
    quantity: number,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.inventoryBatch.update({
      where: { batchId },
      data: { remainingStock: { decrement: quantity } },
    });
  }

  async calculateAvgPurchasePrice(
    productId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const batches = await prismaTransaction.inventoryBatch.findMany({
      where: {
        productId,
        remainingStock: { gt: 0 },
      },
    });

    const totalQuantity = batches.reduce(
      (sum, batch) => sum + batch.remainingStock,
      0
    );
    const totalCost = batches.reduce(
      (sum, batch) =>
        sum.plus(new Decimal(batch.purchasePrice).times(batch.remainingStock)),
      new Decimal(0)
    );
    return totalCost.div(totalQuantity || 1).toDecimalPlaces(2);
  }
}

export const inventoryBatchRepository = new InventoryBatchRepository();
