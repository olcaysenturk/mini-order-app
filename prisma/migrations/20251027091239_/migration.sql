/*
  Warnings:

  - You are about to drop the `PasswordResetToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropIndex
DROP INDEX "public"."Category_name_idx";

-- DropIndex
DROP INDEX "public"."category_name_trgm_idx";

-- DropIndex
DROP INDEX "public"."Order_customerName_idx";

-- DropIndex
DROP INDEX "public"."Order_customerPhone_idx";

-- DropIndex
DROP INDEX "public"."Order_note_idx";

-- DropIndex
DROP INDEX "public"."Order_tenantId_branchId_status_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Order_tenantId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."order_cname_trgm_idx";

-- DropIndex
DROP INDEX "public"."order_cphone_trgm_idx";

-- DropIndex
DROP INDEX "public"."order_list_idx";

-- DropIndex
DROP INDEX "public"."order_note_trgm_idx";

-- DropIndex
DROP INDEX "public"."order_tenant_created_idx";

-- DropIndex
DROP INDEX "public"."OrderItem_note_idx";

-- DropIndex
DROP INDEX "public"."item_note_trgm_idx";

-- DropIndex
DROP INDEX "public"."OrderPayment_tenantId_orderId_idx";

-- DropIndex
DROP INDEX "public"."orderpayment_tenant_order_idx";

-- DropIndex
DROP INDEX "public"."variant_name_trgm_idx";

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "deliveryAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."PasswordResetToken";

-- CreateIndex
CREATE INDEX "Order_tenantId_deliveryAt_idx" ON "public"."Order"("tenantId", "deliveryAt");
