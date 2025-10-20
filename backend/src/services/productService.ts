import { ProductForm, ProductUpdate } from '../utils/interface';
import { validate } from '../validation/validation';
import { storeProduct, updateProduct } from '../validation/productValidation';
import { Prisma, Product } from '@prisma/client';
import { productRepository } from '../repository/productRepository';
import { ResponseError } from '../entities/responseError';
import { Decimal } from '@prisma/client/runtime/library';
import { generalSettingRepository } from '../repository/generalSettingRepository';
import { recalculateCOGS } from '../utils/cogs';
import { prismaClient } from '../application/database';

export class ProductService {
  private async ensureProductCodeUnique(productCode: string) {
    const existing =
      await productRepository.findProductByProductCode(productCode);

    if (existing) {
      throw new ResponseError(400, 'Product code already exists');
    }
  }

  async createProduct({ body }: { body: ProductForm }): Promise<Product> {
    const productReq = validate(storeProduct, body);
    await this.ensureProductCodeUnique(productReq.productCode);
    const productWithDefaults = {
      ...productReq,
      avgPurchasePrice: 0,
      profitMargin: 0,
      sellingPrice: 0,
      stock: 0,
    };

    const product = await productRepository.createProduct(productWithDefaults);
    return product;
  }

  async updateProductById(
    { body }: { body: ProductUpdate },
    id: string
  ): Promise<Product> {
    const productReq = validate(updateProduct, body);

    return await prismaClient.$transaction(async (prismaTransaction) => {
      // Ambil pengaturan saat ini
      const setting = await generalSettingRepository.getSetting();
      if (!setting) {
        throw new ResponseError(400, 'Method inventory not configured');
      }
      const inventoryMethod = setting.inventoryMethod;

      // Ambil produk
      const product = await this.getProductById(id);
      if (product.productCode !== productReq.productCode) {
        await this.ensureProductCodeUnique(productReq.productCode);
      }

      let cogs: Decimal = product.avgPurchasePrice; // Harga pokok sebelumnya
      let sellingPrice: Decimal = product.sellingPrice; // Harga jual sebelumnya

      // Jika profitMargin berubah, hitung ulang COGS dan sellingPrice
      if (
        productReq.profitMargin &&
        productReq.profitMargin !== product.profitMargin.toNumber()
      ) {
        cogs = await recalculateCOGS(
          product.productId,
          inventoryMethod,
          prismaTransaction
        );
        const profitMargin = new Decimal(productReq.profitMargin);
        sellingPrice = cogs.add(profitMargin);
      }

      // Perbarui produk
      const updated = await productRepository.updateProductById(
        product.productId,
        {
          ...productReq,
          avgPurchasePrice: cogs,
          sellingPrice,
        } as any,
        prismaTransaction
      );

      return updated;
    });
  }

  async getProductById(id: string) {
    const product = await productRepository.findProductById(id);
    if (!product) throw new ResponseError(404, 'Product not found');
    return product;
  }

  async getAllProduct(
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ) {
    if (page < 1 || limit < 1) {
      throw new ResponseError(400, 'Halaman dan batas harus bilangan positif');
    }

    const { products, total } = await productRepository.getAllProduct(
      page,
      limit,
      search
    );

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
    };
  }

  async deleteProductById(id: string) {
    const { productId } = await this.getProductById(id);
    await productRepository.deleteProductById(productId);
  }

  async getProduct(
    productId: string,
    prismaTransaction: Prisma.TransactionClient
  ) {
    const product = await productRepository.findProductTransaction(
      productId,
      prismaTransaction
    );
    if (!product) {
      throw new ResponseError(404, `Product ${productId} not found`);
    }
    return product;
  }
}

export const productService = new ProductService();
