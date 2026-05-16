#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TechMo — PostgreSQL multi-database initialisation
# Runs once on first container start via /docker-entrypoint-initdb.d/
#
# The default database (techmo_auth) is already created by POSTGRES_DB.
# This script creates the remaining per-service logical databases and grants
# full privileges to the shared POSTGRES_USER.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- ─── Service databases ────────────────────────────────────────────────────
  CREATE DATABASE techmo_product;
  CREATE DATABASE techmo_inventory;
  CREATE DATABASE techmo_order;
  CREATE DATABASE techmo_repair;
  CREATE DATABASE techmo_loyalty;
  CREATE DATABASE techmo_hr;

  -- ─── Privileges ───────────────────────────────────────────────────────────
  GRANT ALL PRIVILEGES ON DATABASE techmo_product   TO "${POSTGRES_USER}";
  GRANT ALL PRIVILEGES ON DATABASE techmo_inventory TO "${POSTGRES_USER}";
  GRANT ALL PRIVILEGES ON DATABASE techmo_order     TO "${POSTGRES_USER}";
  GRANT ALL PRIVILEGES ON DATABASE techmo_repair    TO "${POSTGRES_USER}";
  GRANT ALL PRIVILEGES ON DATABASE techmo_loyalty   TO "${POSTGRES_USER}";
  GRANT ALL PRIVILEGES ON DATABASE techmo_hr        TO "${POSTGRES_USER}";
EOSQL

echo "✅  All TechMo databases created successfully."
