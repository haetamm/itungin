import Joi, { ObjectSchema } from 'joi';
import { SaleRequest } from '../utils/interface';

const date = Joi.date().iso().max('now').required();
const customerId = Joi.string().uuid().required();
const invoiceNumber = Joi.string().max(50).required();
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

export const saleSchema: ObjectSchema<SaleRequest> = Joi.object({
  date,
  customerId,
  invoiceNumber,
  vatRateId,
  items,
  paymentType: Joi.string().valid('CASH', 'CREDIT', 'MIXED').required(),

  // cashAmount hanya wajib kalau MIXED
  cashAmount: Joi.when('paymentType', {
    is: 'MIXED',
    then: Joi.number().positive().required(),
    otherwise: Joi.forbidden(),
  }),
});
