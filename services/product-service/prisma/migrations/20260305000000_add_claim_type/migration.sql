-- AlterTable: add claimType to warranty_claims with a safe default
ALTER TABLE "warranty_claims" ADD COLUMN "claimType" TEXT NOT NULL DEFAULT 'WARRANTY_REPAIR';
