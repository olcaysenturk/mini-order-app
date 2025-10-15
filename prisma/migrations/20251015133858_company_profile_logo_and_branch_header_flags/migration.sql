-- AlterTable
ALTER TABLE "public"."Branch" ADD COLUMN     "showOnHeader" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "email" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."CompanyProfile" ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "website" TEXT;
