-- CreateEnum
CREATE TYPE "public"."TransactionCategory" AS ENUM ('FOOD', 'DRINKS', 'SHOPPING', 'TRANSPORT', 'ENTERTAINMENT', 'UTILITIES', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."DebtStatus" AS ENUM ('ACTIVE', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."ProductImage" (
    "id" SERIAL NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "provider" TEXT,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionHistoryId" INTEGER,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "category" "public"."TransactionCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Debt" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "creditorId" INTEGER NOT NULL,
    "debtorId" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "public"."DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_normalizedName_key" ON "public"."ProductImage"("normalizedName");

-- CreateIndex
CREATE INDEX "ProductImage_lastFetchedAt_idx" ON "public"."ProductImage"("lastFetchedAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "public"."Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "public"."Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_category_idx" ON "public"."Transaction"("category");

-- CreateIndex
CREATE INDEX "Debt_creditorId_idx" ON "public"."Debt"("creditorId");

-- CreateIndex
CREATE INDEX "Debt_debtorId_idx" ON "public"."Debt"("debtorId");

-- CreateIndex
CREATE INDEX "Debt_status_idx" ON "public"."Debt"("status");

-- CreateIndex
CREATE INDEX "Debt_createdAt_idx" ON "public"."Debt"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_sessionHistoryId_fkey" FOREIGN KEY ("sessionHistoryId") REFERENCES "public"."SessionHistoryEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Debt" ADD CONSTRAINT "Debt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Debt" ADD CONSTRAINT "Debt_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Debt" ADD CONSTRAINT "Debt_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

