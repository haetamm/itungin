import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/authMiddleware";

export interface IController {
    register(req: Request, res: Response, next: NextFunction): Promise<void>;
    login(req: Request, res: Response, next: NextFunction): Promise<void>;
    logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
