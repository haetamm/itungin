import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import PurchaseController from '../controllers/purchase/PurchaseController';

class PurchaseRoutes extends BaseRoutes {
  public routes(): void {
    this.router.get(
      '/purchases',
      authMiddleware,
      PurchaseController.getAllPurchase
    );

    this.router.get(
      '/purchases/:id',
      authMiddleware,
      PurchaseController.getPurchaseById
    );

    this.router.post(
      '/purchases',
      authMiddleware,
      PurchaseController.createPurchase
    );

    this.router.put(
      '/purchases/:id',
      authMiddleware,
      PurchaseController.updatePurchaseById
    );

    this.router.delete(
      '/purchases',
      authMiddleware,
      PurchaseController.deletePurchase
    );
  }
}

export default new PurchaseRoutes().router;
