import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { ResponseSuccess } from '../../entities/responseSuccess';
import { purchaseDetailService } from '../../services/purchaseDetailService';

class PurchaseDetailController implements IController {
  async updatePurchaseDetailByPurchaseId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result =
        await purchaseDetailService.updatePurchaseDetailByPurchaseId(req);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new PurchaseDetailController();
