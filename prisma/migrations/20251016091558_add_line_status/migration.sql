-- CreateEnum
CREATE TYPE "public"."OrderLineStatus" AS ENUM ('pending', 'processing', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "lineStatus" "public"."OrderLineStatus" NOT NULL DEFAULT 'processing';
