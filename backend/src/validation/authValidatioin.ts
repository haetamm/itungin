import Joi, { ObjectSchema } from 'joi';
import { LoginForm, RegisForm } from '../utils/interface';

export const loginFormSchema: ObjectSchema<LoginForm> = Joi.object({
  username: Joi.string().trim().min(1).required(),
  password: Joi.string().trim().min(1).required(),
});

export const registerFormSchema: ObjectSchema<RegisForm> = Joi.object({
  name: Joi.string()
    .trim()
    .min(4)
    .max(23)
    .pattern(/^[a-zA-Z ]+$/)
    .required(),
  username: Joi.string().trim().alphanum().min(4).max(12).required(),
  password: Joi.string()
    .trim()
    .min(6)
    .max(8)
    .pattern(/^[a-zA-Z0-9]+$/)
    .required(),
});

export const updateUserFormSchema: ObjectSchema<RegisForm> = Joi.object({
  name: Joi.string()
    .trim()
    .min(4)
    .max(23)
    .pattern(/^[a-zA-Z ]+$/)
    .required(),
  username: Joi.string().trim().alphanum().min(4).max(12).required(),
  password: Joi.string()
    .trim()
    .min(6)
    .max(8)
    .pattern(/^[a-zA-Z0-9]+$/)
    .optional()
    .allow(null, ''),
});
