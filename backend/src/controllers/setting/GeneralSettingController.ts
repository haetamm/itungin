import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { ResponseSuccess } from '../../entities/responseSuccess';
import { generalsettingService } from '../../services/generalSettingService';

class GeneralSettingController implements IController {
  async getSetting(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await generalsettingService.getSetting();
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async createSetting(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await generalsettingService.createSetting(req);
      const response = new ResponseSuccess(201, result);
      res.status(201).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new GeneralSettingController();
