-- Add must_change_password flag so admin-created accounts are forced
-- to set a new password on first login.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
