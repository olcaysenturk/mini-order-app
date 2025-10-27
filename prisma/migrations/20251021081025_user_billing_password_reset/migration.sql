-- == Columns ==
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "billingNextDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "billingPaidForMonth" TIMESTAMP(3);

-- == PasswordResetToken ==
CREATE TABLE IF NOT EXISTS "public"."PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key"
  ON "public"."PasswordResetToken"("token");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
  ON "public"."PasswordResetToken"("userId");

ALTER TABLE "public"."PasswordResetToken"
  ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- == Extension (pg_trgm) ==
-- Shadow DB’de izin yoksa burada hata alırsınız. O durumda 3. adıma bakın.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- == Trigram GIN indexes ==
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

-- == Composite/btree indexes ==
CREATE INDEX IF NOT EXISTS order_list_idx
  ON "public"."Order" ("tenantId","branchId","status","createdAt" DESC);
CREATE INDEX IF NOT EXISTS order_tenant_created_idx
  ON "public"."Order" ("tenantId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS orderpayment_tenant_order_idx
  ON "public"."OrderPayment" ("tenantId","orderId");

-- == Drift’i kapatan eski ad/kolon indeksleri ==
CREATE INDEX IF NOT EXISTS "Category_name_idx" ON "public"."Category"("name");

CREATE INDEX IF NOT EXISTS "Order_customerName_idx" ON "public"."Order"("customerName");
CREATE INDEX IF NOT EXISTS "Order_customerPhone_idx" ON "public"."Order"("customerPhone");
CREATE INDEX IF NOT EXISTS "Order_tenantId_branchId_status_createdAt_idx"
  ON "public"."Order"("tenantId","branchId","status","createdAt");
CREATE INDEX IF NOT EXISTS "Order_note_idx" ON "public"."Order"("note");
CREATE INDEX IF NOT EXISTS "Order_tenantId_createdAt_idx"
  ON "public"."Order"("tenantId","createdAt");

CREATE INDEX IF NOT EXISTS "OrderItem_note_idx" ON "public"."OrderItem"("note");

CREATE INDEX IF NOT EXISTS "OrderPayment_tenantId_orderId_idx"
  ON "public"."OrderPayment"("tenantId","orderId");

CREATE INDEX IF NOT EXISTS "Variant_name_idx" ON "public"."Variant"("name");
