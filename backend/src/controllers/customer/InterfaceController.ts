import { Response, NextFunction, Request } from 'express';

export interface IController {
  createCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  updateCustomerById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  getAllCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  getCustomerById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  deleteCustomerById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
