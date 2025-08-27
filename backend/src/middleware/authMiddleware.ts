import { NextFunction, Request, Response } from 'express';
import { secretKey, securityService } from '../services/securityService';
import { userRepository } from '../repository/userRepository';
import { ResponseFail } from '../entities/responseFail';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

const handleResponseError = (message: string, res: Response) => {
  const response = new ResponseFail(401, message);
  res.status(401).json(response).end();
};

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const autHeader = req.get('Authorization');
  if (!autHeader) {
    handleResponseError('Unauthorized - No token provided', res);
  } else {
    const token = autHeader.split(' ')[1];
    if (!token) {
      handleResponseError('Unauthorized - Malformed token', res);
      return;
    }

    try {
      const decoded = await securityService.decodeToken(token, secretKey);
      if (typeof decoded === 'object' && 'userId' in decoded) {
        const user = await userRepository.findUserLogin(decoded.userId, token);
        if (!user) {
          handleResponseError('Unauthorized - Not Authentication', res);
          return;
        }
        req.user = user;
        next();
      }
    } catch {
      handleResponseError('Unauthorized - Invalid token', res);
      return;
    }
  }
};
