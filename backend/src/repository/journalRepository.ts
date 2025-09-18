import { Journal, Prisma } from '@prisma/client';
import { JournalForm, UpdateJournalForm } from '../utils/interface';

export class JournalRepository {
  async createJournal(
    data: JournalForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Journal> {
    return prismaTransaction.journal.create({
      data: {
        date: data.date,
        description: data.description,
        reference: data.reference,
      },
    });
  }

  async deleteJournal(
    journalId: string,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<void> {
    await prismaTransaction.journal.delete({
      where: { journalId },
    });
  }

  async updateJournalTransaction(
    data: UpdateJournalForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Journal> {
    return prismaTransaction.journal.update({
      where: { journalId: data.journalId },
      data: {
        date: data.date,
        description: data.description,
        reference: data.reference,
      },
    });
  }
}

export const journalRepository = new JournalRepository();
