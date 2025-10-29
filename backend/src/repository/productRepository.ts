import { Prisma, Product } from '@prisma/client';
import { prismaClient } from '../application/database';
import {
  ProductCreate,
  ProductUpdate,
  ProductUpdateTransaction,
} from '../utils/interface';
import { paginate } from '../utils/pagination';
import { Decimal } from '@prisma/client/runtime/library';

export class ProductRepository {
  async updateProductPriceById(
    data: {
      productId: string;
      avgPurchasePrice: Decimal;
      sellingPrice: Decimal;
    },
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Product> {
    const { productId, avgPurchasePrice, sellingPrice } = data;
    return await prismaTransaction.product.update({
      where: { productId, deletedAt: null },
      data: {
        avgPurchasePrice,
        sellingPrice,
      },
    });
  }

  async findAll(
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Product[]> {
    return await prismaTransaction.product.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findProductByProductCode(productCode: string): Promise<Product | null> {
    return await prismaClient.product.findUnique({
      where: { productCode },
    });
  }

  async findProductById(productId: string): Promise<Product | null> {
    return await prismaClient.product.findUnique({
      where: { productId, deletedAt: null },
    });
  }

  async updateProductById(
    productId: string,
    data: ProductUpdate,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Product> {
    return await prismaTransaction.product.update({
      where: { productId },
      data: {
        ...data,
      },
    });
  }

  async createProduct(data: ProductCreate): Promise<Product> {
    return prismaClient.product.create({
      data: data,
    });
  }

  async deleteProductById(productId: string): Promise<void> {
    await prismaClient.product.update({
      where: { productId },
      data: { deletedAt: new Date() },
    });
  }

  async getAllProduct(
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ) {
    const searchFilter = search
      ? {
          OR: [
            { productCode: { contains: search, mode: 'insensitive' } },
            { productName: { contains: search, mode: 'insensitive' } },
          ],
          deletedAt: null,
        }
      : { deletedAt: null };

    const result = await paginate<Product>(prismaClient.product, {
      page,
      limit,
      where: searchFilter,
      orderBy: { createdAt: 'desc' },
    });

    return { products: result.items, total: result.total };
  }

  async findProductTransaction(
    productId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Product | null> {
    return prismaTransaction.product.findUnique({
      where: { productId, deletedAt: null },
    });
  }

  async updateProductTransaction(
    data: ProductUpdateTransaction,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Product> {
    const { productId, stock, avgPurchasePrice, profitMargin, sellingPrice } =
      data;
    return prismaTransaction.product.update({
      where: { productId },
      data: {
        stock,
        avgPurchasePrice,
        profitMargin,
        sellingPrice,
      },
    });
  }

  async decrementStock(
    productId: string,
    quantity: number,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.product.update({
      where: { productId },
      data: { stock: { decrement: quantity } },
    });
  }

  async incrementStock(
    productId: string,
    quantity: number,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return await prismaTransaction.product.update({
      where: { productId },
      data: { stock: { increment: quantity } },
    });
  }
}

export const productRepository = new ProductRepository();
