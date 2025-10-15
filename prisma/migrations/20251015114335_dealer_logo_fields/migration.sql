-- AlterTable
ALTER TABLE "public"."Dealer" ADD COLUMN     "logoHeight" INTEGER,
ADD COLUMN     "logoKey" TEXT,
ADD COLUMN     "logoUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "logoWidth" INTEGER;
