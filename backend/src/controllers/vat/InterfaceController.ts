import { Response, NextFunction, Request } from 'express';

export interface IController {
  createVat(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateVatById(req: Request, res: Response, next: NextFunction): Promise<void>;
  getAllVat(req: Request, res: Response, next: NextFunction): Promise<void>;
  getVatById(req: Request, res: Response, next: NextFunction): Promise<void>;
  deleteVatById(req: Request, res: Response, next: NextFunction): Promise<void>;
}
