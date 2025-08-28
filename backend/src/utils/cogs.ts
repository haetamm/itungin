import { Decimal } from '@prisma/client/runtime/library';
import { InventoryMethod, Prisma } from '@prisma/client';
import { inventoryBatchRepository } from '../repository/inventoryBatchRepository';
import { saleDetailRepository } from '../repository/saleDetailRepository';

export async function recalculateCOGS(
  productId: string,
  method: InventoryMethod,
  prismaTransaction: Prisma.TransactionClient
): Promise<Decimal> {
  const batches = await inventoryBatchRepository.getBatchesByProduct(
    productId,
    prismaTransaction
  );
  const sales = await saleDetailRepository.getSalesByProduct(
    productId,
    prismaTransaction
  );

  if (batches.length === 0) return new Decimal(0);

  // Hitung remaining stock per batch
  const batchStock: { batchId: string; remaining: number; price: Decimal }[] =
    batches.map((b) => ({
      batchId: b.batchId,
      remaining: b.remainingStock,
      price: b.purchasePrice,
    }));

  // Kurangi stock sesuai sale detail
  for (const s of sales) {
    if (!s.batchId) continue;
    const batch = batchStock.find((b) => b.batchId === s.batchId);
    if (batch) batch.remaining -= s.quantity;
  }

  // Hitung COGS sesuai metode inventory
  if (method === InventoryMethod.FIFO) {
    const firstAvailable = batchStock.find((b) => b.remaining > 0);
    return firstAvailable ? firstAvailable.price : new Decimal(0);
  }

  if (method === InventoryMethod.LIFO) {
    const lastAvailable = [...batchStock]
      .reverse()
      .find((b) => b.remaining > 0);
    return lastAvailable ? lastAvailable.price : new Decimal(0);
  }

  if (method === InventoryMethod.AVG) {
    const totalQty = batchStock.reduce(
      (sum, b) => sum + Math.max(b.remaining, 0),
      0
    );
    const totalCost = batchStock.reduce(
      (sum, b) => sum + Math.max(b.remaining, 0) * b.price.toNumber(),
      0
    );
    return totalQty > 0 ? new Decimal(totalCost / totalQty) : new Decimal(0);
  }

  return new Decimal(0);
}
