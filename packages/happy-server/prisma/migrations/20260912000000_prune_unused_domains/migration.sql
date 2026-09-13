-- Prunes the domains the relay does not own and replaces the credential store with a
-- credential-free connector record.
--
--  * usage reporting  — metering belongs to the platform (RULE-03)
--  * social, feed, key-value, artifacts, access keys, voice — no consumer in this product
--  * GitHub identity and its avatar uploads — the code-hosting integration is gone
--  * ServiceAccountToken — replaced by ServiceConnection, which has no column for a credential
--    (DEV-08, P-09)
--
-- Session.archived is the relay's plaintext list marker for the archive state owned by the host
-- (RL-07); only a machine's session-metadata write sets it.

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_githubUserId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Account_githubUserId_key";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN IF EXISTS "githubUserId";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "feedSeq";

-- DropTable
DROP TABLE IF EXISTS "UsageReport";
DROP TABLE IF EXISTS "AccessKey";
DROP TABLE IF EXISTS "Artifact";
DROP TABLE IF EXISTS "UserRelationship";
DROP TABLE IF EXISTS "UserFeedItem";
DROP TABLE IF EXISTS "UserKVStore";
DROP TABLE IF EXISTS "VoiceConversation";
DROP TABLE IF EXISTS "UploadedFile";
DROP TABLE IF EXISTS "GithubUser";
DROP TABLE IF EXISTS "GithubOrganization";
DROP TABLE IF EXISTS "ServiceAccountToken";

-- DropEnum
DROP TYPE IF EXISTS "RelationshipStatus";

-- CreateTable
CREATE TABLE "ServiceConnection" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConnection_accountId_machineId_vendor_key" ON "ServiceConnection"("accountId", "machineId", "vendor");

-- CreateIndex
CREATE INDEX "ServiceConnection_accountId_idx" ON "ServiceConnection"("accountId");

-- CreateIndex
CREATE INDEX "ServiceConnection_accountId_machineId_idx" ON "ServiceConnection"("accountId", "machineId");

-- AddForeignKey
ALTER TABLE "ServiceConnection" ADD CONSTRAINT "ServiceConnection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceConnection" ADD CONSTRAINT "ServiceConnection_accountId_machineId_fkey" FOREIGN KEY ("accountId", "machineId") REFERENCES "Machine"("accountId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
