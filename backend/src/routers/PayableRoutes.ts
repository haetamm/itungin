import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import PayableController from '../controllers/payable/PayableController';

class PayableRoutes extends BaseRoutes {
  public routes(): void {
    this.router.get(
      '/payables',
      authMiddleware,
      PayableController.getAllPayable
    );

    this.router.get(
      '/payables/:id',
      authMiddleware,
      PayableController.getPayableDetail
    );
  }
}

export default new PayableRoutes().router;
