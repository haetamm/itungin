import { Response, NextFunction, Request } from 'express';

export interface IController {
  createSale(req: Request, res: Response, next: NextFunction): Promise<void>;
}
