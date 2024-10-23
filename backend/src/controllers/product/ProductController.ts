import { NextFunction, Response, Request } from "express";
import { IController } from "./InterfaceController";
import { ResponseSuccess } from "../../entities/responseSuccess";
import { productService } from "../../services/productService";

class ProductController implements IController {
    async getAllProduct(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await productService.getAllProduct();
            const response = new ResponseSuccess(200, result);
            res.status(201).json(response);
        } catch (e) {
            next(e);
        }
    }

    async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const result = await productService.getProductById(id);
            const response = new ResponseSuccess(200, result);
            res.status(201).json(response);
        } catch (e) {
            next(e);
        }
    }
    
    async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await productService.createProduct(req);
            const response = new ResponseSuccess(201, result);
            res.status(201).json(response);
        } catch (e) {
            next(e);
        }
    }

    async updateProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const result = await productService.updateProductById(req, id);
            const response = new ResponseSuccess(200, result);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    async deleteProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const result = await productService.deleteProductById(id);
            const response = new ResponseSuccess(204, result);
            res.status(204).json(response);
        } catch (e) {
            next(e);
        }
    }
    
}

export default new ProductController();
