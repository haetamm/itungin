import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import SaleDetailController from '../controllers/sale-detail/SaleDetailController';

class SaleDetailRoutes extends BaseRoutes {
  public routes(): void {
    this.router.put(
      '/sales-detail',
      authMiddleware,
      SaleDetailController.updateSaleDetailByPurchaseId
    );
  }
}

export default new SaleDetailRoutes().router;
