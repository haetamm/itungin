import { GeneralSetting } from '@prisma/client';
import { SettingForm } from '../utils/interface';
import { validate } from '../validation/validation';
import { ResponseError } from '../entities/responseError';
import { storeSettings } from '../validation/settingValidation';
import { generalSettingRepository } from '../repository/generalSettingRepository';
import { purchaseRepository } from '../repository/purchaseRepository';

export class GeneralSettingService {
  async createSetting({
    body,
  }: {
    body: SettingForm;
  }): Promise<GeneralSetting> {
    const settingReq = validate(storeSettings, body);

    const setting = await generalSettingRepository.getSetting();
    if (setting?.inventoryMethod) {
      throw new ResponseError(
        400,
        'The inventory method has already been configured'
      );
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

    const purchaseCount = await purchaseRepository.getPurchaseCount();
    if (purchaseCount > 0) {
      throw new ResponseError(
        400,
        'General settings cannot be updated because purchases have already occurred.'
      );
    }

    // Perbarui pengaturan
    return await generalSettingRepository.updateSettingById(
      currentSetting.id,
      settingReq
    );
  }
}

export const generalsettingService = new GeneralSettingService();
