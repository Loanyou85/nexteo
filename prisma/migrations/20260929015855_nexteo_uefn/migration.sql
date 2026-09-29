-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('decouverte', 'createur', 'pro', 'studio');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('mock', 'mcp');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'running', 'verifying', 'done', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('queued', 'running', 'paused', 'stopping', 'stopped', 'awaiting_human', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('blocking', 'warning');

-- CreateEnum
CREATE TYPE "ErrorCategory" AS ENUM ('compile_error', 'verse_error', 'device_error', 'missing_asset', 'invalid_reference', 'runtime_error', 'gameplay_error', 'performance_issue', 'memory_issue', 'mcp_timeout', 'editor_hang');

-- CreateEnum
CREATE TYPE "FixStatus" AS ENUM ('proposed', 'applied', 'verified', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "consentAcceptedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PlanOffer" (
    "plan" "Plan" NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "features" TEXT[],
    "stripePriceEnv" TEXT,
    "realBuilds" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "PlanOffer_pkey" PRIMARY KEY ("plan")
);

-- CreateTable
CREATE TABLE "BuildBudget" (
    "plan" "Plan" NOT NULL,
    "maxAgentSteps" INTEGER NOT NULL DEFAULT 150,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "maxBuildMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxPlaytestMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxTokensPerBuild" INTEGER NOT NULL,
    "maxCostMicrosPerBuild" INTEGER NOT NULL,
    "buildsPerMonth" INTEGER NOT NULL,

    CONSTRAINT "BuildBudget_pkey" PRIMARY KEY ("plan")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'decouverte',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "sessionId" TEXT,
    "operation" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL,
    "simulated" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "builds" INTEGER NOT NULL DEFAULT 0,
    "plans" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "baseSpec" JSONB NOT NULL,
    "verseModules" TEXT[],
    "pitfalls" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceDefinition" (
    "deviceType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "capabilities" TEXT[],
    "configurableProperties" JSONB NOT NULL,
    "dependencies" TEXT[],
    "knownConstraints" TEXT[],
    "supportedGameTypes" TEXT[],
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceDefinition_pkey" PRIMARY KEY ("deviceType")
);

-- CreateTable
CREATE TABLE "DeviceMapping" (
    "need" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "defaults" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceMapping_pkey" PRIMARY KEY ("need")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "templateId" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "currentSpecVersion" INTEGER NOT NULL DEFAULT 0,
    "provider" "ProviderKind" NOT NULL DEFAULT 'mock',
    "permissionLevel" INTEGER NOT NULL DEFAULT 4,
    "autonomyConfirmedAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSpec" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "specVersion" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "author" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "specVersion" INTEGER NOT NULL,
    "sessionId" TEXT,
    "summary" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specVersion" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "request" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dependsOn" TEXT[],
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "order" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB,
    "error" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BuildTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'queued',
    "provider" "ProviderKind" NOT NULL,
    "pendingCommand" TEXT,
    "stopReason" TEXT,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentEvent" (
    "seq" BIGSERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "taskKey" TEXT,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "LocalAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machineName" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "version" TEXT,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "diagnostics" JSONB,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "module" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceInstance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "uefnId" TEXT,
    "deviceType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "positionLuf" JSONB NOT NULL,
    "properties" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneEntity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "uefnId" TEXT,
    "name" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "transformLuf" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationState" (
    "projectId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "opCounter" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationState_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "TestSpec" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specVersion" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "assertion" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,

    CONSTRAINT "TestSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "passed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "logCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "testSpecId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "observed" TEXT NOT NULL,
    "evidence" TEXT[],

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildError" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT,
    "category" "ErrorCategory" NOT NULL,
    "severity" "Severity" NOT NULL,
    "source" JSONB NOT NULL,
    "raw" TEXT NOT NULL,
    "evidence" TEXT[],
    "suggestedFix" TEXT,
    "fixStatus" "FixStatus",
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrePublishCheck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT,
    "ready" BOOLEAN NOT NULL,
    "checks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrePublishCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_sessionId_idx" ON "UsageEvent"("sessionId");

-- CreateIndex
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_period_key" ON "UsageCounter"("userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameSpec_projectId_version_key" ON "GameSpec"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVersion_sessionId_key" ON "ProjectVersion"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVersion_projectId_number_key" ON "ProjectVersion"("projectId", "number");

-- CreateIndex
CREATE INDEX "BuildTask_planId_status_idx" ON "BuildTask"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BuildTask_planId_key_key" ON "BuildTask"("planId", "key");

-- CreateIndex
CREATE INDEX "AgentSession_projectId_createdAt_idx" ON "AgentSession"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentSession_status_idx" ON "AgentSession"("status");

-- CreateIndex
CREATE INDEX "AgentEvent_sessionId_seq_idx" ON "AgentEvent"("sessionId", "seq");

-- CreateIndex
CREATE INDEX "AgentEvent_sessionId_createdAt_idx" ON "AgentEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentEvent_createdAt_idx" ON "AgentEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAgent_tokenHash_key" ON "LocalAgent"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAgent_userId_machineId_key" ON "LocalAgent"("userId", "machineId");

-- CreateIndex
CREATE UNIQUE INDEX "VerseFile_projectId_path_key" ON "VerseFile"("projectId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstance_projectId_stableId_key" ON "DeviceInstance"("projectId", "stableId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneEntity_projectId_stableId_key" ON "SceneEntity"("projectId", "stableId");

-- CreateIndex
CREATE UNIQUE INDEX "TestSpec_projectId_specVersion_key_key" ON "TestSpec"("projectId", "specVersion", "key");

-- CreateIndex
CREATE INDEX "BuildError_projectId_createdAt_idx" ON "BuildError"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "BuildError_sessionId_idx" ON "BuildError"("sessionId");

-- CreateIndex
CREATE INDEX "PrePublishCheck_projectId_createdAt_idx" ON "PrePublishCheck"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildBudget" ADD CONSTRAINT "BuildBudget_plan_fkey" FOREIGN KEY ("plan") REFERENCES "PlanOffer"("plan") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSpec" ADD CONSTRAINT "GameSpec_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildPlan" ADD CONSTRAINT "BuildPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildTask" ADD CONSTRAINT "BuildTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BuildPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BuildPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalAgent" ADD CONSTRAINT "LocalAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseFile" ADD CONSTRAINT "VerseFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstance" ADD CONSTRAINT "DeviceInstance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneEntity" ADD CONSTRAINT "SceneEntity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationState" ADD CONSTRAINT "SimulationState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSpec" ADD CONSTRAINT "TestSpec_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_testSpecId_fkey" FOREIGN KEY ("testSpecId") REFERENCES "TestSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildError" ADD CONSTRAINT "BuildError_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildError" ADD CONSTRAINT "BuildError_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrePublishCheck" ADD CONSTRAINT "PrePublishCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Garanties que Prisma ne sait pas exprimer ─────────────────────────────

-- Le palier de rareté va de 1 (brouillon) à 5 (prêt). Une valeur hors bornes
-- afficherait une carte sans couleur : on la refuse à l'écriture.
ALTER TABLE "Project" ADD CONSTRAINT "Project_tier_bornes" CHECK ("tier" BETWEEN 1 AND 5);
ALTER TABLE "Project" ADD CONSTRAINT "Project_permission_bornes" CHECK ("permissionLevel" BETWEEN 1 AND 5);
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_tier_bornes" CHECK ("tier" BETWEEN 1 AND 5);

-- Le niveau 5 (construction autonome complète) exige une confirmation datée.
ALTER TABLE "Project" ADD CONSTRAINT "Project_autonomie_confirmee"
  CHECK ("permissionLevel" < 5 OR "autonomyConfirmedAt" IS NOT NULL);

-- Une seule génération active par projet. Deux générations simultanées
-- enverraient des appels MCP en parallèle sur le même éditeur, ce qui le fige
-- (section 2.3). Le verrou applicatif le prévient ; cet index le garantit
-- même si deux requêtes passent en même temps.
CREATE UNIQUE INDEX "AgentSession_une_active_par_projet"
  ON "AgentSession" ("projectId")
  WHERE "status" IN ('queued', 'running', 'paused', 'stopping', 'awaiting_human');
