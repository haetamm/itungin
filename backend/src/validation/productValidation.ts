import Joi, { ObjectSchema } from 'joi';

import { ProductForm, ProductUpdate } from '../utils/interface';

export const storeProduct: ObjectSchema<ProductForm> = Joi.object({
  productCode: Joi.string().max(20).required().trim(),
  productName: Joi.string().max(255).required().trim(),
  category: Joi.string().max(100).trim().allow(null, ''),
});

export const updateProduct: ObjectSchema<ProductUpdate> = Joi.object({
  productCode: Joi.string().max(20).required().trim(),
  productName: Joi.string().max(255).required().trim(),
  category: Joi.string().max(100).trim().allow(null, ''),
  profitMargin: Joi.number().precision(2).positive().allow(null).empty(''),
});
