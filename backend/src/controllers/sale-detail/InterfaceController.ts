import { Response, NextFunction, Request } from 'express';

export interface IController {
  updateSaleDetailByPurchaseId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
