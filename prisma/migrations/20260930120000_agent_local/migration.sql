-- AlterTable
ALTER TABLE "LocalAgent" ADD COLUMN     "catalogue" JSONB,
ADD COLUMN     "catalogueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PairingCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairingCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCommand" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "takenAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PairingCode_codeHash_key" ON "PairingCode"("codeHash");

-- CreateIndex
CREATE INDEX "PairingCode_userId_createdAt_idx" ON "PairingCode"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentCommand_agentId_status_createdAt_idx" ON "AgentCommand"("agentId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "PairingCode" ADD CONSTRAINT "PairingCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCommand" ADD CONSTRAINT "AgentCommand_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "LocalAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Garde-fou : un ordre ne peut avoir qu'un des quatre états connus.
ALTER TABLE "AgentCommand" ADD CONSTRAINT "AgentCommand_statut_valide" CHECK ("status" IN ('pending', 'taken', 'done', 'failed'));
