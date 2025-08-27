import { ProductForm, ProductUpdate } from '../utils/interface';
import { validate } from '../validation/validation';
import { storeProduct, updateProduct } from '../validation/productValidation';
import { InventoryMethod, Product } from '@prisma/client';
import { productRepository } from '../repository/productRepository';
import { ResponseError } from '../entities/responseError';
import { inventoryBatchRepository } from '../repository/inventoryBatchRepository';
import { Decimal } from '@prisma/client/runtime/library';
import { saleDetailRepository } from '../repository/saleDetailRepository';
import { generalSettingRepository } from '../repository/generalSettingRepository';

export class ProductService {
  private async ensureProductCodeUnique(productCode: string) {
    const existing =
      await productRepository.findProductByProductCode(productCode);

    if (existing) {
      throw new ResponseError(400, 'Product code already exists');
    }
  }

  private async recalculateCOGS(productId: string, method: InventoryMethod) {
    const batches =
      await inventoryBatchRepository.getBatchesByProduct(productId);
    const sales = await saleDetailRepository.getSalesByProduct(productId);

    if (batches.length === 0) return new Decimal(0);

    // hitung remaining stock per batch
    const batchStock: { batchId: string; remaining: number; price: Decimal }[] =
      batches.map((b) => ({
        batchId: b.batchId,
        remaining: b.remainingStock,
        price: b.purchasePrice,
      }));

    // kurangi stock sesuai sale detail
    for (const s of sales) {
      if (!s.batchId) continue;
      const batch = batchStock.find((b) => b.batchId === s.batchId);
      if (batch) batch.remaining -= s.quantity;
    }

    // hitung COGS sesuai metode inventory
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

    const setting = await generalSettingRepository.getSetting();
    if (!setting) throw new ResponseError(400, 'Set inventory method first');
    const inventoryMethod = setting.inventoryMethod;

    const product = await this.getProductById(id);
    let cogs: Decimal = product.avgPurchasePrice; // harga pokok sebelumnya
    let sellingPrice: Decimal = product.sellingPrice; // harga jual sebelumnya

    // jika profitMargin berubah, hitung ulang sellingPrice (harga jual)
    if (productReq.profitMargin !== product.profitMargin.toNumber()) {
      cogs = await this.recalculateCOGS(product.productId, inventoryMethod);
      sellingPrice = cogs.add(new Decimal(productReq.profitMargin));
    }

    // update produk
    const updated = await productRepository.updateProductById(
      product.productId,
      {
        ...productReq,
        avgPurchasePrice: cogs,
        sellingPrice,
      } as any
    );

    return updated;
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
}

export const productService = new ProductService();
