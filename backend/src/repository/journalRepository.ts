import { Journal, Prisma } from '@prisma/client';
import { JournalForm } from '../utils/interface';

export class JournalRepository {
  async createJournal(
    data: JournalForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Journal> {
    return prismaTransaction.journal.create({
      data: {
        date: data.date instanceof Date ? data.date : new Date(data.date),
        description: data.description,
        reference: data.reference,
      },
    });
  }
}

export const journalRepository = new JournalRepository();
