import { Prisma } from '@prisma/client';

export class AccountDefaultRepository {
  async findOne(prismaTransaction: Prisma.TransactionClient) {
    return prismaTransaction.accountDefault.findFirst({
      include: {
        inventoryAccount: true,
        vatInputAccount: true,
        cashAccount: true,
        payableAccount: true,
        ownerCapitalAccount: true,
      },
    });
  }
}

export const accountDefaultRepository = new AccountDefaultRepository();
