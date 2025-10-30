import { Response, NextFunction, Request } from 'express';

export interface IController {
  createPurchaseReturn(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

  deletePurchaseReturn(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
