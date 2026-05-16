-- ─── Remove Loyalty Game feature ──────────────────────────────────────────────
-- Drops all game-related tables, enums, and removes game-related enum values
-- from LoyaltyTxnType.

-- 1. Drop game tables (order matters due to foreign keys)
DROP TABLE IF EXISTS "player_missions";
DROP TABLE IF EXISTS "daily_missions";
DROP TABLE IF EXISTS "game_sessions";
DROP TABLE IF EXISTS "game_states";

-- 2. Drop game enums
DROP TYPE IF EXISTS "GameMode";
DROP TYPE IF EXISTS "GameTier";

-- 3. Remove game-related values from LoyaltyTxnType
--    PostgreSQL does not support DROP VALUE on enums directly,
--    so we recreate the enum without the game values.

-- Convert any existing game-type transactions to MANUAL_ADJUSTMENT
UPDATE "loyalty_transactions"
  SET "type" = 'MANUAL_ADJUSTMENT'
  WHERE "type" IN ('GAME_EARN', 'MISSION_EARN', 'LOGIN_EARN', 'AD_EARN');

-- Recreate enum without game values
ALTER TYPE "LoyaltyTxnType" RENAME TO "LoyaltyTxnType_old";
CREATE TYPE "LoyaltyTxnType" AS ENUM (
  'PURCHASE_EARN',
  'REPAIR_EARN',
  'REDEMPTION',
  'MANUAL_ADJUSTMENT',
  'EXPIRY'
);
ALTER TABLE "loyalty_transactions"
  ALTER COLUMN "type" TYPE "LoyaltyTxnType"
  USING "type"::text::"LoyaltyTxnType";
DROP TYPE "LoyaltyTxnType_old";
