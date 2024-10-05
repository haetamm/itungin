import { ResponseError } from '../entities/responseError';
import UserResponse from '../entities/user/userResponse';
import { userRepository } from '../repository/userRepository';
import { RegisForm, UserAndRoles } from "../utils/interface";
import { updateUserFormSchema } from '../validation/authValidatioin';
import { validate } from '../validation/validation';
import { securityService } from './securityService';

export class UserService {
    async getUserCurrent({ user }: { user: UserAndRoles}) {
        const result = await userRepository.findUserById(user.id);
        return result ? UserResponse.convert(result) : null;
    }

    async updateUserCurrent({ user }: { user: UserAndRoles}, body: RegisForm) {
        const updateUserReq = validate(updateUserFormSchema, body);
        const userResult = await userRepository.findUserById(user.id);
        if (!userResult) {
            throw new ResponseError(404, "User not found");
        }

        const { username } = userResult;

        if (username !== updateUserReq.username) {
            const countUser = await userRepository.countByUsername(updateUserReq.username)
            if (countUser > 0) {
                throw new ResponseError(422, "\"username\" is already exists");
            }
        }

        let hashedPassword;
        if (updateUserReq.password !== '') {
            hashedPassword = await securityService.passwordHash(updateUserReq.password);
        }

        const result = await userRepository.updateUserById(user.id, {
            name: updateUserReq.name,
            username: updateUserReq.username,
            ...(hashedPassword && { password: hashedPassword })
        });

        return result ? UserResponse.convert(result) : null;
    }
}

export const userService = new UserService();
