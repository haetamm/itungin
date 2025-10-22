import { Response, NextFunction, Request } from 'express';

export interface IController {
  createReceivablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

  getReceivablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

  updateReceivablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

  deleteReceivablePayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
