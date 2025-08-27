import { Product } from '@prisma/client';
import { prismaClient } from '../application/database';
import { ProductCreate, ProductUpdate } from '../utils/interface';
import { paginate } from '../utils/pagination';

export class ProductRepository {
  async findProductByProductCode(productCode: string): Promise<Product | null> {
    return await prismaClient.product.findUnique({
      where: { productCode, deletedAt: null },
    });
  }

  async findProductById(productId: string): Promise<Product | null> {
    return await prismaClient.product.findUnique({
      where: { productId, deletedAt: null },
    });
  }

  async updateProductById(
    productId: string,
    data: ProductUpdate
  ): Promise<Product> {
    return await prismaClient.product.update({
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
    limit: number = 1,
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
}

export const productRepository = new ProductRepository();
