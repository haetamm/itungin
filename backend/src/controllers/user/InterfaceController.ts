import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/authMiddleware";

export interface IController {
    getUserCurrent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    updateUserCurrent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    uploadImageUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getImage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
