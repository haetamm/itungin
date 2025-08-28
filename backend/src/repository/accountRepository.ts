import { Account } from '@prisma/client';
import { prismaClient } from '../application/database';
import { AccountForm } from '../utils/interface';

export class AccountRepository {
  async findAccountById(accountId: string): Promise<Account | null> {
    return await prismaClient.account.findUnique({
      where: { accountId, deletedAt: null },
    });
  }

  async createAccount(data: AccountForm): Promise<Account> {
    return prismaClient.account.create({
      data: data,
    });
  }

  async updateAccountById(
    accountId: string,
    data: AccountForm
  ): Promise<Account> {
    return await prismaClient.account.update({
      where: { accountId },
      data: {
        ...data,
      },
    });
  }

  async getAllAccount() {
    return await prismaClient.account.findMany();
  }

  async findAccountByAccountCode(accountCode: string): Promise<Account | null> {
    return await prismaClient.account.findUnique({
      where: { accountCode },
    });
  }
}

export const accountRepository = new AccountRepository();
