import { ObjectSchema } from 'joi';
import {
  ReceivablePaymentRequest,
  UpdatePaymentReceivableRequest,
} from '../utils/interface';

const Joi = require('joi');

const receivableId = Joi.string().uuid().required();
const amount = Joi.number().positive().precision(2).required();
const paymentDate = Joi.string().isoDate().required();
const method = Joi.string().trim().min(1).required();

export const receivablePaymentSchema: ObjectSchema<ReceivablePaymentRequest> =
  Joi.object({
    receivableId,
    amount,
    paymentDate,
    method,
  });

export const updateReceivablePaymentSchema: ObjectSchema<UpdatePaymentReceivableRequest> =
  Joi.object({
    amount,
    paymentDate,
    method,
  });
