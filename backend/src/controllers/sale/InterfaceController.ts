import { Response, NextFunction, Request } from 'express';

export interface IController {
  getAllSale(req: Request, res: Response, next: NextFunction): Promise<void>;
  getSaleById(req: Request, res: Response, next: NextFunction): Promise<void>;
  createSale(req: Request, res: Response, next: NextFunction): Promise<void>;
}
