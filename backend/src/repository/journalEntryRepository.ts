import { JournalEntry, Prisma } from '@prisma/client';
import { JournalEntryForm } from '../utils/interface';
import { Decimal } from '@prisma/client/runtime/library';

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

  async deleteManyJournalEntries(
    journalEntryIds: string[],
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.journalEntry.deleteMany({
      where: {
        journalEntryId: { in: journalEntryIds },
      },
    });
  }

  async createJournalEntries(
    data: JournalEntryForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<JournalEntry> {
    const result = await prismaTransaction.journalEntry.create({
      data: {
        journalId: data.journalId,
        accountId: data.accountId,
        debit: data.debit,
        credit: data.credit,
      },
    });
    return result;
  }

  async updateJournalEntryAmounts(
    {
      journalEntryId,
      debit,
      credit,
    }: { journalEntryId: string; debit: Decimal; credit: Decimal },
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.journalEntry.update({
      where: { journalEntryId },
      data: { debit, credit },
    });
  }

  async deleteJournalEntriesByIds(
    journalEntryIds: string[],
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    if (journalEntryIds.length === 0) return; // amankan jika array kosong
    await prismaTransaction.journalEntry.deleteMany({
      where: {
        journalEntryId: { in: journalEntryIds },
      },
    });
  }

  async deleteByJournalId(
    journalId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.journalEntry.deleteMany({
      where: {
        journalId: journalId,
      },
    });
  }
}

export const journalEntryRepository = new JournalEntryRepository();
