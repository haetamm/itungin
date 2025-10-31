import Joi, { ObjectSchema } from 'joi';
import {
  ReceivablePaymentRequest,
  UpdatePaymentReceivableRequest,
} from '../utils/interface';

const receivableId = Joi.string().uuid().required();
const receiveVoucher = Joi.string().trim().required();
const amount = Joi.number().positive().precision(2).required();
const paymentDate = Joi.string().isoDate().required();
const method = Joi.string().valid('CASH', 'RETURN').required();

export const receivablePaymentSchema: ObjectSchema<ReceivablePaymentRequest> =
  Joi.object({
    receivableId,
    receiveVoucher,
    amount,
    paymentDate,
    method,
  });

export const updateReceivablePaymentSchema: ObjectSchema<UpdatePaymentReceivableRequest> =
  Joi.object({
    receiveVoucher,
    amount,
    paymentDate,
    method,
  });
