import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import PurchaseController from '../controllers/purchase/PurchaseController';

class PurchaseRoutes extends BaseRoutes {
  public routes(): void {
    this.router.post(
      '/purchases/cash',
      authMiddleware,
      PurchaseController.createCashPurchase
    );

    this.router.post(
      '/purchases/credit',
      authMiddleware,
      PurchaseController.createCreditPurchase
    );

    this.router.post(
      '/purchases/mixed',
      authMiddleware,
      PurchaseController.createMixedPurchase
    );

    this.router.delete(
      '/purchases',
      authMiddleware,
      PurchaseController.deletePurchase
    );
  }
}

export default new PurchaseRoutes().router;
