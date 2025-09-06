import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import SaleController from '../controllers/sale/SaleController';

class SaleRoutes extends BaseRoutes {
  public routes(): void {
    this.router.post('/sales', authMiddleware, SaleController.createSale);
  }
}

export default new SaleRoutes().router;
