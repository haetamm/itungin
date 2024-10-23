import { NextFunction, Response, Request } from "express";
import { IController } from "./InterfaceController";
import { ResponseSuccess } from "../../entities/responseSuccess";
import { supplierService } from '../../services/supplierService';

class SupplierController implements IController {
    async getAllSupplier(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await supplierService.getAllSupplier();
            const response = new ResponseSuccess(200, result);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    async getSupplierById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const result = await supplierService.getSupplierById(id);
            const response = new ResponseSuccess(200, result);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }
    
    async createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await supplierService.createSupplier(req);
            const response = new ResponseSuccess(201, result);
            res.status(201).json(response);
        } catch (e) {
            next(e);
        }
    }

    async updateSupplierById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const result = await supplierService.updateSupplierById(req, id);
            const response = new ResponseSuccess(200, result);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    async deleteSupplierById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const result = await supplierService.deleteProductById(id);
            const response = new ResponseSuccess(204, result);
            res.status(204).json(response);
        } catch (e) {
            next(e);
        }
    }
    
}

export default new SupplierController();
