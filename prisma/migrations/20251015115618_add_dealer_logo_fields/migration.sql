/*
  Warnings:

  - You are about to alter the column `logoKey` on the `Dealer` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE "public"."Dealer" ALTER COLUMN "logoKey" SET DATA TYPE VARCHAR(191);
