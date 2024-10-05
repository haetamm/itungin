import BaseRoutes from "./base/BaseRouter";
import UserController from '../controllers/user/UserController';
import { authMiddleware } from "../middleware/authMiddleware";

class UserRoutes extends BaseRoutes {
    public routes(): void {
        this.router.get('/user', authMiddleware, UserController.getUserCurrent);
        this.router.put('/user', authMiddleware, UserController.updateUserCurrent);
    }
}

export default new UserRoutes().router;