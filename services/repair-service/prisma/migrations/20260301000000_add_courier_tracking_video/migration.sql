-- AlterTable: add courier tracking fields + completion video URL to repair_tickets
ALTER TABLE "repair_tickets"
    ADD COLUMN IF NOT EXISTS "completionVideoUrl"       TEXT,
    ADD COLUMN IF NOT EXISTS "courierTrackingNumber"    TEXT,
    ADD COLUMN IF NOT EXISTS "courierCarrier"           TEXT,
    ADD COLUMN IF NOT EXISTS "courierStatus"            TEXT,
    ADD COLUMN IF NOT EXISTS "courierUpdatedAt"         TIMESTAMP(3);

-- AlterEnum: add RECEIVED status (was missing from initial migration)
ALTER TYPE "RepairStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';
