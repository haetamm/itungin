import { Response, NextFunction, Request } from 'express';

export interface IController {
  createPayablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  getPayablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  updatePayablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  deletePayablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
