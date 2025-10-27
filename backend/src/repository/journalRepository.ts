import { Journal, Prisma } from '@prisma/client';
import { JournalForm, UpdateJournalForm } from '../utils/interface';

export class JournalRepository {
  async createJournal(
    data: JournalForm,
    prismaTransaction: Prisma.TransactionClient
  ): Promise<Journal> {
    const { date, description, reference, paymentReference } = data;
    return prismaTransaction.journal.create({
      data: {
        date,
        description,
        reference,
        paymentReference,
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
    const { journalId, date, description, reference, paymentReference } = data;
    return prismaTransaction.journal.update({
      where: { journalId },
      data: {
        date,
        description,
        reference,
        paymentReference,
      },
    });
  }
}

export const journalRepository = new JournalRepository();
