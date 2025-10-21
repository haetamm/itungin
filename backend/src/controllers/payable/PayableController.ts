import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { ResponseSuccess } from '../../entities/responseSuccess';
import { payableService } from '../../services/payableService';
import { PaymentStatus } from '@prisma/client';

class PayableController implements IController {
  async getAllPayable(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        page = '1',
        limit = '10',
        search = '',
        supplierId,
        paymentStatus,
        fromDueDate,
        toDueDate,
        minAmount,
        maxAmount,
        isPaid,
      } = req.query;

      const result = await payableService.getAllPayable(
        parseInt(page as string),
        parseInt(limit as string),
        search as string,
        supplierId as string,
        paymentStatus as PaymentStatus,
        fromDueDate ? new Date(fromDueDate as string) : undefined,
        toDueDate ? new Date(toDueDate as string) : undefined,
        minAmount ? parseFloat(minAmount as string) : undefined,
        maxAmount ? parseFloat(maxAmount as string) : undefined,
        isPaid ? isPaid === 'true' : undefined
      );
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new PayableController();
