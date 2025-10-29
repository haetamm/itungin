import { ObjectSchema } from 'joi';
import { PurchaseReturnRequest } from '../utils/interface';

const Joi = require('joi');

const returnDate = Joi.date().iso().max('now').required();
const purchaseId = Joi.string().uuid().required();
const reason = Joi.string().max(255).required();

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

export const purchaseReturnSchema: ObjectSchema<PurchaseReturnRequest> =
  Joi.object({
    purchaseId,
    returnDate,
    reason,
    items,
  });
