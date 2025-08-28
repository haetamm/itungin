import { GeneralSetting, InventoryMethod, Prisma } from '@prisma/client';
import { SettingForm } from '../utils/interface';
import { validate } from '../validation/validation';
import { ResponseError } from '../entities/responseError';
import { storeSettings } from '../validation/settingValidation';
import { generalSettingRepository } from '../repository/generalSettingRepository';
import { productRepository } from '../repository/productRepository';
import { recalculateCOGS } from '../utils/cogs';
import { Decimal } from '@prisma/client/runtime/library';
import { prismaClient } from '../application/database';

export class GeneralSettingService {
  async createSetting({
    body,
  }: {
    body: SettingForm;
  }): Promise<GeneralSetting> {
    const settingReq = validate(storeSettings, body);

    const setting = await generalSettingRepository.getSetting();
    if (setting?.inventoryMethod) {
      throw new ResponseError(400, 'Inventory method already exists');
    }

    const result = await generalSettingRepository.createSetting(settingReq);
    return result;
  }

  async getSetting(): Promise<GeneralSetting> {
    const setting = await generalSettingRepository.getSetting();
    if (!setting) {
      throw new ResponseError(404, 'General setting not configured');
    }
    return setting;
  }

  async updateSetting({
    body,
  }: {
    body: SettingForm;
  }): Promise<GeneralSetting> {
    const settingReq = validate(storeSettings, body);
    const currentSetting = await this.getSetting();

    // Gunakan transaksi untuk memastikan pembaruan atomik
    return await prismaClient.$transaction(
      async (prismaTransaction) => {
        // Jika inventoryMethod berubah, perbarui semua produk
        if (settingReq.inventoryMethod !== currentSetting.inventoryMethod) {
          await this.updateAllProducts(
            settingReq.inventoryMethod,
            prismaTransaction
          );
        }

        // Perbarui pengaturan
        return await generalSettingRepository.updateSettingById(
          currentSetting.id,
          settingReq,
          prismaTransaction
        );
      },
      { timeout: 10000 }
    );
  }

  private async updateAllProducts(
    newInventoryMethod: InventoryMethod,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    // Ambil semua produk dalam transaksi
    const products = await productRepository.findAll(prismaTransaction);
    if (products.length === 0) {
      console.warn('No products available to update');
      return;
    }

    for (const product of products) {
      // Hitung COGS berdasarkan inventoryMethod baru
      const cogs = await recalculateCOGS(
        product.productId,
        newInventoryMethod,
        prismaTransaction
      );
      if (cogs.equals(0)) {
        console.warn(
          `No stock data for product ${product.productId}, skipping update`
        );
        continue;
      }

      const profitMargin = new Decimal(product.profitMargin || 0);
      const sellingPrice = cogs.add(profitMargin);

      // Perbarui produk menggunakan repository dalam transaksi
      await productRepository.updateProductPriceById(
        product.productId,
        cogs,
        sellingPrice,
        prismaTransaction
      );
    }
  }
}

export const generalsettingService = new GeneralSettingService();
