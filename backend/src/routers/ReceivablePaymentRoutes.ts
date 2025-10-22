import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import ReceivablePaymentController from '../controllers/receivable-payment/ReceivablePaymentController';

class ReceivablePaymentRoutes extends BaseRoutes {
  public routes(): void {
    this.router.post(
      '/payments/receivable',
      authMiddleware,
      ReceivablePaymentController.createReceivablePayment
    );

    this.router.get(
      '/payments/receivable/:id',
      authMiddleware,
      ReceivablePaymentController.getReceivablePayment
    );

    this.router.put(
      '/payments/receivable/:id',
      authMiddleware,
      ReceivablePaymentController.updateReceivablePayment
    );

    this.router.delete(
      '/payments/receivable/:id',
      authMiddleware,
      ReceivablePaymentController.deleteReceivablePayment
    );
  }
}

export default new ReceivablePaymentRoutes().router;
