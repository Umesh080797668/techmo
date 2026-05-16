CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Permissions table
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role-Permission join
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User-Role join
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auth audit log
CREATE TABLE auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,  -- LOGIN, LOGOUT, FAILED_LOGIN, TOKEN_REFRESH, PASSWORD_CHANGE, etc.
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX idx_auth_audit_logs_created_at ON auth_audit_logs(created_at);

-- Seed: default permissions
INSERT INTO permissions (name, description) VALUES
  ('PRODUCT_READ',        'View products and catalog'),
  ('PRODUCT_WRITE',       'Create and update products'),
  ('PRODUCT_DELETE',      'Delete products'),
  ('INVENTORY_READ',      'View inventory'),
  ('INVENTORY_WRITE',     'Adjust inventory'),
  ('ORDER_READ',          'View orders'),
  ('ORDER_WRITE',         'Create and process orders'),
  ('ORDER_VOID',          'Void orders (requires manager PIN)'),
  ('REPAIR_READ',         'View repair tickets'),
  ('REPAIR_WRITE',        'Create and update repair tickets'),
  ('CUSTOMER_READ',       'View customer profiles'),
  ('CUSTOMER_WRITE',      'Create and update customers'),
  ('LOYALTY_ADJUST',      'Manually adjust loyalty points'),
  ('HR_READ',             'View employee records'),
  ('HR_WRITE',            'Manage employees'),
  ('REPORTS_VIEW',        'View reports and exports'),
  ('SETTINGS_MANAGE',     'Manage system settings'),
  ('AUDIT_VIEW',          'View audit logs'),
  ('DISCOUNT_OVERRIDE',   'Apply manual discounts'),
  ('USER_MANAGE',         'Create and manage system users');

-- Seed: default roles
INSERT INTO roles (name, description) VALUES
  ('SUPER_ADMIN',  'Full system access'),
  ('MANAGER',      'Store manager – most permissions'),
  ('CASHIER',      'POS sales and basic lookups'),
  ('TECHNICIAN',   'Repair service access'),
  ('HR_ADMIN',     'HR and payroll management'),
  ('VIEWER',       'Read-only access');

-- Seed: SUPER_ADMIN gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'SUPER_ADMIN';

-- Seed: MANAGER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.name IN (
  'PRODUCT_READ','PRODUCT_WRITE','INVENTORY_READ','INVENTORY_WRITE',
  'ORDER_READ','ORDER_WRITE','ORDER_VOID','REPAIR_READ','REPAIR_WRITE',
  'CUSTOMER_READ','CUSTOMER_WRITE','LOYALTY_ADJUST','HR_READ',
  'REPORTS_VIEW','DISCOUNT_OVERRIDE','AUDIT_VIEW'
) WHERE r.name = 'MANAGER';

-- Seed: CASHIER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.name IN (
  'PRODUCT_READ','INVENTORY_READ','ORDER_READ','ORDER_WRITE',
  'CUSTOMER_READ','CUSTOMER_WRITE','REPAIR_READ'
) WHERE r.name = 'CASHIER';

-- Seed: TECHNICIAN permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.name IN (
  'PRODUCT_READ','INVENTORY_READ','REPAIR_READ','REPAIR_WRITE','CUSTOMER_READ'
) WHERE r.name = 'TECHNICIAN';

-- Seed: HR_ADMIN permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.name IN (
  'HR_READ','HR_WRITE','REPORTS_VIEW','AUDIT_VIEW'
) WHERE r.name = 'HR_ADMIN';

-- Seed: VIEWER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.name IN (
  'PRODUCT_READ','INVENTORY_READ','ORDER_READ','REPAIR_READ','CUSTOMER_READ','REPORTS_VIEW'
) WHERE r.name = 'VIEWER';

-- Seed: default super admin user (password: Admin@123 — CHANGE IMMEDIATELY)
-- bcrypt hash of 'Admin@123' with 12 rounds
INSERT INTO users (username, email, password_hash, full_name, is_active)
VALUES (
  'superadmin',
  'admin@techmo.lk',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbTFPMnRu',
  'System Administrator',
  TRUE
);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'superadmin' AND r.name = 'SUPER_ADMIN';
