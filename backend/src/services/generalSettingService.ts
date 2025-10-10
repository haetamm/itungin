import { GeneralSetting } from '@prisma/client';
import { SettingForm } from '../utils/interface';
import { validate } from '../validation/validation';
import { ResponseError } from '../entities/responseError';
import { storeSettings } from '../validation/settingValidation';
import { generalSettingRepository } from '../repository/generalSettingRepository';

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
        'The inventory method has already been configured and cannot be changed'
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
}

export const generalsettingService = new GeneralSettingService();
