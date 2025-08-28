import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import AccountController from '../controllers/account/AccountController';

class AccountRoutes extends BaseRoutes {
  public routes(): void {
    this.router.get(
      '/accounts',
      authMiddleware,
      AccountController.getAllAccount
    );

    this.router.post(
      '/accounts',
      authMiddleware,
      AccountController.createAccount
    );

    this.router.get(
      '/accounts/:id',
      authMiddleware,
      AccountController.getAccountById
    );

    this.router.put(
      '/accounts/:id',
      authMiddleware,
      AccountController.updateAccountById
    );
  }
}

export default new AccountRoutes().router;
