import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import PayablePaymentController from '../controllers/payable-payment/PayablePaymentController';

class PayablePaymentRoutes extends BaseRoutes {
  public routes(): void {
    this.router.post(
      '/payments/payable',
      authMiddleware,
      PayablePaymentController.createPayablePayment
    );
    this.router.get(
      '/payments/payable/:id',
      authMiddleware,
      PayablePaymentController.getPayablePayment
    );
    this.router.put(
      '/payments/payable/:id',
      authMiddleware,
      PayablePaymentController.updatePayablePayment
    );
    this.router.delete(
      '/payments/payable/:id',
      authMiddleware,
      PayablePaymentController.deletePayablePayment
    );
  }
}

export default new PayablePaymentRoutes().router;
