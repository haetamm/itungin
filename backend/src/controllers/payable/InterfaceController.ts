import { Response, NextFunction, Request } from 'express';

export interface IController {
  getAllPayable(req: Request, res: Response, next: NextFunction): Promise<void>;
}
