import Joi, { ObjectSchema } from "joi";
import { SupplierForm } from "../utils/interface";

export const formSupplier: ObjectSchema<SupplierForm> = Joi.object({
  name: Joi.string().trim().min(1).max(20).required(),
  phone: Joi.string().trim().min(6).max(16).pattern(/^[0-9+]+$/).allow(null, '').messages({
    'string.pattern.base': 'Phone number can only contain numbers and the "+" symbol.'
  }),
  email: Joi.string().min(1).email().allow(null, ''),
  address: Joi.string().max(50).allow(null, '')
});