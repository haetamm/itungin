import BaseRoutes from "./base/BaseRouter";
import UserController from '../controllers/user/UserController';
import { authMiddleware } from "../middleware/authMiddleware";
import { upload } from "../middleware/upload";

class UserRoutes extends BaseRoutes {
    public routes(): void {
        this.router.get('/user', authMiddleware, UserController.getUserCurrent);
        this.router.put('/user', authMiddleware, UserController.updateUserCurrent);
        this.router.put('/user/upload', authMiddleware, upload.single("image"), UserController.uploadImageUser);
        this.router.get('/user/uploads/:imageName', UserController.getImage);
    }
}

export default new UserRoutes().router;