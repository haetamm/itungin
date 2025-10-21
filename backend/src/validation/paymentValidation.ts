import { ObjectSchema } from 'joi';
import { PaymentPayableRequest } from '../utils/interface';

const Joi = require('joi');

const payableId = Joi.string().uuid().required();
const amount = Joi.number().positive().precision(2).required();
const paymentDate = Joi.string().isoDate().required();
const method = Joi.string().trim().min(1).required();

export const paymentPayableSchema: ObjectSchema<PaymentPayableRequest> =
  Joi.object({
    payableId,
    amount,
    paymentDate,
    method,
  });

export const updatePaymentPayableSchema: ObjectSchema<PaymentPayableRequest> =
  Joi.object({
    amount,
    paymentDate,
    method,
  });
