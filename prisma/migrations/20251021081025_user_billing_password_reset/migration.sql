-- AlterTable
ALTER TABLE "public"."User"
  ADD COLUMN "billingNextDueAt" TIMESTAMP(3),
  ADD COLUMN "billingPaidForMonth" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key"
  ON "public"."PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx"
  ON "public"."PasswordResetToken"("userId");

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken"
  ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN indeksleri (tam nitelikli)
CREATE INDEX IF NOT EXISTS order_note_trgm_idx
  ON "public"."Order" USING gin ("note" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS order_cname_trgm_idx
  ON "public"."Order" USING gin ("customerName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS order_cphone_trgm_idx
  ON "public"."Order" USING gin ("customerPhone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS item_note_trgm_idx
  ON "public"."OrderItem" USING gin ("note" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS category_name_trgm_idx
  ON "public"."Category" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS variant_name_trgm_idx
  ON "public"."Variant" USING gin ("name" gin_trgm_ops);

-- Listeleme/ödemeler için kompozit indeksler
CREATE INDEX IF NOT EXISTS order_list_idx
  ON "public"."Order" ("tenantId","branchId","status","createdAt" DESC);
CREATE INDEX IF NOT EXISTS order_tenant_created_idx
  ON "public"."Order" ("tenantId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS orderpayment_tenant_order_idx
  ON "public"."OrderPayment" ("tenantId","orderId");
xw