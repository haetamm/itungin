import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { ResponseSuccess } from '../../entities/responseSuccess';
import { receivablePaymentService } from '../../services/receivablePaymentService';

class ReceivablePaymentController implements IController {
  async getReceivablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result =
        await receivablePaymentService.getReceivablePaymentDetail(id);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async createReceivablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result =
        await receivablePaymentService.createReceivablePayment(req);
      const response = new ResponseSuccess(201, result);
      res.status(201).json(response);
    } catch (e) {
      next(e);
    }
  }

  async updateReceivablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { body } = req;
      const result = await receivablePaymentService.updateReceivablePayment(
        id,
        body
      );
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async deleteReceivablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await receivablePaymentService.deleteReceivablePayment(id);
      const response = new ResponseSuccess(204, result);
      res.status(204).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new ReceivablePaymentController();
