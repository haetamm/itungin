import BaseRoutes from './base/BaseRouter';
import { authMiddleware } from '../middleware/authMiddleware';
import GeneralSettingController from '../controllers/setting/GeneralSettingController';

class GeneralSettingRoutes extends BaseRoutes {
  public routes(): void {
    this.router.post(
      '/settings',
      authMiddleware,
      GeneralSettingController.createSetting
    );

    this.router.get(
      '/settings',
      authMiddleware,
      GeneralSettingController.getSetting
    );

    this.router.put(
      '/settings',
      authMiddleware,
      GeneralSettingController.updateSettingById
    );
  }
}

export default new GeneralSettingRoutes().router;
