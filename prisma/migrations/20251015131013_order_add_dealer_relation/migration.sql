-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "dealerId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "public"."Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
