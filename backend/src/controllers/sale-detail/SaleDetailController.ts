import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { ResponseSuccess } from '../../entities/responseSuccess';
import { saleDetailService } from '../../services/saleDetailService';

class SaleDetailController implements IController {
  async updateSaleDetailByPurchaseId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await saleDetailService.updateSaleDetailBySaleId(req);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new SaleDetailController();
