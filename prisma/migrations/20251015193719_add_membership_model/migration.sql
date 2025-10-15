/*
  Warnings:

  - You are about to drop the column `dealerId` on the `Order` table. All the data in the column will be lost.
  - Made the column `branchId` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_dealerId_fkey";

-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "dealerId",
ALTER COLUMN "branchId" SET NOT NULL;
