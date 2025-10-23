export const stringToDate = (date: string | Date) => {
  return new Date(date).toISOString().slice(0, 10);
};
