import { ObjectSchema } from 'joi';
import { UpdateSaleDetail } from '../utils/interface';

const Joi = require('joi');

const saleId = Joi.string().uuid().required();
const vatRateId = Joi.string().uuid().required();

const productId = Joi.string().uuid().required().messages({
  'any.required': 'Product ID is required',
});

const quantity = Joi.number().integer().min(1).required().messages({
  'any.required': 'Quantity is required',
});

const items = Joi.array()
  .min(1)
  .items(
    Joi.object({
      productId,
      quantity,
    })
  )
  .required()
  .messages({
    'array.min': 'At least one item is required',
    'any.required': 'Items array is required',
  });

export const updateSaleDetailSchema: ObjectSchema<UpdateSaleDetail> =
  Joi.object({
    saleId,
    vatRateId,
    items,
  });
