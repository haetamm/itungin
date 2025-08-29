import { Response, NextFunction, Request } from 'express';

export interface IController {
  createCashPurchase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

  createCreditPurchase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

  createMixedPurchase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
