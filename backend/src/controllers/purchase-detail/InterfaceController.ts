import { Response, NextFunction, Request } from 'express';

export interface IController {
  updatePurchaseDetailByPurchaseId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
