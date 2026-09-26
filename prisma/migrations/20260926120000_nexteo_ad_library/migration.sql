-- Nexteo — base de publicités (Meta Ad Library). Migration initiale.
--
-- Destinée à une base VIERGE, dédiée à la V2. Elle ne supprime rien et ne
-- touche à aucune donnée existante : la base de la V1 vit sa vie de son côté.
-- Appliquer cette migration sur une base déjà peuplée échouera franchement
-- plutôt que d'écraser quoi que ce soit, et c'est voulu.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'pro', 'pro_plus', 'agency');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

-- CreateEnum
CREATE TYPE "CreativeType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "SavedItemType" AS ENUM ('advertiser', 'ad');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "passwordHash" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "consentAcceptedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "dataRetentionMonths" INTEGER NOT NULL DEFAULT 36,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
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

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionToken")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "interval" "BillingInterval" NOT NULL DEFAULT 'monthly',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "visitorId" TEXT,
    "period" TEXT NOT NULL,
    "searches" INTEGER NOT NULL DEFAULT 0,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "exports" INTEGER NOT NULL DEFAULT 0,
    "viewedProfiles" TEXT[],

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "metaPageId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "categoryId" TEXT,
    "countryCode" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "signalScore" INTEGER NOT NULL DEFAULT 0,
    "signalBreakdown" JSONB,
    "signalComputedAt" TIMESTAMP(3),
    "mrrDeclaredCents" INTEGER,
    "mrrDeclaredSource" TEXT,
    "mrrDeclaredAt" TIMESTAMP(3),
    "mrrEstimatedLowCents" INTEGER,
    "mrrEstimatedHighCents" INTEGER,
    "mrrEstimatedMethod" TEXT,
    "mrrEstimatedAt" TIMESTAMP(3),
    "mrrEstimatedTrust" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "metaAdId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "bodyText" TEXT,
    "linkTitle" TEXT,
    "linkDescription" TEXT,
    "linkCaption" TEXT,
    "landingUrl" TEXT,
    "landingDomain" TEXT,
    "snapshotUrl" TEXT NOT NULL,
    "deliveryStartTime" TIMESTAMP(3) NOT NULL,
    "deliveryStopTime" TIMESTAMP(3),
    "publisherPlatforms" TEXT[],
    "languages" TEXT[],
    "reachedCountries" TEXT[],
    "euTotalReach" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "creativeHash" TEXT NOT NULL,
    "goneFromMeta" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCreative" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "type" "CreativeType" NOT NULL,
    "storageKey" TEXT,
    "copiedAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdObservation" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "AdObservation_pkey" PRIMARY KEY ("id","observedAt")
) PARTITION BY RANGE ("observedAt");

