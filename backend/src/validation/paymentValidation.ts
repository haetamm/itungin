import { ObjectSchema } from 'joi';
import { PaymentPayableRequest } from '../utils/interface';

const Joi = require('joi');

const payableId = Joi.string().uuid().required();
const paymentVoucher = Joi.string().required();
const amount = Joi.number().positive().precision(2).required();
const paymentDate = Joi.string().isoDate().required();
const method = Joi.string().trim().min(1).required();

export const paymentPayableSchema: ObjectSchema<PaymentPayableRequest> =
  Joi.object({
    payableId,
    paymentVoucher,
    amount,
    paymentDate,
    method,
  });

export const updatePaymentPayableSchema: ObjectSchema<PaymentPayableRequest> =
  Joi.object({
    paymentVoucher,
    amount,
    paymentDate,
    method,
  });
