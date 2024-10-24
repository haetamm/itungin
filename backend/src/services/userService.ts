import path from 'path';
import fs from 'fs';
import { ResponseError } from '../entities/responseError';
import UserResponse from '../entities/user/userResponse';
import { userRepository } from '../repository/userRepository';
import { RegisForm, UserAndRoles } from "../utils/interface";
import { updateUserFormSchema } from '../validation/authValidatioin';
import { validate } from '../validation/validation';
import { securityService } from './securityService';
import { promisify } from 'util';

export class UserService {

    private access = promisify(fs.access);

    async getUserCurrent({ user }: { user: UserAndRoles }) {
        const userResult = await this.getUserById(user.id);
        return UserResponse.convert(userResult);
    }

    async updateUserCurrent({ user }: { user: UserAndRoles }, body: RegisForm) {
        const updateUserReq = validate(updateUserFormSchema, body);
        const userResult = await this.getUserById(user.id);

        if (updateUserReq.username !== userResult.username) {
            await this.checkUserByUsername(updateUserReq.username);
        }

        const hashedPassword = updateUserReq.password ? 
            await securityService.passwordHash(updateUserReq.password) : undefined;

        const updatedData = {
            name: updateUserReq.name,
            username: updateUserReq.username,
            ...(hashedPassword && { password: hashedPassword })
        };

        const result = await userRepository.updateUserById(user.id, updatedData);
        return UserResponse.convert(result);
}

    async uploadImageUser({ user }: { user: UserAndRoles }, file: Express.Multer.File) {
        if (!file) throw new ResponseError(422, "No file uploaded");

        const imagePath = `/uploads/${file.filename}`;
        const existingUser = await this.getUserById(user.id);

        await this.deleteOldImage(existingUser.imageUrl);
        
        const updatedUser = await userRepository.updateImageById(existingUser.id, imagePath);
        return updatedUser;
    }

    async getImage(imageName: string): Promise<string> {
        const imagePath = path.join(__dirname, "..", "..", "uploads", imageName);

        try {
            await this.access(imagePath, fs.constants.F_OK);
            return imagePath;
        } catch (error) {
            throw new ResponseError(404, "Image not found");
        }
    }

    async checkUserByUsername(username: string) {
        const countUser = await userRepository.countByUsername(username);
        if (countUser > 0) {
            throw new ResponseError(422, "\"username\" is already exists");
        }
    }

    private async getUserById(id: string) {
        const userResult = await userRepository.findUserById(id);
        if (!userResult) throw new ResponseError(404, "User not found");
        return userResult;
    }

    private async deleteOldImage(imageUrl: string | null) {
        if (imageUrl) {
            const oldImagePath = path.join(__dirname, "..", "..", imageUrl);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }
    }
}

export const userService = new UserService();
