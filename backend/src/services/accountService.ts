import { Account, Prisma } from '@prisma/client';
import { AccountForm } from '../utils/interface';
import { validate } from '../validation/validation';
import { ResponseError } from '../entities/responseError';
import { storeAccount } from '../validation/accountValidation';
import { accountRepository } from '../repository/accountRepository';
import { accountDefaultRepository } from '../repository/accountDefaultRepository';

export class AccountService {
  private async ensureAccountCodeUnique(accountId: string) {
    const existing =
      await accountRepository.findAccountByAccountCode(accountId);
    if (existing) {
      throw new ResponseError(400, 'Account code already exists');
    }
  }

  async createAccount({ body }: { body: AccountForm }): Promise<Account> {
    const accountReq = validate(storeAccount, body);
    await this.ensureAccountCodeUnique(accountReq.accountCode);
    const account = await accountRepository.createAccount(accountReq);
    return account;
  }

  async updateAccountById(
    { body }: { body: AccountForm },
    id: string
  ): Promise<Account> {
    const accountReq = validate(storeAccount, body);
    const accountResult = await this.getAccountById(id);

    if (accountResult.accountCode !== accountReq.accountCode) {
      await this.ensureAccountCodeUnique(accountReq.accountCode);
    }

    const account = await accountRepository.updateAccountById(
      accountResult.accountId,
      accountReq
    );
    return account;
  }

  async getAccountById(id: string) {
    const account = await accountRepository.findAccountById(id);
    if (!account) throw new ResponseError(404, 'Account not found');
    return account;
  }

  async getAllAccount() {
    const accounts = await accountRepository.getAllAccount();
    return accounts;
  }

  async getAccountDefault(prismaTransaction: Prisma.TransactionClient) {
    const accountDefault =
      await accountDefaultRepository.findOne(prismaTransaction);
    if (!accountDefault) throw new ResponseError(404, 'Account not configured');
    return accountDefault;
  }
}

export const accountService = new AccountService();
