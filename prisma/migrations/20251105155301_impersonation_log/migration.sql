-- CreateTable
CREATE TABLE "public"."ImpersonationLog" (
    "id" TEXT NOT NULL,
    "impersonatorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ip" TEXT,
    "ua" TEXT,

    CONSTRAINT "ImpersonationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImpersonationLog_impersonatorId_startedAt_idx" ON "public"."ImpersonationLog"("impersonatorId", "startedAt");

-- CreateIndex
CREATE INDEX "ImpersonationLog_targetUserId_startedAt_idx" ON "public"."ImpersonationLog"("targetUserId", "startedAt");
