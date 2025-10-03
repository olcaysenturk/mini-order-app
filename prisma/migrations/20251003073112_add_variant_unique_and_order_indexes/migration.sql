/*
  Warnings:

  - A unique constraint covering the columns `[categoryId,name]` on the table `Variant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Order_customerName_idx" ON "public"."Order"("customerName");

-- CreateIndex
CREATE INDEX "Order_customerPhone_idx" ON "public"."Order"("customerPhone");

-- CreateIndex
CREATE INDEX "Variant_name_idx" ON "public"."Variant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_categoryId_name_key" ON "public"."Variant"("categoryId", "name");
