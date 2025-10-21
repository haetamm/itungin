-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL';

-- AlterTable
ALTER TABLE "payables" ADD COLUMN     "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "remaining_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "receivables" ADD COLUMN     "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "remaining_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00;
