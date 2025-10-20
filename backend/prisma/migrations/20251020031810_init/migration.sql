-- CreateEnum
CREATE TYPE "UserRoleEnum" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CASH', 'CREDIT', 'MIXED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'UNPAID');

-- CreateEnum
CREATE TYPE "InventoryMethod" AS ENUM ('AVG', 'FIFO', 'LIFO');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "role" "UserRoleEnum" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password" VARCHAR(100) NOT NULL,
    "token" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "account_id" TEXT NOT NULL,
    "account_code" VARCHAR(20) NOT NULL,
    "account_name" VARCHAR(100) NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "normal_balance" "EntryType" NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "account_default" (
    "id" TEXT NOT NULL,
    "inventoryAccountId" TEXT NOT NULL,
    "vatInputAccountId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "payableAccountId" TEXT NOT NULL,
    "ownerCapitalAccountId" TEXT NOT NULL,
    "salesAccountId" TEXT NOT NULL,
    "vatOutputAccountId" TEXT NOT NULL,
    "receivableAccountId" TEXT NOT NULL,
    "costOfGoodsSoldAccountId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_default_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journals" (
    "journal_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" VARCHAR(255),
    "reference" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("journal_id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "journal_entry_id" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "credit" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("journal_entry_id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "supplier_id" TEXT NOT NULL,
    "supplier_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "address" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" TEXT NOT NULL,
    "product_code" VARCHAR(20) NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "unit" VARCHAR(20) NOT NULL,
    "avg_purchase_price" DECIMAL(15,2) NOT NULL,
    "profit_margin" DECIMAL(15,2) NOT NULL,
    "selling_price" DECIMAL(15,2) NOT NULL,
    "stock" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "inventory_batches" (
    "batch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "purchase_detail_id" TEXT NOT NULL,
    "purchase_date" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchase_price" DECIMAL(15,2) NOT NULL,
    "remaining_stock" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("batch_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_id" TEXT NOT NULL,
    "customer_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(15),
    "address" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "purchase_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "vat" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("purchase_id")
);

-- CreateTable
CREATE TABLE "purchase_details" (
    "purchase_detail_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_details_pkey" PRIMARY KEY ("purchase_detail_id")
);

-- CreateTable
CREATE TABLE "payables" (
    "payable_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "purchase_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("payable_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" TEXT NOT NULL,
    "payable_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "sales" (
    "sale_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "customer_id" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "vat" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("sale_id")
);

-- CreateTable
CREATE TABLE "sale_details" (
    "sale_detail_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_details_pkey" PRIMARY KEY ("sale_detail_id")
);

-- CreateTable
CREATE TABLE "receivables" (
    "receivable_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "sale_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("receivable_id")
);

-- CreateTable
CREATE TABLE "receivable_payments" (
    "payment_id" TEXT NOT NULL,
    "receivable_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivable_payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "general_settings" (
    "id" TEXT NOT NULL,
    "inventory_method" "InventoryMethod" NOT NULL DEFAULT 'AVG',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "general_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_settings" (
    "vat_id" TEXT NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vat_settings_pkey" PRIMARY KEY ("vat_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_key" ON "roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_account_code_key" ON "accounts"("account_code");

-- CreateIndex
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");

-- CreateIndex
CREATE UNIQUE INDEX "payables_journal_entry_id_key" ON "payables"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "payables_purchase_id_key" ON "payables"("purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_journal_entry_id_key" ON "payments"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_number_key" ON "sales"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "receivables_journal_entry_id_key" ON "receivables"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "receivables_sale_id_key" ON "receivables"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "receivable_payments_journal_entry_id_key" ON "receivable_payments"("journal_entry_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_default" ADD CONSTRAINT "account_default_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_default" ADD CONSTRAINT "account_default_inventoryAccountId_fkey" FOREIGN KEY ("inventoryAccountId") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_default" ADD CONSTRAINT "account_default_vatInputAccountId_fkey" FOREIGN KEY ("vatInputAccountId") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_default" ADD CONSTRAINT "account_default_payableAccountId_fkey" FOREIGN KEY ("payableAccountId") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_default" ADD CONSTRAINT "account_default_ownerCapitalAccountId_fkey" FOREIGN KEY ("ownerCapitalAccountId") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_default" ADD CONSTRAINT "account_default_salesAccountId_fkey" FOREIGN KEY ("salesAccountId") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_default" ADD CONSTRAINT "account_default_vatOutputAccountId_fkey" FOREIGN KEY ("vatOutputAccountId") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_default" ADD CONSTRAINT "account_default_receivableAccountId_fkey" FOREIGN KEY ("receivableAccountId") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_default" ADD CONSTRAINT "account_default_costOfGoodsSoldAccountId_fkey" FOREIGN KEY ("costOfGoodsSoldAccountId") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("journal_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_purchase_detail_id_fkey" FOREIGN KEY ("purchase_detail_id") REFERENCES "purchase_details"("purchase_detail_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("journal_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_details" ADD CONSTRAINT "purchase_details_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("purchase_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_details" ADD CONSTRAINT "purchase_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("journal_entry_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("purchase_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("payable_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("journal_entry_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("journal_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_details" ADD CONSTRAINT "sale_details_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("sale_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_details" ADD CONSTRAINT "sale_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_details" ADD CONSTRAINT "sale_details_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("journal_entry_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("sale_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payments" ADD CONSTRAINT "receivable_payments_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("receivable_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payments" ADD CONSTRAINT "receivable_payments_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("journal_entry_id") ON DELETE RESTRICT ON UPDATE CASCADE;
