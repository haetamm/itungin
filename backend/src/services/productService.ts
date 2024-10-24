import { ProductForm } from "../utils/interface";
import { validate } from '../validation/validation';
import { storeProduct, updateProduct } from '../validation/productValidation';
import { Product } from '@prisma/client';
import { productRepository } from "../repository/productRepository";
import { ResponseError } from "../entities/responseError";

export class ProductService {

    async createProduct({ body }: { body: ProductForm }): Promise<Product> {
        const productReq = validate(storeProduct, body);
        const product = await productRepository.createProduct(productReq);
        return product;
    }

    async updateProductById({ body }: { body: ProductForm }, id: string): Promise<Product> {
        const productReq = validate(updateProduct, body);
        const { id: productId}  = await this.getProductById(id);
        const product = await productRepository.updateProductById(productId, productReq);
        return product;
    }

    async getProductById(id: string) {
        const product = await productRepository.findProductById(id);
        if (!product) throw new ResponseError(404, "Product not found");
        return product;
    }

    async getAllProduct() {
        const products = await productRepository.getAllProduct();
        return products;
    }

    async deleteProductById(id: string) {
        const { id: productId } = await this.getProductById(id);
        await productRepository.deleteProductById(productId);
        
    }

}

export const productService = new ProductService();
