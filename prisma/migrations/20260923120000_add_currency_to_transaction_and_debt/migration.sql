-- AlterTable
ALTER TABLE "public"."Debt" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'UNKNOWN';

