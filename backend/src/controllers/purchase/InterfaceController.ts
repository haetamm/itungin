import { Response, NextFunction, Request } from 'express';

export interface IController {
  createPurchase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

  deletePurchase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
