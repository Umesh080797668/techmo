-- Add resource column to auth_audit_logs
ALTER TABLE auth_audit_logs ADD COLUMN IF NOT EXISTS resource VARCHAR(100);

-- Back-fill existing rows from action
UPDATE auth_audit_logs SET resource = CASE
    WHEN action IN ('LOGIN', 'FAILED_LOGIN', 'LOCKED_ACCOUNT_LOGIN') THEN 'Authentication'
    WHEN action = 'LOGOUT'        THEN 'Session'
    WHEN action = 'TOKEN_REFRESH' THEN 'Token'
    ELSE 'Authentication'
END
WHERE resource IS NULL;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_resource ON auth_audit_logs (resource);
