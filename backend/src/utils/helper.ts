import { JournalEntry } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const stringToDate = (date: string | Date) => {
  return new Date(date).toISOString().slice(0, 10);
};

export const formatRupiah = (amount: Decimal): string => {
  let numericValue: number;

  if (amount instanceof Decimal) {
    numericValue = amount.toNumber();
  } else {
    numericValue = Number(amount);
  }

  if (isNaN(numericValue)) return 'Rp0';

  const formatted = Math.floor(numericValue)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `Rp. ${formatted}`;
};

export const getCashPaidFromJournal = (
  journalEntries: JournalEntry[],
  cashAccountId: string
): Decimal => {
  return journalEntries
    .filter(
      (e) => e.accountId === cashAccountId && new Decimal(e.credit || 0).gt(0)
    )
    .reduce((sum, e) => sum.plus(e.credit || 0), new Decimal(0));
};
