import { Response, NextFunction, Request } from 'express';

export interface IController {
  createSupplier(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  updateSupplierById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  getAllSupplier(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  getSupplierById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
  deleteSupplierById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
