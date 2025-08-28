import { Response, NextFunction, Request } from 'express';

export interface IController {
  createAccount(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateAccountById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  getAllAccount(req: Request, res: Response, next: NextFunction): Promise<void>;
  getAccountById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
