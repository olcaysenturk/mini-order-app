-- CreateTable
CREATE TABLE "public"."OrderAudit" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderAudit_orderId_createdAt_idx" ON "public"."OrderAudit"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderAudit_tenantId_createdAt_idx" ON "public"."OrderAudit"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderAudit_userId_createdAt_idx" ON "public"."OrderAudit"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."OrderAudit" ADD CONSTRAINT "OrderAudit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderAudit" ADD CONSTRAINT "OrderAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderAudit" ADD CONSTRAINT "OrderAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
