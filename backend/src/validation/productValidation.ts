import Joi, { ObjectSchema } from 'joi';

import { ProductForm, ProductUpdate } from '../utils/interface';

const productCode = Joi.string().max(20).required().trim();
const productName = Joi.string().max(255).required().trim();
const category = Joi.string().max(100).trim().allow(null, '');
const unit = Joi.string().max(20).required().trim();
const profitMargin = Joi.number().precision(2).positive().allow(null).empty('');

export const storeProduct: ObjectSchema<ProductForm> = Joi.object({
  productCode,
  productName,
  category,
  unit,
});

export const updateProduct: ObjectSchema<ProductUpdate> = Joi.object({
  productCode,
  productName,
  category,
  unit,
  profitMargin,
});
