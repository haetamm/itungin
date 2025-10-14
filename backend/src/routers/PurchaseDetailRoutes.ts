import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import PurchaseDetailController from '../controllers/purchase-detail/PurchaseDetailController';

class PurchaseDetailRoutes extends BaseRoutes {
  public routes(): void {
    this.router.put(
      '/purchases-detail',
      authMiddleware,
      PurchaseDetailController.updatePurchaseDetailByPurchaseId
    );
  }
}

export default new PurchaseDetailRoutes().router;
