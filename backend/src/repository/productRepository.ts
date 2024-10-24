import { Product } from "@prisma/client";
import { prismaClient } from "../application/database";
import { ProductForm } from "../utils/interface";

export class ProductRepository {
    async findProductById(id: string): Promise<Product | null> {
        return await prismaClient.product.findUnique({
            where: { id, deletedAt: null }
        });
    }

    async createProduct(data: ProductForm): Promise<Product> {
        return prismaClient.product.create({
            data: data
        });
    }

    async updateProductById(id: string, data: ProductForm): Promise<Product>  {
        return await prismaClient.product.update({
            where: { id },
            data: {
                ...data
            }
        });
    }
    
    async deleteProductById(id: string): Promise<void> {
        await prismaClient.product.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async getAllProduct() {
        return await prismaClient.product.findMany({
            where: { deletedAt: null }
        });
    }
}

export const productRepository = new ProductRepository();
