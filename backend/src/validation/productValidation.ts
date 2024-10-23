import Joi, { ObjectSchema } from "joi";
import { ProductForm } from "../utils/interface";


export const storeProduct: ObjectSchema<ProductForm> = Joi.object({
  name: Joi.string().trim().min(1).required(),
  category: Joi.string().trim().min(1).required(),
  stock: Joi.number().min(1).required()
});

export const updateProduct: ObjectSchema<ProductForm> = Joi.object({
  name: Joi.string().trim().min(1).required(),
  category: Joi.string().trim().min(1).required(),
  stock: Joi.number().min(0).required()
});

