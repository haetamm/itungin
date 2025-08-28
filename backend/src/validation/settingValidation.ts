import Joi, { ObjectSchema } from 'joi';
import { SettingForm } from '../utils/interface';
import { InventoryMethod } from '@prisma/client';

export const storeSettings: ObjectSchema<SettingForm> = Joi.object({
  inventoryMethod: Joi.string()
    .valid(...Object.values(InventoryMethod))
    .required(),
});
