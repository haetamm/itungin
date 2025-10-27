-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "payment_voucher" VARCHAR(50) NOT NULL DEFAULT 'TEMP-BKK';

-- AlterTable
ALTER TABLE "receivable_payments" ADD COLUMN     "receive_voucher" VARCHAR(50) NOT NULL DEFAULT 'TEMP-BKM';
