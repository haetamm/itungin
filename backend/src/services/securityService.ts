import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ResponseError } from '../entities/responseError';
import { TokenPayload } from '../utils/interface';

const { hash, compare } = bcrypt;
const { sign, verify } = jwt;

export const secretKey = process.env.JWT_SECRET_KEY || 'kjdfkjdkdjf';

class SecurityService {
  async passwordHash(password: string): Promise<string> {
    return hash(password, 10);
  }

  async passwordCompare(text: string, encript: string): Promise<boolean> {
    return compare(text, encript);
  }

  async generateToken({ userId, role }: TokenPayload): Promise<string> {
    try {
      const expiresIn = parseInt(process.env.JWT_EXPIRES_IN || '3600');
      const issuedAt = Math.floor(Date.now() / 1000);
      const expirationTime = issuedAt + expiresIn;

      const tokenPayload = {
        iss: 'itungin',
        expiresIn: expirationTime,
        iat: issuedAt,
        userId,
        role,
        services: null,
      };

      const token = sign(tokenPayload, secretKey);
      return token;
    } catch (err) {
      console.log('Generated Token failed: ', err);
      throw new ResponseError(500, 'Internal Server Error');
    }
  }

  async decodeToken(
    token: string,
    secretKey: string
  ): Promise<string | jwt.JwtPayload> {
    try {
      const credential = verify(token, secretKey);
      return credential;
    } catch (err) {
      console.error('Token verification failed:', err);
      throw new ResponseError(401, 'Unauthorized - Invalid token');
    }
  }
}

export const securityService = new SecurityService();
