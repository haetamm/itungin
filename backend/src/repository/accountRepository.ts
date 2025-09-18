import { Account, Prisma } from '@prisma/client';
import { prismaClient } from '../application/database';
import {
  AccountForm,
  AccountUpdateByPurchaseTransaction,
} from '../utils/interface';

export class AccountRepository {
  async findAccountById(accountId: string): Promise<Account | null> {
    return await prismaClient.account.findUnique({
      where: { accountId },
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
    return await prismaClient.account.findMany({
      orderBy: {
        accountCode: 'asc',
      },
    });
  }

  async findAccountByAccountCode(accountCode: string): Promise<Account | null> {
    return await prismaClient.account.findUnique({
      where: { accountCode },
    });
  }

  async updateAccountTransaction(
    data: AccountUpdateByPurchaseTransaction,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Account> {
    return prismaTransaction.account.update({
      where: { accountCode: data.accountCode },
      data: { balance: data.balance },
    });
  }
}

export const accountRepository = new AccountRepository();
