import { Prisma, UserRoleEnum } from "@prisma/client";
import { ResponseError } from "../entities/responseError";
import { roleRepository } from "../repository/roleRepository";

export class RoleService {
    async findRoleByName(name: UserRoleEnum, prismaTransaction: Prisma.TransactionClient) {
        const role = await roleRepository.findByRoleName(name, prismaTransaction);
        if (!role) {
            throw new ResponseError(404, "Role not found");
        }
        return role;
    }
}

export const roleService = new RoleService();
