import Joi, { ObjectSchema } from 'joi';
import { VatForm } from '../utils/interface';

export const storeVat: ObjectSchema<VatForm> = Joi.object({
  vatRate: Joi.number().min(0).max(100).precision(2).required(),
  effectiveDate: Joi.date().iso().required(),
});
