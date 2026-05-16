# TechMo – Pre-Launch Guide
## Everything You Must Do Before Running `docker compose up`

> **Read this top-to-bottom before touching any Docker command.**  
> Skipping steps will cause build failures, silent crashes, or missing data.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Fix the Admin App Port Mismatch (Bug)](#2-fix-the-admin-app-port-mismatch-bug)
3. [Make the Init Script Executable](#3-make-the-init-script-executable)
4. [Create the Root `.env` File](#4-create-the-root-env-file)
5. [Generate a Strong JWT Secret](#5-generate-a-strong-jwt-secret)
6. [Set Up Cloudinary (Free)](#6-set-up-cloudinary-free)
7. [Set Up SMTP (Gmail App Password)](#7-set-up-smtp-gmail-app-password)
8. [Check for Port Conflicts](#8-check-for-port-conflicts)
9. [Verify Docker Has Enough Resources](#9-verify-docker-has-enough-resources)
10. [First Run – Build & Start](#10-first-run--build--start)
11. [Apply Prisma Database Migrations](#11-apply-prisma-database-migrations)
12. [Verify All Services Are Healthy](#12-verify-all-services-are-healthy)
13. [Optional – Observability Stack](#13-optional--observability-stack)
14. [Optional – Cloudflare Tunnel (Production Only)](#14-optional--cloudflare-tunnel-production-only)
15. [Quick Reference – All URLs](#15-quick-reference--all-urls)

---

## 1. System Requirements

### Required Software

| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| Docker Engine | 24.x+ | `docker --version` |
| Docker Compose plugin | 2.20.x+ | `docker compose version` |
| Git | Any recent | `git --version` |

Install on Ubuntu/Debian if missing:
```bash
# Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # then log out and back in

# Compose plugin comes bundled with Docker Engine above
```

### Minimum Hardware

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 6 GB free | 10 GB+ |
| CPU | 4 cores | 6+ cores |
| Disk | 15 GB free | 30 GB+ |

> **Why so much RAM?** You are running 13+ containers simultaneously — Postgres, Redis, Spring Boot (auth), 6× NestJS services, 1× Python FastAPI, API Gateway, 3× frontend apps.

---

## 2. Fix the Admin App Port Mismatch (Bug)

> ⚠️ **This is a real bug** — the `admin` app Dockerfile hardcodes `PORT=4000`, but `docker-compose.yml` maps `4001:4001`. The admin dashboard will be unreachable until this is fixed.

**The problem:**
- `apps/admin/Dockerfile` → `EXPOSE 4000` and `ENV PORT=4000`
- `docker-compose.yml` → `ports: "4001:4001"` (maps host:4001 → container:4001, but container listens on 4000)

**Fix — edit `apps/admin/Dockerfile`:** change the last 3 lines from:

```dockerfile
EXPOSE 4000
ENV PORT=4000
CMD ["node", "server.js"]
```

to:

```dockerfile
EXPOSE 4001
ENV PORT=4001
CMD ["node", "server.js"]
```

Run this one-liner to apply the fix:
```bash
sed -i 's/EXPOSE 4000/EXPOSE 4001/g; s/ENV PORT=4000/ENV PORT=4001/g' apps/admin/Dockerfile
```

---

## 3. Make the Init Script Executable

The Postgres container runs `scripts/init-databases.sh` on first boot to create all 7 logical databases. If it is not executable, Postgres will silently skip it and none of the service databases will exist.

```bash
chmod +x scripts/init-databases.sh
```

Verify:
```bash
ls -la scripts/init-databases.sh
# Should show: -rwxr-xr-x
```

---

## 4. Create the Root `.env` File

The `docker-compose.yml` reads all secrets from a single `.env` file at the project root. There is already a `.env.example` — copy it and fill in your real values.

```bash
cp .env.example .env
```

Then open `.env` in your editor and fill in **every line marked below**:

```dotenv
# ── Database ─────────────────────────────────────────────────────────────────
DB_USER=techmo                          # keep as-is or change
DB_PASSWORD=techmo_secret               # ⚠️ CHANGE THIS – use a strong password

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=redis_secret             # ⚠️ CHANGE THIS

# ── JWT ───────────────────────────────────────────────────────────────────────
# See Step 5 for how to generate this
JWT_SECRET=PASTE_GENERATED_SECRET_HERE  # ⚠️ REQUIRED – must be 64+ chars
JWT_EXPIRY_MS=900000                    # 15 minutes – fine as-is
JWT_REFRESH_EXPIRY_MS=604800000         # 7 days – fine as-is

# ── SMTP (email) ──────────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com                # ← keep for Gmail
SMTP_PORT=587                           # ← keep for Gmail
SMTP_USER=your@gmail.com                # ⚠️ your Gmail address
SMTP_PASS=your_app_password             # ⚠️ Gmail App Password (see Step 7)
FROM_EMAIL=noreply@techmo.lk            # display from address
ALERT_EMAIL=admin@techmo.lk             # where low-stock alerts go

# ── Cloudinary ────────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name   # ⚠️ from Cloudinary dashboard
CLOUDINARY_API_KEY=your_api_key         # ⚠️
CLOUDINARY_API_SECRET=your_api_secret   # ⚠️
CLOUDINARY_UPLOAD_PRESET=techmo_uploads # must match preset name in Cloudinary

# ── Cloudflare (optional for local dev) ──────────────────────────────────────
CF_TUNNEL_TOKEN=                        # leave blank for local dev
CF_TURNSTILE_SITE_KEY=                  # leave blank for local dev
CF_TURNSTILE_SECRET_KEY=                # leave blank for local dev
CF_ANALYTICS_TOKEN=                     # leave blank for local dev

# ── Application ───────────────────────────────────────────────────────────────
NODE_ENV=production
PUBLIC_GATEWAY_URL=http://localhost:3000
```

> **⚠️ Critical:** The `.env` file must be at the **project root** (`/home/imantha/Desktop/pos/.env`) — the same folder as `docker-compose.yml`.

---

## 5. Generate a Strong JWT Secret

The JWT secret must be at least 64 characters. Run this command and paste the output into `JWT_SECRET` in your `.env`:

```bash
openssl rand -hex 64
```

Example output (yours will differ):
```
a3f9c2e1b4d8f7a2c5e9b1d4f6a8c2e5b9d1f4a7c3e6b2d5f8a1c4e7b3d6f9a2c5e8
```

---

## 6. Set Up Cloudinary (Free)

The **worker-service** (PDF generation, QR codes) and **admin frontend** upload images through Cloudinary. Without this, file uploads and invoice PDF generation will fail.

### Steps

1. Go to [https://cloudinary.com](https://cloudinary.com) and create a **free account** (25 GB storage, 25 GB bandwidth/month — more than enough).
2. After login, go to your **Dashboard** → copy:
   - `Cloud Name`
   - `API Key`
   - `API Secret`
3. Go to **Settings → Upload → Upload presets** → click **Add upload preset**:
   - Preset name: `techmo_uploads`
   - Signing mode: `Unsigned`
   - Click **Save**
4. Paste the values into your `.env` file.

---

## 7. Set Up SMTP (Gmail App Password)

Multiple services send emails (low-stock alerts, invoice emails, repair status updates). You need a Gmail **App Password** — your regular Gmail password will not work.

### Steps

1. Go to [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (required for App Passwords)
3. Search for **"App Passwords"** in the search bar
4. Select app: `Mail` → Select device: `Other (Custom name)` → type `TechMo`
5. Click **Generate** → copy the 16-character password (e.g., `abcd efgh ijkl mnop`)
6. Paste it (without spaces) as `SMTP_PASS` in your `.env`
7. Set `SMTP_USER` to your Gmail address

> **Alternative:** Use any SMTP provider (Mailgun, SendGrid, Resend). Just update `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` accordingly.

---

## 8. Check for Port Conflicts

The stack uses these ports on your host machine. If anything else is already using them, Docker will fail to start that container.

```bash
# Check all required ports at once
for port in 5432 6379 8080 3000 3001 3002 3003 3004 3005 3006 8000 4000 4001 4002; do
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌  Port $port is IN USE"
  else
    echo "✅  Port $port is free"
  fi
done
```

### Port Map

| Port | Service | Notes |
|------|---------|-------|
| `5432` | PostgreSQL | Must be free – conflicts with local Postgres installs |
| `6379` | Redis | Must be free |
| `8080` | Auth Service (Spring Boot) | |
| `3000` | API Gateway | |
| `3001` | Product Service | |
| `3002` | Inventory Service | |
| `3003` | Order / POS Service | |
| `3004` | Repair Service | |
| `3005` | Loyalty / CRM Service | |
| `3006` | HR Service | |
| `8000` | Worker Service (Python) | |
| `4000` | Marketing Site (Astro) | |
| `4001` | Admin / POS Dashboard (Next.js) | |
| `4002` | Customer Portal (Next.js) | |

If a port is in use, either stop the conflicting process or change the host-side port in `docker-compose.yml` (left side of `host:container`).

---

## 9. Verify Docker Has Enough Resources

On Linux (Docker Engine runs natively), available RAM equals your system RAM minus OS usage. Just make sure you have at least **6 GB free**.

```bash
free -h
# Look at the "available" column
```

---

## 10. First Run – Build & Start

This will build all 13 service images from source (takes 5–15 minutes on first run depending on your internet speed and CPU) and start the stack.

```bash
# From the project root: /home/imantha/Desktop/pos
docker compose up -d --build
```

### What `--build` does
- Builds every image from its `Dockerfile` (downloading base images the first time)
- The `auth-service` (Spring Boot) takes longest — Maven downloads dependencies
- Node.js services (NestJS, Next.js) download npm packages
- Python `worker-service` installs WeasyPrint + system deps

### Watch the build logs (optional but recommended for first run)
```bash
docker compose up --build
# omit -d so you can see all output in real time
# Press Ctrl+C once everything is up to detach
```

---

## 11. Apply Prisma Database Migrations

> ⚠️ **This step is required on first launch.** The NestJS services use Prisma ORM. The Dockerfiles only run `prisma generate` (generates the client), not `prisma migrate deploy` (applies schema to the database). Without this step, all NestJS services will crash with "table does not exist" errors.

Wait for Postgres to be healthy first:
```bash
docker compose ps postgres
# STATUS should show: healthy
```

Then push the schema for each service. Run each command one at a time and wait for it to complete:

```bash
# 1. Product Service
docker compose exec product-service npx prisma migrate deploy

# 2. Inventory Service
docker compose exec inventory-service npx prisma migrate deploy

# 3. Order Service
docker compose exec order-service npx prisma migrate deploy

# 4. Repair Service
docker compose exec repair-service npx prisma migrate deploy

# 5. Loyalty Service
docker compose exec loyalty-service npx prisma migrate deploy

# 6. HR Service
docker compose exec hr-service npx prisma migrate deploy
```

> **No migration files yet?** If the above commands say "No migration files found", use `db push` instead (for first-time schema creation without migration history):
> ```bash
> docker compose exec product-service   npx prisma db push
> docker compose exec inventory-service npx prisma db push
> docker compose exec order-service     npx prisma db push
> docker compose exec repair-service    npx prisma db push
> docker compose exec loyalty-service   npx prisma db push
> docker compose exec hr-service        npx prisma db push
> ```

> **Auth Service** (Spring Boot) uses JPA/Hibernate with `spring.jpa.hibernate.ddl-auto=update` — its tables are created automatically on startup. No manual step needed.

---

## 12. Verify All Services Are Healthy

```bash
docker compose ps
```

All services should show `running` or `healthy`. Common issues:

| Service shows `Exiting` | Likely cause |
|------------------------|--------------|
| `auth-service` | `JWT_SECRET` is too short, or Postgres not ready |
| `product-service` / any NestJS service | Prisma migration not run (Step 11) |
| `worker-service` | `CLOUDINARY_*` env vars missing |
| `gateway` | One of the upstream services hasn't started yet — wait 30s and try again |
| `admin` / `customer` | Port mismatch not fixed (Step 2) |

### Check individual service logs
```bash
docker compose logs -f auth-service
docker compose logs -f product-service
docker compose logs -f gateway
docker compose logs -f worker-service
# etc.
```

### Quick health check ping
```bash
# Gateway
curl -s http://localhost:3000/health

# Auth Service
curl -s http://localhost:8081/actuator/health

# Worker Service
curl -s http://localhost:8000/health
```

---

## 13. Optional – Observability Stack

Prometheus, Loki, Promtail, and Grafana are **not started by default** — they use a Docker Compose profile called `observability`. Start them separately when needed:

```bash
docker compose --profile observability up -d
```

Services added:

| Service | URL | Default Login |
|---------|-----|---------------|
| Prometheus | http://localhost:9090 | none |
| Grafana | http://localhost:3200 | `admin` / `admin` |
| Loki | http://localhost:3100 | none (API only) |

> **Change the Grafana password** immediately after first login. Set it in `.env`:
> ```dotenv
> GRAFANA_USER=admin
> GRAFANA_PASSWORD=your_strong_password
> ```

---

## 14. Optional – Cloudflare Tunnel (Production Only)

The `cloudflared` service uses the `production` profile — it is never started by default. Only use this when deploying to a real server with a domain.

### Setup steps (do once)

1. Go to [https://one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Networks → Tunnels → Create a tunnel**
2. Name it `techmo-tunnel`
3. Copy the **token** shown on the setup page
4. Add to your `.env`:
   ```dotenv
   CF_TUNNEL_TOKEN=your_copied_token_here
   ```
5. Update `cloudflare/tunnel.yml` with your tunnel UUID (from the dashboard)
6. Start with:
   ```bash
   docker compose --profile production up -d
   ```

---

## 15. Quick Reference – All URLs

Once the stack is running, these are all the endpoints:

| App / Service | Local URL | Notes |
|--------------|-----------|-------|
| **Admin Dashboard (POS)** | http://localhost:4001 | Staff login, billing, inventory |
| **Customer Portal** | http://localhost:4002 | Customer-facing repair tracking |
| **Marketing Site** | http://localhost:4000 | Public landing page |
| **API Gateway** | http://localhost:3000 | All `/api/v1/*` requests |
| **Auth Service** (Spring Boot) | http://localhost:8080 | JWT issue/refresh/validate |
| **Product Service** | http://localhost:3001 | Swagger: `/api` |
| **Inventory Service** | http://localhost:3002 | Swagger: `/api` |
| **Order / POS Service** | http://localhost:3003 | Swagger: `/api` |
| **Repair Service** | http://localhost:3004 | Swagger: `/api` |
| **Loyalty Service** | http://localhost:3005 | Swagger: `/api` |
| **HR Service** | http://localhost:3006 | Swagger: `/api` |
| **Worker Service** (FastAPI) | http://localhost:8000 | Docs: `/docs` |
| **Grafana** _(observability)_ | http://localhost:3200 | Dashboards |
| **Prometheus** _(observability)_ | http://localhost:9090 | Metrics |

---

## Summary Checklist

Copy and tick these off before running the compose:

- [ ] Docker Engine 24+ and Compose plugin installed
- [ ] **Step 2:** Fixed `apps/admin/Dockerfile` port from 4000 → 4001
- [ ] **Step 3:** `chmod +x scripts/init-databases.sh`
- [ ] **Step 4:** Created `.env` from `.env.example` and filled all required values
- [ ] **Step 5:** Generated strong JWT secret with `openssl rand -hex 64`
- [ ] **Step 6:** Cloudinary account created, `techmo_uploads` preset created, keys in `.env`
- [ ] **Step 7:** Gmail App Password generated and in `.env`
- [ ] **Step 8:** All required ports are free on your machine
- [ ] **Step 9:** At least 6 GB RAM available
- [ ] **Step 10:** `docker compose up -d --build` completed successfully
- [ ] **Step 11:** Prisma migrations / db push run for all 6 NestJS services
- [ ] **Step 12:** All containers show `running` or `healthy` in `docker compose ps`
