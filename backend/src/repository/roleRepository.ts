import { UserRoleEnum, Prisma } from '@prisma/client';

export class RoleRepository {
  async findByRoleName(
    role: UserRoleEnum,
    prismaTransaction: Prisma.TransactionClient
  ) {
    return prismaTransaction.role.findUnique({
      where: { role },
    });
  }
}

export const roleRepository = new RoleRepository();
