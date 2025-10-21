import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import ReceivableController from '../controllers/receivable/ReceivableController';

class ReceivableRoutes extends BaseRoutes {
  public routes(): void {
    this.router.get(
      '/receivables',
      authMiddleware,
      ReceivableController.getAllReceivable
    );

    this.router.get(
      '/receivables/:id',
      authMiddleware,
      ReceivableController.getReceivableDetail
    );
  }
}

export default new ReceivableRoutes().router;
