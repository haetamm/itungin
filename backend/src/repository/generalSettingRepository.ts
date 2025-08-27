import { GeneralSetting } from '@prisma/client';
import { prismaClient } from '../application/database';

export class GeneralSettingRepository {
  async getSetting(): Promise<GeneralSetting | null> {
    const setting = await prismaClient.generalSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    return setting;
  }
}

export const generalSettingRepository = new GeneralSettingRepository();