-- CreateTable
CREATE TABLE "SignalWeight" (
    "key" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalWeight_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SimilarityEdge" (
    "advertiserId" TEXT NOT NULL,
    "relatedAdvertiserId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimilarityEdge_pkey" PRIMARY KEY ("advertiserId","relatedAdvertiserId")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" "SavedItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "collectionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestJob" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "searchTerm" TEXT,
    "cursor" TEXT,
    "status" "IngestStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "adsFetched" INTEGER NOT NULL DEFAULT 0,
    "adsNew" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitState" (
    "key" TEXT NOT NULL,
    "remaining" INTEGER,
    "resetAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_period_key" ON "UsageCounter"("userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_visitorId_period_key" ON "UsageCounter"("visitorId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_metaPageId_key" ON "Advertiser"("metaPageId");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_slug_key" ON "Advertiser"("slug");

-- CreateIndex
CREATE INDEX "Advertiser_signalScore_idx" ON "Advertiser"("signalScore" DESC);

-- CreateIndex
CREATE INDEX "Advertiser_categoryId_signalScore_idx" ON "Advertiser"("categoryId", "signalScore" DESC);

-- CreateIndex
CREATE INDEX "Advertiser_excluded_signalScore_idx" ON "Advertiser"("excluded", "signalScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Ad_metaAdId_key" ON "Ad"("metaAdId");

-- CreateIndex
CREATE INDEX "Ad_advertiserId_deliveryStartTime_idx" ON "Ad"("advertiserId", "deliveryStartTime");

-- CreateIndex
CREATE INDEX "Ad_advertiserId_isActive_idx" ON "Ad"("advertiserId", "isActive");

-- CreateIndex
CREATE INDEX "Ad_advertiserId_creativeHash_idx" ON "Ad"("advertiserId", "creativeHash");

-- CreateIndex
CREATE INDEX "Ad_landingDomain_idx" ON "Ad"("landingDomain");

-- CreateIndex
CREATE INDEX "AdCreative_checksum_idx" ON "AdCreative"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "AdCreative_adId_checksum_key" ON "AdCreative"("adId", "checksum");

-- CreateIndex
CREATE INDEX "AdObservation_adId_observedAt_idx" ON "AdObservation"("adId", "observedAt");

-- CreateIndex
CREATE INDEX "AdObservation_observedAt_idx" ON "AdObservation"("observedAt");

-- CreateIndex
CREATE INDEX "SimilarityEdge_advertiserId_score_idx" ON "SimilarityEdge"("advertiserId", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_userId_name_key" ON "Collection"("userId", "name");

-- CreateIndex
CREATE INDEX "SavedItem_userId_createdAt_idx" ON "SavedItem"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_itemType_itemId_collectionId_key" ON "SavedItem"("userId", "itemType", "itemId", "collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Watch_userId_advertiserId_key" ON "Watch"("userId", "advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedSearch_userId_name_key" ON "SavedSearch"("userId", "name");

-- CreateIndex
CREATE INDEX "IngestJob_status_createdAt_idx" ON "IngestJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IngestJob_countryCode_createdAt_idx" ON "IngestJob"("countryCode", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertiser" ADD CONSTRAINT "Advertiser_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdObservation" ADD CONSTRAINT "AdObservation_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimilarityEdge" ADD CONSTRAINT "SimilarityEdge_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimilarityEdge" ADD CONSTRAINT "SimilarityEdge_relatedAdvertiserId_fkey" FOREIGN KEY ("relatedAdvertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Partitionnement d'AdObservation
--
-- Une ligne par annonce et par exécution quotidienne, conservée pour toujours :
-- c'est l'historique qui fait la valeur du produit, on n'en supprime jamais.
-- Partitionnée par mois dès le départ, parce que partitionner après coup une
-- table déjà volumineuse se paie très cher.
-- ---------------------------------------------------------------------------

-- Crée la partition du mois contenant `jour`, si elle n'existe pas déjà.
CREATE OR REPLACE FUNCTION nexteo_partition_observation(jour date)
RETURNS text
LANGUAGE plpgsql
AS $fn$
DECLARE
  debut date := date_trunc('month', jour)::date;
  fin   date := (date_trunc('month', jour) + interval '1 month')::date;
  nom   text := format('AdObservation_%s', to_char(debut, 'YYYY_MM'));
BEGIN
  IF to_regclass(format('%I', nom)) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF "AdObservation" FOR VALUES FROM (%L) TO (%L)',
      nom, debut, fin
    );
  END IF;
  RETURN nom;
END
$fn$;

-- Trente-six mois d'avance. Le planificateur en ajoute un chaque mois ; cette
-- réserve fait que l'ingestion continue même si le planificateur tombe en
-- panne et que personne ne s'en aperçoit pendant un an.
DO $seed$
DECLARE
  m date := (date_trunc('month', CURRENT_DATE) - interval '6 months')::date;
BEGIN
  WHILE m < (date_trunc('month', CURRENT_DATE) + interval '30 months')::date LOOP
    PERFORM nexteo_partition_observation(m);
    m := (m + interval '1 month')::date;
  END LOOP;
END
$seed$;

-- Filet de sécurité. Sans partition par défaut, une insertion hors plage
-- échoue — et ici, une insertion qui échoue est de la donnée perdue à jamais.
-- Elle doit rester vide, et /admin la surveille : on ne peut pas rattacher une
-- partition dont la plage recouvre des lignes déjà tombées dedans.
CREATE TABLE "AdObservation_defaut" PARTITION OF "AdObservation" DEFAULT;

-- ---------------------------------------------------------------------------
-- Recherche plein texte
--
-- Configuration « simple » et non « french » : hors politique, l'archive
-- couvre les annonces diffusées dans toute l'Union européenne, donc un corpus
-- multilingue. Raciniser de l'anglais avec les règles françaises dégrade le
-- rappel plus qu'il ne l'améliore. Les requêtes utilisent la correspondance
-- par préfixe (`:*`), ce qui rattrape pluriels et formes fléchies.
-- ---------------------------------------------------------------------------

ALTER TABLE "Advertiser" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce("name", '') || ' ' || coalesce("websiteUrl", '')
    )
  ) STORED;

ALTER TABLE "Ad" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce("bodyText", '') || ' ' ||
      coalesce("linkTitle", '') || ' ' ||
      coalesce("linkDescription", '') || ' ' ||
      coalesce("linkCaption", '') || ' ' ||
      coalesce("landingDomain", '')
    )
  ) STORED;

CREATE INDEX "Advertiser_searchVector_idx" ON "Advertiser" USING GIN ("searchVector");
CREATE INDEX "Ad_searchVector_idx" ON "Ad" USING GIN ("searchVector");

-- Recherche par fragment sur le nom d'annonceur (« stri » trouve « Stripe »),
-- que le plein texte seul ne couvre pas.
--
-- Optionnel, et volontairement. Tous les hébergeurs gérés n'autorisent pas
-- CREATE EXTENSION au rôle applicatif, et certains installent pg_trgm dans un
-- schéma absent du search_path — l'index échoue alors sur « operator class
-- gin_trgm_ops does not exist ». Faire tomber toute la migration pour un index
-- de confort serait absurde : sans lui, la recherche par fragment repose sur
-- un ILIKE, plus lent mais correct. On note l'absence plutôt que d'échouer.
DO $trgm$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    EXECUTE 'CREATE INDEX "Advertiser_name_trgm_idx" ON "Advertiser" USING GIN ("name" gin_trgm_ops)';
    RAISE NOTICE 'Index trigramme créé : recherche par fragment accélérée.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Index trigramme ignoré (%). La recherche par fragment reste fonctionnelle.', SQLERRM;
  END;
END
$trgm$;
