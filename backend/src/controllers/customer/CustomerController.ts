import { NextFunction, Response, Request } from 'express';
import { IController } from './InterfaceController';
import { customerService } from '../../services/customerService';
import { ResponseSuccess } from '../../entities/responseSuccess';

class CustomerController implements IController {
  async getAllCustomer(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const results = await customerService.getAllCustomer();
      const response = new ResponseSuccess(200, results);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async getCustomerById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await customerService.getCustomerById(id);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async createCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await customerService.createCustomer(req);
      const response = new ResponseSuccess(201, result);
      res.status(201).json(response);
    } catch (e) {
      next(e);
    }
  }

  async updateCustomerById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await customerService.updateCustomerById(req, id);
      const response = new ResponseSuccess(200, result);
      res.status(200).json(response);
    } catch (e) {
      next(e);
    }
  }

  async deleteCustomerById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await customerService.deleteCustomerById(id);
      const response = new ResponseSuccess(204, result);
      res.status(204).json(response);
    } catch (e) {
      next(e);
    }
  }
}

export default new CustomerController();
