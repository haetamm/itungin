import { PrismaClient, User } from "@prisma/client";
import { RegisForm, UserAndRoles, UserRes } from "../utils/interface";

const prisma = new PrismaClient();

export class UserRepository {
    async findUserByUsername(username: string): Promise<UserAndRoles | null> {
        return await prisma.user.findUnique({
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
        return await prisma.user.findUnique({
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
        return prisma.user.findFirst({
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
        return prisma.user.count({
            where: { username }
        });
    }

    async createUser(data: RegisForm): Promise<UserRes> {
        return prisma.user.create({
            data: data,
            select: {
                id: true,
                name: true,
            }
        });
    }

    async updateUserToken(username: string, token: string) {
        return prisma.user.update({
            where: { username },
            data: { token },
            select: {
                token: true
            }
        });
    }

    async updateUserById(userId: string, data: Partial<{ name: string; username: string; password?: string }>): Promise<UserAndRoles | null>  {
        return prisma.user.update({
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
        return prisma.user.update({
            where: { id },
            data: { token: null },
            select: {
                username: true,
            }
        })
    }
}

export const userRepository = new UserRepository();
