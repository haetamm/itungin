import { Prisma } from '@prisma/client';

export class AccountDefaultRepository {
  async findOne(prismaTransaction: Prisma.TransactionClient) {
    return prismaTransaction.accountDefault.findFirst({
      include: {
        cashAccount: true,
        receivableAccount: true,
        inventoryAccount: true,
        vatInputAccount: true,
        payableAccount: true,
        ownerCapitalAccount: true,
        salesAccount: true,
        vatOutputAccount: true,
        costOfGoodsSoldAccount: true,
      },
    });
  }
}

export const accountDefaultRepository = new AccountDefaultRepository();
