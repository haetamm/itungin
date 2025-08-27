import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { ResponseSuccess } from '../../entities/responseSuccess';
import { vatService } from '../../services/vatService';

class VatController implements IController {
  async getAllVat(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await vatService.getAllVat();
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async getVatById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await vatService.getVatById(id);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async createVat(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await vatService.createVat(req);
      const response = new ResponseSuccess(201, result);
      res.status(201).json(response);
    } catch (e) {
      next(e);
    }
  }

  async updateVatById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await vatService.updateVatById(req, id);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async deleteVatById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await vatService.deleteVatById(id);
      const response = new ResponseSuccess(204, result);
      res.status(204).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new VatController();
