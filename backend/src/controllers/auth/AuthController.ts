import { Request, Response, NextFunction } from "express";
import { IController } from "./InterfaceController";
import { ResponseSuccess } from "../../entities/responseSuccess";
import { authService } from "../../services/authService";
import { AuthenticatedRequest } from "../../middleware/authMiddleware";
import { UserAndRoles } from "../../utils/interface";

class AuthController implements IController {
    async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await authService.register(req);
            const response = new ResponseSuccess(201, result);
            res.status(201).json(response);
        } catch (e) {
            next(e);
        }
    }

    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await authService.login(req);
            const response = new ResponseSuccess(200, result);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await authService.logout({user: req.user});
            const response = new ResponseSuccess(204, result);
            res.status(204).json(response);
        } catch (e) {
            next(e);
        }
    }
}

export default new AuthController();
