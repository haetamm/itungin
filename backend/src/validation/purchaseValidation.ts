import { ObjectSchema } from 'joi';
import {
  DeletePurchaseRequest,
  PurchaseRequest,
  UpdatePurchaseRequest,
} from '../utils/interface';

const Joi = require('joi');

const date = Joi.date().iso().max('now').required();
const supplierId = Joi.string().uuid().required();
const purchaseId = Joi.string().uuid().required();
const invoiceNumber = Joi.string().max(50).required();
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

export const deletePurchaseSchema: ObjectSchema<DeletePurchaseRequest> =
  Joi.object({
    purchaseId,
  });

export const purchaseSchema: ObjectSchema<PurchaseRequest> = Joi.object({
  date,
  supplierId,
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

  dueDate: Joi.when('paymentType', {
    is: Joi.valid('CREDIT', 'MIXED'),
    then: Joi.date()
      .iso()
      .required()
      .custom((value: any, helpers: import('joi').CustomHelpers) => {
        const { date } = helpers.state.ancestors[0];
        if (!date) return value;
        const purchaseDate = new Date(date);
        const dueDate = new Date(value);
        // Add 1 day to purchaseDate
        purchaseDate.setDate(purchaseDate.getDate() + 1);
        if (dueDate < purchaseDate) {
          return helpers.error('date.min', {
            limit: purchaseDate.toISOString(),
          });
        }
        return value;
      }, 'Due date must be at least one day after sale date'),
    otherwise: Joi.forbidden(),
  }),
});

export const updatePurchaseSchema: ObjectSchema<UpdatePurchaseRequest> =
  Joi.object({
    date,
    supplierId,
    invoiceNumber,
    paymentType: Joi.string().valid('CASH', 'CREDIT', 'MIXED').required(),
    // cashAmount hanya wajib kalau MIXED
    cashAmount: Joi.when('paymentType', {
      is: 'MIXED',
      then: Joi.number().positive().required(),
      otherwise: Joi.forbidden(),
    }),

    dueDate: Joi.when('paymentType', {
      is: Joi.valid('CREDIT', 'MIXED'),
      then: Joi.date()
        .iso()
        .required()
        .custom((value: any, helpers: import('joi').CustomHelpers) => {
          const { date } = helpers.state.ancestors[0];
          if (!date) return value;
          const purchaseDate = new Date(date);
          const dueDate = new Date(value);
          // Add 1 day to purchaseDate
          purchaseDate.setDate(purchaseDate.getDate() + 1);
          if (dueDate < purchaseDate) {
            return helpers.error('date.min', {
              limit: purchaseDate.toISOString(),
            });
          }
          return value;
        }, 'Due date must be at least one day after sale date'),
      otherwise: Joi.forbidden(),
    }),
  });
