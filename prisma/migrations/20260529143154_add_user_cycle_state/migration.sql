-- CreateTable
CREATE TABLE "UserCycleState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentDayIdx" INTEGER NOT NULL DEFAULT 0,
    "pendingBlocks" TEXT NOT NULL DEFAULT '[]',
    "lastDate" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCycleState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCycleState_userId_key" ON "UserCycleState"("userId");

-- AddForeignKey
ALTER TABLE "UserCycleState" ADD CONSTRAINT "UserCycleState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
