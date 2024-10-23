import { Response, NextFunction, Request } from "express";

export interface IController {
    createProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateProductById(req: Request, res: Response, next: NextFunction): Promise<void>;
    getAllProduct(req: Request, res: Response, next: NextFunction): Promise<void>;
    getProductById(req: Request, res: Response, next: NextFunction): Promise<void>;
    deleteProductById(req: Request, res: Response, next: NextFunction): Promise<void>;
}
