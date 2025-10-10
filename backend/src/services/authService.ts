import { userRepository } from './../repository/userRepository';
import {
  loginFormSchema,
  registerFormSchema,
} from '../validation/authValidatioin';
import { ResponseError } from '../entities/responseError';
import { validate } from '../validation/validation';
import {
  LoginForm,
  LoginRes,
  RegisForm,
  Role,
  UserAndRoles,
  UserRes,
} from '../utils/interface';
import { prismaClient } from '../application/database';
import { userRolesRepository } from '../repository/userRolesRepository';
import { securityService } from './securityService';
import { userService } from './userService';
import { roleService } from './roleService';

export class AuthService {
  async register({ body }: { body: RegisForm }): Promise<UserRes> {
    const { username, password, name } = validate(registerFormSchema, body);
    try {
      const newUser = await prismaClient.$transaction(
        async (prismaTransaction) => {
          await userService.checkUserByUsername(username);

          const hashedPassword = await securityService.passwordHash(password);
          const newUser = await userRepository.createUser({
            username,
            name,
            password: hashedPassword,
          });

          const role = await roleService.findRoleByName(
            'ADMIN',
            prismaTransaction
          );

          await userRolesRepository.addUserRole(
            newUser.id,
            role.id,
            prismaTransaction
          );
          return newUser;
        }
      );

      return newUser;
    } catch (err) {
      if (err instanceof ResponseError) {
        throw err;
      } else {
        console.log(`Registration failed: ${err as Error}`);
        throw new ResponseError(500, 'Internal Server Error');
      }
    }
  }

  async login({ body }: { body: LoginForm }): Promise<LoginRes> {
    const loginReq = validate(loginFormSchema, body);
    const user = await userRepository.findUserByUsername(loginReq.username);
    if (!user) {
      throw new ResponseError(
        422,
        '"username" or password wrong, "password" or username wrong'
      );
    }

    const { id, name, imageUrl, username, password, userRoles, createdAt } =
      user;
    const isPasswordValid = await securityService.passwordCompare(
      loginReq.password,
      password
    );
    if (!isPasswordValid) {
      throw new ResponseError(
        422,
        '"username" or password wrong, "password" or username wrong'
      );
    }

    const role = userRoles[0]?.role.role;
    if (!role) {
      throw new ResponseError(400, 'User role not found');
    }

    const token = await securityService.generateToken({ userId: id, role });
    await userRepository.updateUserToken(username, token);

    return {
      name: name,
      username: username,
      imageUrl: imageUrl ? imageUrl : null,
      createdAt: createdAt,
      token,
      roleUser: userRoles.map((userRole: { role: Role }) => userRole.role.role),
    };
  }

  async logout({ user }: { user: UserAndRoles }) {
    const { username } = await userRepository.deleteTokenUserById(user.id);
    return `Logout berhasil ${username}`;
  }
}

export const authService = new AuthService();
