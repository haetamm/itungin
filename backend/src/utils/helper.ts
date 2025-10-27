import { Decimal } from '@prisma/client/runtime/library';

export const stringToDate = (date: string | Date) => {
  return new Date(date).toISOString().slice(0, 10);
};

export function formatRupiah(amount: Decimal): string {
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
}
