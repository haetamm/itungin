import { Response, NextFunction, Request } from 'express';

export interface IController {
  createSetting(req: Request, res: Response, next: NextFunction): Promise<void>;
  getSetting(req: Request, res: Response, next: NextFunction): Promise<void>;
  updateSettingById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void>;
}
