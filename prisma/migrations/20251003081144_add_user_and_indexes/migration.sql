-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "Order_createdById_idx" ON "public"."Order"("createdById");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
