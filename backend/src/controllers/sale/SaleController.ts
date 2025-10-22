import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { ResponseSuccess } from '../../entities/responseSuccess';
import { saleService } from '../../services/saleService';
import { PaymentType } from '@prisma/client';

class SaleController implements IController {
  async getAllSale(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        page = '1',
        limit = '10',
        search = '',
        paymentType,
        from,
        to,
      } = req.query;

      const result = await saleService.getAllSale(
        parseInt(page as string),
        parseInt(limit as string),
        search as string,
        paymentType as PaymentType | undefined,
        from ? new Date(from as string) : undefined,
        to ? new Date(to as string) : undefined
      );

      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async getSaleById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await saleService.getSaleById(id);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async createSale(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { body } = req;
      const result = await saleService.createSales(body);
      const response = new ResponseSuccess(201, result);
      res.status(201).json(response);
    } catch (e) {
      next(e);
    }
  }

  async deleteSaleById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await saleService.deleteSale(id);
      const response = new ResponseSuccess(204, result);
      res.status(204).json(response);
    } catch (e) {
      next(e);
    }
  }

  async updateSale(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { body } = req;
      const result = await saleService.updateSale(body, id);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new SaleController();
