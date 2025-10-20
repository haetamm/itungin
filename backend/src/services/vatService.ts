import { Prisma, VatSetting } from '@prisma/client';
import { VatForm } from '../utils/interface';
import { validate } from '../validation/validation';
import { ResponseError } from '../entities/responseError';
import { storeVat } from '../validation/vatValidation';
import { vatSettingRepository } from '../repository/vatSettingRepository';

export class VatService {
  async createVat({ body }: { body: VatForm }): Promise<VatSetting> {
    const vatReq = validate(storeVat, body);
    const vat = await vatSettingRepository.createVat(vatReq);
    return vat;
  }

  async updateVatById(
    { body }: { body: VatForm },
    id: string
  ): Promise<VatSetting> {
    const vatReq = validate(storeVat, body);
    const { vatId } = await this.getVatById(id);
    const vat = await vatSettingRepository.updateVatById(vatId, vatReq);
    return vat;
  }

  async getVatById(id: string) {
    const vat = await vatSettingRepository.findVatById(id);
    if (!vat) throw new ResponseError(404, 'Vat not found');
    return vat;
  }

  async getAllVat() {
    const vats = await vatSettingRepository.getAllVat();
    return vats;
  }

  async deleteVatById(id: string) {
    const { vatId } = await this.getVatById(id);
    await vatSettingRepository.deleteVatById(vatId);
  }

  async getVatSetting(
    id: string,
    prismaTransaction: Prisma.TransactionClient,
    date: Date
  ) {
    const vatSetting = await vatSettingRepository.findVatTransaction(
      id,
      prismaTransaction
    );
    if (!vatSetting) throw new ResponseError(404, 'VAT rate not found');
    if (vatSetting.effectiveDate > new Date(date))
      throw new ResponseError(400, 'VAT rate is not yet effective');
    return vatSetting;
  }
}

export const vatService = new VatService();
