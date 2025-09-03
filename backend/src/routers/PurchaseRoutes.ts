import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import PurchaseController from '../controllers/purchase/PurchaseController';

class PurchaseRoutes extends BaseRoutes {
  public routes(): void {
    this.router.post(
      '/purchases',
      authMiddleware,
      PurchaseController.createPurchase
    );

    this.router.delete(
      '/purchases',
      authMiddleware,
      PurchaseController.deletePurchase
    );
  }
}

export default new PurchaseRoutes().router;
