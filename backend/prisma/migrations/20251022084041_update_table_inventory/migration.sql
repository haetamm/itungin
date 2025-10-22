/*
  Warnings:

  - A unique constraint covering the columns `[purchase_detail_id]` on the table `inventory_batches` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "inventory_batches_purchase_detail_id_key" ON "inventory_batches"("purchase_detail_id");
