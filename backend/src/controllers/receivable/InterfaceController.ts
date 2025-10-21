import { Response, NextFunction, Request } from 'express';

export interface IController {
  getAllReceivable(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;

  getReceivableDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
