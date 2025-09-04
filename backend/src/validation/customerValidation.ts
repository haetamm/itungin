import Joi, { ObjectSchema } from 'joi';
import { CustomerForm } from '../utils/interface';

export const formCustomer: ObjectSchema<CustomerForm> = Joi.object({
  customerName: Joi.string().trim().min(1).required(),
  phone: Joi.string()
    .trim()
    .min(6)
    .max(16)
    .pattern(/^[0-9+]+$/)
    .allow(null, '')
    .messages({
      'string.pattern.base':
        'Phone number can only contain numbers and the "+" symbol.',
    }),
  address: Joi.string().max(50).allow(null, ''),
});
