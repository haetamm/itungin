import { Prisma } from "@prisma/client"; // Make sure to import PrismaClient

export class UserRolesRepository {
    async addUserRole(userId: string, roleId: string, prismaTransaction: Prisma.TransactionClient) {
        return prismaTransaction.userRole.create({
            data: {
                userId: userId,
                roleId: roleId,
            },
        });
    }
}

export const userRolesRepository = new UserRolesRepository();
