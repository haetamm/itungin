import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import CustomerController from '../controllers/customer/CustomerController';

class CustomerRoutes extends BaseRoutes {
  public routes(): void {
    this.router.get(
      '/customers',
      authMiddleware,
      CustomerController.getAllCustomer
    );

    this.router.post(
      '/customers',
      authMiddleware,
      CustomerController.createCustomer
    );

    this.router.get(
      '/customers/:id',
      authMiddleware,
      CustomerController.getCustomerById
    );

    this.router.put(
      '/customers/:id',
      authMiddleware,
      CustomerController.updateCustomerById
    );

    this.router.delete(
      '/customers/:id',
      authMiddleware,
      CustomerController.deleteCustomerById
    );
  }
}

export default new CustomerRoutes().router;
