import { JournalEntry, Prisma } from '@prisma/client';
import { JournalEntryForm } from '../utils/interface';

export class JournalEntryRepository {
  async createManyJournalEntries(
    data: JournalEntryForm[],
    prismaTransaction: Prisma.TransactionClient
  ): Promise<number> {
    const result = await prismaTransaction.journalEntry.createMany({
      data: data.map((item) => ({
        journalId: item.journalId,
        accountId: item.accountId,
        debit: item.debit,
        credit: item.credit,
      })),
    });
    return result.count;
  }

  async findLatestCreditEntry(
    journalId: string,
    creditAmount: Prisma.Decimal,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<JournalEntry | null> {
    return prismaTransaction.journalEntry.findFirst({
      where: { journalId, credit: creditAmount },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const journalEntryRepository = new JournalEntryRepository();
