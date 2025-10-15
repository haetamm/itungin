import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import SaleController from '../controllers/sale/SaleController';

class SaleRoutes extends BaseRoutes {
  public routes(): void {
    this.router.post('/sales', authMiddleware, SaleController.createSale);
    this.router.get('/sales', authMiddleware, SaleController.getAllSale);
    this.router.get('/sales/:id', authMiddleware, SaleController.getSaleById);
  }
}

export default new SaleRoutes().router;
