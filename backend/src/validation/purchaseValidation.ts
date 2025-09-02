import { ObjectSchema } from 'joi';
import {
  CashOrCreditPurchaseRequest,
  DeletePurchaseRequest,
  MixedPurchaseRequest,
} from '../utils/interface';

const Joi = require('joi');

const date = Joi.date().iso().max('now').required();
const supplierId = Joi.string().uuid().required();
const purchaseId = Joi.string().uuid().required();
const invoiceNumber = Joi.string().max(50).required();
const vatRateId = Joi.string().uuid().required();
// const inventoryAccountCode = Joi.string().max(50).required();
// const vatInputAccountCode = Joi.string().max(50).required();
// const cashAccountCode = Joi.string().max(50).required();
// const payableAccountCode = Joi.string().max(50).required();
const cashAmount = Joi.number().positive().required();

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

export const purchaseCashOrCreditSchema: ObjectSchema<CashOrCreditPurchaseRequest> =
  Joi.object({
    date,
    supplierId,
    invoiceNumber,
    vatRateId,
    items,
  });

export const purchaseMixedSchema: ObjectSchema<MixedPurchaseRequest> =
  Joi.object({
    date,
    supplierId,
    invoiceNumber,
    vatRateId,
    items,
    cashAmount,
  });

export const deletePurchaseSchema: ObjectSchema<DeletePurchaseRequest> =
  Joi.object({
    purchaseId,
  });
