/*
  Warnings:

  - Added the required column `journal_id` to the `purchase_returns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `journal_id` to the `sale_returns` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "purchase_returns" ADD COLUMN     "journal_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "sale_returns" ADD COLUMN     "journal_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("journal_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("journal_id") ON DELETE CASCADE ON UPDATE CASCADE;
