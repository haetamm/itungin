import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { ResponseSuccess } from '../../entities/responseSuccess';
import { purchaseService } from '../../services/purchaseService';
import { PaymentType } from '@prisma/client';

class PurchaseController implements IController {
  async getAllPurchase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        page = '1',
        limit = '10',
        search = '',
        paymentType,
        from,
        to,
      } = req.query;

      const result = await purchaseService.getAllPurchase(
        parseInt(page as string),
        parseInt(limit as string),
        search as string,
        paymentType as PaymentType | undefined,
        from ? new Date(from as string) : undefined,
        to ? new Date(to as string) : undefined
      );

      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async getPurchaseById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const result = await purchaseService.getPurchaseById(id);

      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async createPurchase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await purchaseService.createPurchase(req);
      const response = new ResponseSuccess(201, result);
      res.status(201).json(response);
    } catch (e) {
      next(e);
    }
  }

  async updatePurchaseById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await purchaseService.updatePurchase(req, id);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async deletePurchase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await purchaseService.deletePurchase(id);
      const response = new ResponseSuccess(201, result);
      res.status(204).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new PurchaseController();
