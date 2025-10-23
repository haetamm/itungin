import { InventoryBatch, Prisma } from '@prisma/client';
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

  async createInventoryBatch(
    data: InventoryBatchForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<InventoryBatch> {
    const {
      productId,
      purchaseDate,
      quantity,
      purchasePrice,
      remainingStock,
      purchaseDetailId,
    } = data;
    return prismaTransaction.inventoryBatch.create({
      data: {
        productId,
        purchaseDate,
        quantity,
        purchasePrice,
        remainingStock,
        purchaseDetailId,
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

  async findBatchesForProduct(
    productId: string,
    inventoryMethod: 'FIFO' | 'LIFO' | 'AVG',
    prismaTransaction: Prisma.TransactionClient
  ) {
    const baseWhere = {
      productId,
      remainingStock: { gt: 0 },
    };

    switch (inventoryMethod) {
      case 'FIFO':
        return await prismaTransaction.inventoryBatch.findMany({
          where: baseWhere,
          orderBy: { purchaseDate: 'asc' },
        });

      case 'LIFO':
        return await prismaTransaction.inventoryBatch.findMany({
          where: baseWhere,
          orderBy: { purchaseDate: 'desc' },
        });

      case 'AVG':
        return await prismaTransaction.inventoryBatch.findMany({
          where: baseWhere,
          orderBy: { purchaseDate: 'asc' },
        });
    }
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

  async incrementBatchStock(
    batchId: string,
    quantity: number,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.inventoryBatch.update({
      where: { batchId },
      data: { remainingStock: { increment: quantity } },
    });
  }

  async findBatchesByPurchaseDetail(
    purchaseDetailId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<InventoryBatch[]> {
    return await prismaTransaction.inventoryBatch.findMany({
      where: { purchaseDetailId },
    });
  }

  async findBatchById(
    batchId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.inventoryBatch.findMany({
      where: { batchId },
      orderBy: { purchaseDate: 'asc' },
    });
  }

  async findByPurchaseDetailId(
    purchaseDetailId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<InventoryBatch | null> {
    return await prismaTransaction.inventoryBatch.findUnique({
      where: {
        purchaseDetailId,
      },
    });
  }
}

export const inventoryBatchRepository = new InventoryBatchRepository();
