import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import PurchaseReturnController from '../controllers/purchase-return/PurchaseReturnController';

class PurchaseReturnRoutes extends BaseRoutes {
  public routes(): void {
    this.router.post(
      '/purchase-return',
      authMiddleware,
      PurchaseReturnController.createPurchaseReturn
    );
  }
}

export default new PurchaseReturnRoutes().router;
