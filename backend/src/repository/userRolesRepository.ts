import { Prisma } from "@prisma/client";

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
