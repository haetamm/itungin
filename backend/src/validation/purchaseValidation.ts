import { ObjectSchema } from 'joi';
import {
  CashPurchaseRequest,
  CreditPurchaseRequest,
  MixedPurchaseRequest,
} from '../utils/interface';

const Joi = require('joi');

const date = Joi.date().iso().max('now').required();
const supplierId = Joi.string().uuid().required();
const invoiceNumber = Joi.string().max(50).required();
const vatRateId = Joi.string().uuid().required();
const productId = Joi.string().uuid().required();
const quantity = Joi.number().integer().min(1).required();
const unitPrice = Joi.number().positive().required();
const inventoryAccountCode = Joi.string().max(50).required();
const vatInputAccountCode = Joi.string().max(50).required();
const cashAccountCode = Joi.string().max(50).required();
const payableAccountCode = Joi.string().max(50).required();
const cashAmount = Joi.number().positive().required();

const items = Joi.array()
  .min(1)
  .items(
    Joi.object({
      productId,
      quantity,
      unitPrice,
    })
  )
  .required()
  .messages({
    'array.min': 'At least one item is required',
    'any.required': 'Items array is required',
  });

export const purchaseCashSchema: ObjectSchema<CashPurchaseRequest> = Joi.object(
  {
    date,
    supplierId,
    invoiceNumber,
    vatRateId,
    items,
    cashAccountCode,
    inventoryAccountCode,
    vatInputAccountCode,
  }
);

export const purchaseCreditSchema: ObjectSchema<CreditPurchaseRequest> =
  Joi.object({
    date,
    supplierId,
    invoiceNumber,
    vatRateId,
    items,
    payableAccountCode,
    inventoryAccountCode,
    vatInputAccountCode,
  });

export const purchaseMixedSchema: ObjectSchema<MixedPurchaseRequest> =
  Joi.object({
    date,
    supplierId,
    invoiceNumber,
    vatRateId,
    items,
    cashAccountCode,
    cashAmount,
    payableAccountCode,
    inventoryAccountCode,
    vatInputAccountCode,
  });
