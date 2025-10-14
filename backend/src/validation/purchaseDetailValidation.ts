import { ObjectSchema } from 'joi';
import { UpdatePurchaseDetail } from '../utils/interface';

const Joi = require('joi');

const purchaseId = Joi.string().uuid().required();
const vatRateId = Joi.string().uuid().required();

const productId = Joi.string().uuid().required().messages({
  'any.required': 'Product ID is required',
});

const quantity = Joi.number().integer().min(1).required().messages({
  'any.required': 'Quantity is required',
});

const unitPrice = Joi.number().positive().required().messages({
  'any.required': 'Unit Price is required',
});

const profitMargin = Joi.number().precision(2).positive().required().messages({
  'any.required': 'Profit Margin is required',
});

const items = Joi.array()
  .min(1)
  .items(
    Joi.object({
      productId,
      quantity,
      unitPrice,
      profitMargin,
    })
  )
  .required()
  .messages({
    'array.min': 'At least one item is required',
    'any.required': 'Items array is required',
  });

export const updatePurchaseDetailSchema: ObjectSchema<UpdatePurchaseDetail> =
  Joi.object({
    purchaseId,
    vatRateId,
    items,
  });
