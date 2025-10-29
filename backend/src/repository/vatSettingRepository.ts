import { Prisma, VatSetting } from '@prisma/client';
import { prismaClient } from '../application/database';
import { VatForm } from '../utils/interface';

export class VatSettingRepository {
  async findVatById(vatId: string): Promise<VatSetting | null> {
    return await prismaClient.vatSetting.findUnique({
      where: { vatId, deletedAt: null },
    });
  }

  async createVat(data: VatForm): Promise<VatSetting> {
    return prismaClient.vatSetting.create({
      data: data,
    });
  }

  async updateVatById(vatId: string, data: VatForm): Promise<VatSetting> {
    return await prismaClient.vatSetting.update({
      where: { vatId },
      data: {
        ...data,
      },
    });
  }

  async deleteVatById(vatId: string): Promise<void> {
    await prismaClient.vatSetting.update({
      where: { vatId },
      data: { deletedAt: new Date() },
    });
  }

  async getAllVat() {
    return await prismaClient.vatSetting.findMany({
      where: { deletedAt: null },
    });
  }

  async findVatTransaction(
    vatId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<VatSetting | null> {
    return prismaTransaction.vatSetting.findUnique({
      where: { vatId, deletedAt: null },
    });
  }

  async getActiveVatSetting(
    date: Date,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<VatSetting | null> {
    return await prismaTransaction.vatSetting.findFirst({
      where: {
        effectiveDate: { lte: date },
        deletedAt: null,
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });
  }
}

export const vatSettingRepository = new VatSettingRepository();
