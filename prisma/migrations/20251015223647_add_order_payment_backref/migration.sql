-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD');

-- CreateTable
CREATE TABLE "public"."OrderPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderPayment_tenantId_orderId_paidAt_idx" ON "public"."OrderPayment"("tenantId", "orderId", "paidAt");

-- CreateIndex
CREATE INDEX "OrderPayment_tenantId_paidAt_idx" ON "public"."OrderPayment"("tenantId", "paidAt");

-- AddForeignKey
ALTER TABLE "public"."OrderPayment" ADD CONSTRAINT "OrderPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderPayment" ADD CONSTRAINT "OrderPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
