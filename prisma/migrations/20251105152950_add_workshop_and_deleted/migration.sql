/*
  Warnings:

  - The values [workshop] on the enum `OrderLineStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."OrderLineStatus_new" AS ENUM ('pending', 'processing', 'completed', 'cancelled');
ALTER TABLE "public"."OrderItem" ALTER COLUMN "lineStatus" DROP DEFAULT;
ALTER TABLE "public"."OrderItem" ALTER COLUMN "lineStatus" TYPE "public"."OrderLineStatus_new" USING ("lineStatus"::text::"public"."OrderLineStatus_new");
ALTER TYPE "public"."OrderLineStatus" RENAME TO "OrderLineStatus_old";
ALTER TYPE "public"."OrderLineStatus_new" RENAME TO "OrderLineStatus";
DROP TYPE "public"."OrderLineStatus_old";
ALTER TABLE "public"."OrderItem" ALTER COLUMN "lineStatus" SET DEFAULT 'processing';
COMMIT;

-- AlterEnum
ALTER TYPE "public"."OrderStatus" ADD VALUE 'deleted';
