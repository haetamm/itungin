-- CreateEnum
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('PENDING', 'PROCESSED');

-- CreateTable
CREATE TABLE "purchase_returns" (
    "return_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "vat" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("return_id")
);

-- CreateTable
CREATE TABLE "purchase_return_details" (
    "return_detail_id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "purchase_detail_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "qty_returned" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "returnValue" DECIMAL(15,2) NOT NULL,
    "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.11,
    "vatAmount" DECIMAL(15,2) NOT NULL,
    "totalWithVat" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_return_details_pkey" PRIMARY KEY ("return_detail_id")
);

-- CreateTable
CREATE TABLE "sale_returns" (
    "return_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "vat" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("return_id")
);

-- CreateTable
CREATE TABLE "sale_return_details" (
    "return_detail_id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "sale_detail_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "qty_returned" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "returnValue" DECIMAL(15,2) NOT NULL,
    "vatAmount" DECIMAL(15,2) NOT NULL,
    "totalWithVat" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_return_details_pkey" PRIMARY KEY ("return_detail_id")
);

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_details" ADD CONSTRAINT "purchase_return_details_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "purchase_returns"("return_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_details" ADD CONSTRAINT "purchase_return_details_purchase_detail_id_fkey" FOREIGN KEY ("purchase_detail_id") REFERENCES "purchase_details"("purchase_detail_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_details" ADD CONSTRAINT "purchase_return_details_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_details" ADD CONSTRAINT "purchase_return_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("sale_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_details" ADD CONSTRAINT "sale_return_details_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sale_returns"("return_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_details" ADD CONSTRAINT "sale_return_details_sale_detail_id_fkey" FOREIGN KEY ("sale_detail_id") REFERENCES "sale_details"("sale_detail_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_details" ADD CONSTRAINT "sale_return_details_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_details" ADD CONSTRAINT "sale_return_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
