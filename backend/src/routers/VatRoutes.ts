import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import VatController from '../controllers/vat/VatController';

class VatRoutes extends BaseRoutes {
  public routes(): void {
    this.router.get('/vat-settings', authMiddleware, VatController.getAllVat);

    this.router.post('/vat-settings', authMiddleware, VatController.createVat);

    this.router.get(
      '/vat-settings/:id',
      authMiddleware,
      VatController.getVatById
    );

    this.router.put(
      '/vat-settings/:id',
      authMiddleware,
      VatController.updateVatById
    );

    this.router.delete(
      '/vat-settings/:id',
      authMiddleware,
      VatController.deleteVatById
    );
  }
}

export default new VatRoutes().router;
