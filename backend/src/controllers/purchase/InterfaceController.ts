import { Response, NextFunction, Request } from 'express';

export interface IController {
  getAllPurchase(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

  getPurchaseById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

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
