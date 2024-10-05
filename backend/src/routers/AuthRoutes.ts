import { authMiddleware } from './../middleware/authMiddleware';
import AuthController from "../controllers/auth/AuthController";
import BaseRoutes from "./base/BaseRouter";

class AuthRoutes extends BaseRoutes {
    public routes(): void {
        this.router.post('/regis', AuthController.register);
        this.router.post('/login', AuthController.login);
        this.router.delete('/', authMiddleware, AuthController.logout);
    }
}

export default new AuthRoutes().router;