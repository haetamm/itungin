import { ResponseError } from "../entities/responseError";
import { Request, Response, NextFunction } from "express";

const errorMiddleware = async (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!err) {
        next();
        return;
    }

    let statusCode = 500;
    let message = "Internal Server Error";

    if (err instanceof ResponseError) {
        statusCode = err.status;
        message = err.message;
    } else if (err.isJoi) { 
        statusCode = 422;
        message = err.message;
    } else {
        message = err.message || message;
    }

    res.status(statusCode).json({
        code: statusCode,
        status: "fail",
        message: message
    }).end();
}

export { errorMiddleware };
