import { prismaClient } from "../application/database";
import { RegisForm, UserAndRoles, UserRes } from "../utils/interface";

export class UserRepository {
    async findUserByUsername(username: string): Promise<UserAndRoles | null> {
        return await prismaClient.user.findUnique({
            where: { username },
            include: {
                roleUser: {
                    include: {
                        role: true,
                    },
                },
            },
        });
    }

    async findUserById(id: string): Promise<UserAndRoles | null> {
        return await prismaClient.user.findUnique({
            where: { id },
            include: {
                roleUser: {
                    include: {
                        role: true,
                    },
                },
            },
        });
    }

    async findUserLogin(id: string, token: string): Promise<UserAndRoles | null> {
        return prismaClient.user.findFirst({
            where: {
                id,
                token,
                deletedAt: null
            },
            include: {
                roleUser: {
                    include: {
                        role: true
                    }
                }
            }
        });
    }

    async countByUsername(username: string) {
        return prismaClient.user.count({
            where: { username }
        });
    }

    async createUser(data: RegisForm): Promise<UserRes> {
        return prismaClient.user.create({
            data: data,
            select: {
                id: true,
                name: true,
            }
        });
    }

    async updateUserToken(username: string, token: string) {
        return prismaClient.user.update({
            where: { username },
            data: { token },
            select: {
                token: true
            }
        });
    }

    async updateImageById(id: string, imageUrl: string) {
        return prismaClient.user.update({
            where: { id },
            data: { 
                imageUrl: imageUrl
             },
            select: {
                imageUrl: true
            }
        });
    }

    async updateUserById(userId: string, data: Partial<{ name: string; username: string; password?: string }>): Promise<UserAndRoles>  {
        return prismaClient.user.update({
            where: { id: userId },
            data: {
                ...data
            },
            include: {
                roleUser: {
                    include: {
                        role: true,
                    },
                },
            },
        });
    }
    

    async deleteTokenUserById(id: string) {
        return prismaClient.user.update({
            where: { id },
            data: { token: null },
            select: {
                username: true,
            }
        })
    }
}

export const userRepository = new UserRepository();
