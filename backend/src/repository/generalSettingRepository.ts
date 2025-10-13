import { GeneralSetting, Prisma } from '@prisma/client';
import { prismaClient } from '../application/database';
import { SettingForm } from '../utils/interface';

export class GeneralSettingRepository {
  async createSetting(data: SettingForm): Promise<GeneralSetting> {
    return prismaClient.generalSetting.create({
      data: data,
    });
  }

  async getSetting(): Promise<GeneralSetting | null> {
    const setting = await prismaClient.generalSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    return setting;
  }

  async getSettingTransaction(
    prismaTransaction: Prisma.TransactionClient
  ): Promise<GeneralSetting | null> {
    const setting = await prismaTransaction.generalSetting.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    return setting;
  }

  async updateSettingById(
    id: string,
    data: SettingForm
  ): Promise<GeneralSetting> {
    return await prismaClient.generalSetting.update({
      where: { id },
      data: {
        ...data,
      },
    });
  }
}

export const generalSettingRepository = new GeneralSettingRepository();
