import { RegisForm } from './../../utils/interface';
import { NextFunction, Response } from "express";
import { IController } from "./InterfaceController";
import { ResponseSuccess } from "../../entities/responseSuccess";
import { AuthenticatedRequest } from "../../middleware/authMiddleware";
import { userService } from "../../services/userService";

class UserController implements IController {
    async getUserCurrent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await userService.getUserCurrent({ user: req.user });
            const response = new ResponseSuccess(200, result);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    async updateUserCurrent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await userService.updateUserCurrent({ user: req.user }, req.body);
            const response = new ResponseSuccess(200, result);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }
}

export default new UserController();
