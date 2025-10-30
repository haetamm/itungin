import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { ResponseSuccess } from '../../entities/responseSuccess';
import { purchaseReturnService } from '../../services/purchaseReturnService';

class PurchaseReturnController implements IController {
  async createPurchaseReturn(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await purchaseReturnService.createPurchaseReturn(req);
      const response = new ResponseSuccess(201, result);
      res.status(201).json(response);
    } catch (e) {
      next(e);
    }
  }

  async deletePurchaseReturn(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await purchaseReturnService.deletePurchaseReturn(id);
      const response = new ResponseSuccess(204, result);
      res.status(204).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new PurchaseReturnController();
