# TechMo – Enterprise Retail & Service Management System

An enterprise-grade, **local-first** retail and service management system for smartphones and electronic accessories. Built with modern microservices architecture, designed for production deployment with zero external dependencies.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [System Requirements](#system-requirements)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Detailed Setup Guide](#detailed-setup-guide)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [Architecture](#architecture)
- [Services Overview](#services-overview)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Development Workflow](#development-workflow)
- [Monitoring & Observability](#monitoring--observability)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## 🎯 Overview

TechMo is a comprehensive **retail point-of-sale (POS), inventory management, repair ticketing, and customer loyalty system** designed specifically for electronics retailers. The system supports:

- **Retail Sales** – Manual billing with automatic receipt generation
- **Inventory Management** – Real-time stock tracking with device compatibility mapping
- **Repair & Service** – Ticket lifecycle management with QR code status tracking
- **Warranty Management** – IMEI/Serial number validation and warranty eligibility checks
- **Employee Management** – HR and payroll module
- **Customer Loyalty** – CRM with reward points and promotional engagement
- **Automation** – N8N workflows for alerts, reports, and notifications
- **Observability** – Full monitoring stack (Prometheus, Loki, Grafana)

All services run **locally on-premises** with zero cloud dependencies—ideal for retail locations in regions with unreliable internet connectivity.

---

## ✨ Features

### Core Business Features
- ✅ **Device Compatibility Mapping** – Automatically verify spare parts compatibility across phone models
- ✅ **IMEI & Serial Number Tracking** – Mandatory entry for warranty validation and fraud prevention
- ✅ **Repair Ticket Workflow** – Full lifecycle from drop-off to completion with customer notifications
- ✅ **Warranty Management** – Automatic eligibility validation based on purchase date and repair history
- ✅ **Inventory Alerts** – Automated low-stock and dead-stock notifications via email/Telegram/WhatsApp
- ✅ **POS Integration** – Seamless order creation with automatic invoice generation and receipts
- ✅ **Employee Management** – Staff roles, permissions, and HR tracking
- ✅ **Customer Analytics** – Real-time sales reports, repair statistics, and loyalty insights
- ✅ **Multi-Tenant Ready** – Support for multiple retail branches with centralized management

### Technical Features
- ✅ **Microservices Architecture** – Independent, scalable services with clear separation of concerns
- ✅ **API Gateway** – JWT authentication, rate limiting, and request routing
- ✅ **Real-time Notifications** – Email, Telegram, WhatsApp, and SMS integration
- ✅ **Workflow Automation** – N8N integration for business process automation
- ✅ **Full Audit Trail** – Comprehensive logging and versioning for compliance
- ✅ **Offline-Ready** – Services function independently; gradual degradation on connectivity loss
- ✅ **Production Monitoring** – Prometheus metrics, Loki logs, and Grafana dashboards

---

## 🛠 Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend (Apps)** | Next.js 14, React 18, TypeScript, Tailwind CSS, Shadcn UI |
| **Backend (Services)** | NestJS, Spring Boot 3, FastAPI, Node.js |
| **API Gateway** | NestJS with rate limiting & JWT auth |
| **Database** | PostgreSQL 16 (multi-schema) |
| **Cache/Queue** | Redis 7 |
| **ORM** | Prisma (NestJS services) |
| **Automation** | N8N (workflow engine) |
| **Monitoring** | Prometheus, Grafana, Loki, Promtail |
| **Reverse Proxy** | Cloudflare Tunnel (optional) |
| **Containerization** | Docker & Docker Compose |
| **Authentication** | JWT with RSA signatures |
| **Image Upload** | Cloudinary CDN |
| **Email/SMS** | NodeMailer, Telegram, WhatsApp |
| **AI** | Llama-3.2-1B (local inference for product recommendations) |

---

## 📦 System Requirements

### Minimum Hardware
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 6 GB free | 10 GB+ |
| CPU | 4 cores | 6+ cores |
| Disk | 15 GB free | 30 GB+ |
| Network | 100 Mbps LAN | 1 Gbps LAN |

> **Why 6+ GB RAM?** You are running 13+ containers: Postgres, Redis, Auth Service, 6× NestJS services, 1× Python FastAPI worker, API Gateway, 3× frontend apps, plus optional monitoring stack.

### Required Software
| Tool | Minimum Version | Installation |
|------|----------------|--------------|
| Docker Engine | 24.x | [docker.com](https://docs.docker.com/engine/install/) |
| Docker Compose | 2.20.x | Included with Docker Desktop |
| Git | Any recent | [git-scm.com](https://git-scm.com/) |
| Node.js | 18.x (optional, for local dev) | [nodejs.org](https://nodejs.org/) |
| Java 17 (optional, for auth-service) | 17 | [openjdk.java.net](https://openjdk.java.net/) |

### Operating System
- ✅ Linux (Ubuntu 20.04+, Debian 11+)
- ✅ macOS (12.0+)
- ✅ Windows 10/11 (via WSL 2 + Docker Desktop)

---

## 📁 Project Structure

```
pos/
├── apps/                          # Frontend applications
│   ├── admin/                     # Admin/POS Dashboard (Next.js) → :4001
│   ├── customer/                  # Customer Portal (Next.js) → :4002
│   └── marketing/                 # Marketing Site (Astro) → :4000
│
├── services/                      # Backend microservices
│   ├── auth-service/              # Authentication & Authorization (Spring Boot) → :8081
│   ├── gateway/                   # API Gateway (NestJS) → :3000
│   ├── product-service/           # Product Catalog (NestJS) → :3001
│   ├── inventory-service/         # Inventory Management (NestJS) → :3002
│   ├── order-service/             # Orders & POS (NestJS) → :3003
│   ├── repair-service/            # Repair Ticketing (NestJS) → :3004
│   ├── loyalty-service/           # Loyalty & CRM (NestJS) → :3005
│   ├── hr-service/                # HR & Payroll (NestJS) → :3006
│   └── worker-service/            # Background Jobs & AI (FastAPI) → :8000
│
├── infra/                         # Infrastructure & monitoring
│   ├── prometheus/                # Prometheus configuration
│   ├── loki/                      # Log aggregation setup
│   ├── grafana/                   # Dashboard provisioning
│   └── promtail/                  # Log shipper configuration
│
├── automation/                    # Workflow automation
│   └── n8n-workflows/             # N8N workflow definitions (14+ workflows)
│
├── cloudflare/                    # Cloudflare configuration
│   ├── tunnel.yml                 # Tunnel setup (optional)
│   └── waf-rules.yml              # WAF rules
│
├── scripts/                       # Utility scripts
│   ├── init-databases.sh          # Postgres schema initialization
│   └── backup.sh                  # Database backup utility
│
├── docker-compose.yml             # Service orchestration
├── .env.example                   # Environment variables template
├── README.md                      # This file
├── ENTERPRISE_ECOMMERCE_SYSTEM.md # Detailed business requirements
└── PRE_LAUNCH_GUIDE.md            # Pre-deployment checklist
```

---

## 🚀 Quick Start

### 1. Clone & Navigate
```bash
git clone https://github.com/Umesh080797668/techmo.git
cd techmo
```

### 2. Pre-Flight Checks
```bash
# Make init script executable
chmod +x scripts/init-databases.sh

# Fix admin app port (critical bug)
sed -i 's/EXPOSE 4000/EXPOSE 4001/g; s/ENV PORT=4000/ENV PORT=4001/g' apps/admin/Dockerfile

# Check Docker
docker --version    # Should be 24.x+
docker compose version
```

### 3. Create `.env` File
```bash
cp .env.example .env
# Edit .env with your secrets (see Environment Variables section)
```

### 4. Start Services
```bash
# First run – builds all images and starts containers
docker compose up -d

# Watch logs
docker compose logs -f

# Check health
docker compose ps

# Apply Prisma migrations
docker compose exec order-service npx prisma migrate deploy
docker compose exec product-service npx prisma migrate deploy
docker compose exec inventory-service npx prisma migrate deploy
docker compose exec repair-service npx prisma migrate deploy
docker compose exec loyalty-service npx prisma migrate deploy
docker compose exec hr-service npx prisma migrate deploy
```

### 5. Access Applications
| Service | URL | Default Credentials |
|---------|-----|-------------------|
| Admin Dashboard | http://localhost:4001 | (Configure via auth-service) |
| Customer Portal | http://localhost:4002 | Customer login |
| Marketing Site | http://localhost:4000 | Public |
| API Gateway | http://localhost:3000 | N/A (JWT required) |
| Swagger Docs | http://localhost:3000/api | (If enabled) |
| N8N Workflows | http://localhost:5678 | admin / admin (default) |
| Grafana Dashboards | http://localhost:3200 | admin / admin (default) |

---

## 🔧 Detailed Setup Guide

### Step 1: Prerequisites
```bash
# Verify Docker & Compose
docker --version      # >= 24.0
docker compose version # >= 2.20

# Clone repository
git clone https://github.com/Umesh080797668/techmo.git
cd techmo
```

### Step 2: Fix Known Bugs

#### Bug #1: Admin App Port Mismatch
The admin Dockerfile hardcodes port 4000, but docker-compose expects 4001.

```bash
sed -i 's/EXPOSE 4000/EXPOSE 4001/g; s/ENV PORT=4000/ENV PORT=4001/g' apps/admin/Dockerfile
```

#### Bug #2: Init Script Not Executable
Postgres needs this script to initialize databases.

```bash
chmod +x scripts/init-databases.sh
```

### Step 3: Environment Setup

Copy the template and configure:
```bash
cp .env.example .env
```

Edit `.env` with:
- Database credentials
- JWT secrets
- Cloudinary API keys (optional, for image uploads)
- SMTP credentials (for email notifications)
- Telegram & WhatsApp tokens (for automation)

See [Environment Variables](#environment-variables) for details.

### Step 4: Start Services

#### Option A: Background Start
```bash
docker compose up -d
```

#### Option B: Watch Logs (Development)
```bash
docker compose up
```

#### Option C: Start Specific Services
```bash
docker compose up -d postgres redis auth-service gateway
```

### Step 5: Database Migrations

After first startup, apply Prisma migrations:
```bash
# NestJS services (use Prisma)
docker compose exec order-service npx prisma migrate deploy
docker compose exec product-service npx prisma migrate deploy
docker compose exec inventory-service npx prisma migrate deploy
docker compose exec repair-service npx prisma migrate deploy
docker compose exec loyalty-service npx prisma migrate deploy
docker compose exec hr-service npx prisma migrate deploy

# Spring Boot service (runs migrations automatically)
docker compose logs auth-service | grep -i "liquibase\|migration"
```

### Step 6: Verify All Services

```bash
# Check container status
docker compose ps

# Check service health
curl http://localhost:3000/health          # Gateway
curl http://localhost:8081/health          # Auth Service
curl http://localhost:3001/health          # Product Service
# ... etc

# View logs
docker compose logs auth-service
docker compose logs gateway
```

---

## 🔐 Environment Variables

### Root `.env` File Location
```
pos/.env
```

### Required Variables

#### Database
```env
DB_USER=techmo
DB_PASSWORD=techmo_secret_change_me_in_production!
DB_HOST=postgres
DB_PORT=5432
```

#### JWT & Security
```env
JWT_SECRET=your_very_long_rsa_secret_key_change_in_production
JWT_EXPIRY_MS=900000          # 15 minutes
JWT_REFRESH_EXPIRY_MS=604800000  # 7 days
CUSTOMER_JWT_SECRET=${JWT_SECRET}  # Can differ for customer tokens
INTERNAL_SERVICE_KEY=techmo-internal-svc-2026
```

#### Redis
```env
REDIS_PASSWORD=redis_secret_change_me_in_production
REDIS_HOST=redis
REDIS_PORT=6379
```

#### Node.js Services
```env
NODE_ENV=production          # or 'development'
PUBLIC_GATEWAY_URL=http://localhost:3000
CUSTOMER_APP_URL=http://localhost:4002
```

#### Email/SMTP (for notifications)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password  # NOT your Gmail password!
FROM_EMAIL=noreply@techmo.lk
ALERT_EMAIL=admin@techmo.lk
```

#### Image Upload (Cloudinary – optional but recommended)
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_PRESET=techmo_uploads
```

#### Automation (N8N)
```env
N8N_SECRET=techmo_n8n_secret_2024
N8N_INTERNAL_API_TOKEN=your_n8n_internal_token
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=techmo_electronics_bot
TELEGRAM_CHAT_ID=1813081669
MANAGER_TELEGRAM_CHAT_ID=1813081669
STORE_WHATSAPP=94704124816
```

#### Cloudflare (Optional, for production)
```env
CF_TUNNEL_TOKEN=your_cloudflare_tunnel_token
CF_TURNSTILE_SECRET_KEY=your_turnstile_secret
```

#### Monitoring (Grafana)
```env
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin_change_me
GRAFANA_ROOT_URL=http://localhost:3200
```

#### AI Model (Worker Service)
```env
PHI3_MODEL_PATH=/app/models/llama-3.2-1b.gguf
PHI3_N_CTX=2048
PHI3_N_THREADS=4
PHI3_N_GPU_LAYERS=0  # Set to > 0 if using NVIDIA GPU
```

### Generate Secure Secrets

```bash
# Generate strong JWT secret
openssl rand -base64 32

# Generate Redis password
openssl rand -base64 24

# Generate N8N secret
openssl rand -base64 32
```

---

## ▶️ Running the Project

### Start All Services
```bash
docker compose up -d
```

### Start Specific Services
```bash
# Just core services
docker compose up -d postgres redis auth-service gateway

# With observability stack
docker compose --profile observability up -d

# With Cloudflare tunnel (production)
docker compose --profile production up -d
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f order-service

# Last 100 lines
docker compose logs --tail=100 gateway

# Filter by time
docker compose logs --since 5m
```

### Check Health
```bash
# All containers
docker compose ps

# Detailed health info
docker compose exec gateway curl http://localhost:3000/health
docker compose exec auth-service curl http://localhost:8081/health
```

### Stop Services
```bash
# Stop all
docker compose down

# Stop and remove volumes (DESTRUCTIVE)
docker compose down -v

# Stop and rebuild
docker compose down && docker compose up -d --build
```

### Restart Service
```bash
docker compose restart order-service
```

### Rebuild Images
```bash
# Single service
docker compose up -d --build gateway

# All services
docker compose build --no-cache && docker compose up -d
```

---

## 🏗 Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Admin (Next) │  │Customer(Next)│  │ Marketing    │      │
│  │   :4001      │  │    :4002     │  │ (Astro):4000 │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          │    All HTTP/REST Traffic Flows Through API Gateway  │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼──────────────┐
│        API Gateway (NestJS) :3000                            │
│  • JWT Authentication & Authorization                        │
│  • Rate Limiting & Throttling                                │
│  • Request/Response Logging                                  │
│  • Cache Layer (Redis)                                       │
└─────────┬──────────────────┬──────────────────┬──────────────┘
          │                  │                  │
┌─────────▼──────────┐  ┌────▼─────────┐  ┌───▼──────────────┐
│  Auth Service      │  │  Microservices  │ │ Background Jobs│
│  (Spring Boot)     │  │  (NestJS)       │ │ (FastAPI)      │
│  JWT Token Issue   │  │ • Product       │ │ • Email        │
│  User Management   │  │ • Inventory     │ │ • PDF Reports  │
│  :8081             │  │ • Order/POS     │ │ • Telegram     │
│                    │  │ • Repair        │ │ • Image Upload │
│  PostgreSQL        │  │ • Loyalty/CRM   │ │ • AI Inference │
│  Schema: techmo_   │  │ • HR            │ │ :8000          │
│  auth              │  │ :3001-3006      │ │                │
│                    │  └─────┬──────────┘  └───┬──────────────┘
└────────────────────┘        │                 │
                    ┌─────────▼─────────┐
                    │   PostgreSQL 16   │
                    │   (Multi-Schema)  │
                    │  • techmo_auth    │
                    │  • techmo_product │
                    │  • techmo_order   │
                    │  • techmo_repair  │
                    │  • techmo_loyalty │
                    │  • techmo_hr      │
                    │  • techmo_inventory│
                    └───────────────────┘
                    ┌─────────────────────┐
                    │   Redis 7 Cache     │
                    │  • Session Store    │
                    │  • Job Queue (RQ)   │
                    │  • Rate Limit Store │
                    └─────────────────────┘
```

### Service Communication

```
Client
  ↓
API Gateway (Port 3000)
  ├─→ /auth/*              → Auth Service (Port 8081)
  ├─→ /products/*          → Product Service (Port 3001)
  ├─→ /inventory/*         → Inventory Service (Port 3002)
  ├─→ /orders/*            → Order Service (Port 3003)
  ├─→ /repairs/*           → Repair Service (Port 3004)
  ├─→ /loyalty/*           → Loyalty Service (Port 3005)
  ├─→ /hr/*                → HR Service (Port 3006)
  └─→ /workers/*           → Worker Service (Port 8000)
```

### Database Schema Isolation

Each service has its own PostgreSQL schema:
```sql
techmo_auth       -- Users, roles, permissions
techmo_product    -- Product catalog, SKUs
techmo_inventory  -- Stock levels, warehouse data
techmo_order      -- Orders, invoices, receipts
techmo_repair     -- Repair tickets, workflow
techmo_loyalty    -- Customers, rewards, transactions
techmo_hr         -- Employees, payroll, attendance
```

---

## 📋 Services Overview

### 1. Auth Service (Spring Boot)
**Port:** 8081  
**Database:** `techmo_auth`  
**Purpose:** Central authentication, JWT token issuance, role-based access control

**Key Endpoints:**
- `POST /auth/login` – User login
- `POST /auth/refresh` – Refresh JWT token
- `GET /auth/verify` – Verify token validity
- `POST /users` – Create user
- `GET /users/{id}` – Get user info

### 2. API Gateway (NestJS)
**Port:** 3000  
**Purpose:** Single entry point for all frontend requests, JWT validation, rate limiting, request routing

**Responsibilities:**
- JWT token validation
- Rate limiting & DDoS protection
- Request/response logging
- Cache management
- Service routing

### 3. Product Service (NestJS)
**Port:** 3001  
**Database:** `techmo_product`  
**Purpose:** Product catalog, SKU management, device compatibility mapping

**Key Endpoints:**
- `GET /products` – List all products
- `POST /products` – Create product
- `GET /compatibility/{productId}` – Get compatible devices
- `POST /compatibility` – Map compatibility

### 4. Inventory Service (NestJS)
**Port:** 3002  
**Database:** `techmo_inventory`  
**Purpose:** Real-time stock tracking, low-stock alerts, warehouse management

**Key Endpoints:**
- `GET /inventory` – List inventory
- `PATCH /inventory/{id}` – Update stock
- `GET /alerts` – Get low-stock alerts
- `POST /adjustments` – Manual stock adjustment

### 5. Order Service (NestJS)
**Port:** 3003  
**Database:** `techmo_order`  
**Purpose:** POS orders, invoicing, receipt generation, transaction history

**Key Endpoints:**
- `POST /orders` – Create order
- `GET /orders` – List orders
- `GET /orders/{id}/invoice` – Generate invoice
- `POST /orders/{id}/receipt` – Generate receipt

### 6. Repair Service (NestJS)
**Port:** 3004  
**Database:** `techmo_repair`  
**Purpose:** Repair ticket management, status tracking, warranty validation

**Key Endpoints:**
- `POST /repairs` – Create repair ticket
- `GET /repairs` – List tickets
- `PATCH /repairs/{id}/status` – Update status
- `GET /repairs/{id}/qr` – Generate QR code

### 7. Loyalty Service (NestJS)
**Port:** 3005  
**Database:** `techmo_loyalty`  
**Purpose:** Customer management, reward points, promotional campaigns

**Key Endpoints:**
- `POST /customers` – Register customer
- `GET /customers/{id}` – Customer profile
- `POST /rewards` – Award points
- `GET /rewards/{id}/balance` – Check points balance

### 8. HR Service (NestJS)
**Port:** 3006  
**Database:** `techmo_hr`  
**Purpose:** Employee management, payroll, attendance tracking

**Key Endpoints:**
- `POST /employees` – Add employee
- `GET /employees` – List staff
- `POST /payroll` – Generate payroll
- `GET /attendance` – View attendance

### 9. Worker Service (FastAPI)
**Port:** 8000  
**Purpose:** Background jobs, email sending, PDF generation, image processing, AI inference

**Key Endpoints:**
- `POST /jobs/send-email` – Queue email job
- `POST /jobs/generate-pdf` – Queue PDF generation
- `POST /jobs/process-image` – Image upload & processing
- `POST /jobs/ai-recommend` – Get AI product recommendations
- `GET /jobs/{id}` – Check job status

---

## 📡 API Endpoints

### Authentication Flow
```
POST /auth/login
  ↓
Returns: { accessToken, refreshToken, user }
  ↓
Send accessToken in all requests: Authorization: Bearer {token}
  ↓
Token expires after 15 minutes
  ↓
Use refreshToken to get new accessToken: POST /auth/refresh
```

### Common Request Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
X-Request-ID: unique-request-id (optional)
X-Customer-Id: customer-id (for customer requests)
```

### Common Response Format
```json
{
  "success": true,
  "statusCode": 200,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

### Error Response Format
```json
{
  "success": false,
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Invalid request parameters",
  "details": { /* validation errors */ }
}
```

---

## 🗄 Database Schema

### Postgres Multi-Schema Architecture

**Single Instance:** `postgres:5432`  
**Multiple Logical Databases:** One per service

```
postgres (instance)
├── techmo_auth          (Auth Service)
├── techmo_product       (Product Service)
├── techmo_inventory     (Inventory Service)
├── techmo_order         (Order Service)
├── techmo_repair        (Repair Service)
├── techmo_loyalty       (Loyalty Service)
└── techmo_hr            (HR Service)
```

### Initialize Databases
Automatic on first startup via `scripts/init-databases.sh`:
```bash
chmod +x scripts/init-databases.sh
docker compose up postgres  # Runs init script automatically
```

### Manual Database Operations

```bash
# Access Postgres shell
docker compose exec postgres psql -U techmo -d techmo_auth

# List all databases
\l

# Connect to database
\c techmo_product

# List tables
\dt

# Run SQL query
SELECT * FROM products LIMIT 5;

# Backup database
docker compose exec postgres pg_dump -U techmo techmo_order > backup.sql

# Restore database
docker compose exec -T postgres psql -U techmo techmo_order < backup.sql
```

---

## 👨‍💻 Development Workflow

### Local Development (Without Docker)

#### Prerequisites
- Node.js 18+
- Java 17
- PostgreSQL 16
- Redis 7

#### Setup Individual Services

```bash
# Product Service
cd services/product-service
npm install
npm run start:dev

# Gateway
cd services/gateway
npm install
npm run start:dev

# Admin App
cd apps/admin
npm install
npm run dev
```

### Development with Docker

#### Hot Reload Setup
```bash
# Mount source directories as volumes for live reload
docker compose -f docker-compose.dev.yml up -d

# Watch for changes
docker compose logs -f order-service
```

### Adding New Features

1. **Create migration (if DB change):**
   ```bash
   docker compose exec order-service npx prisma migrate dev --name add_new_feature
   ```

2. **Implement feature**

3. **Run tests:**
   ```bash
   docker compose exec gateway npm run test
   ```

4. **Build & push:**
   ```bash
   docker compose build gateway
   docker compose push gateway
   ```

### Running Tests
```bash
# Unit tests
docker compose exec gateway npm run test

# Integration tests
docker compose exec gateway npm run test:e2e

# Coverage report
docker compose exec gateway npm run test:cov
```

---

## 📊 Monitoring & Observability

### Optional: Start Monitoring Stack
```bash
docker compose --profile observability up -d
```

### Monitoring Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| **Prometheus** | http://localhost:9090 | Metrics storage & querying |
| **Grafana** | http://localhost:3200 | Dashboards (admin/admin) |
| **Loki** | http://localhost:3100 | Log aggregation API |
| **N8N** | http://localhost:5678 | Workflow automation |

### Available Dashboards (Grafana)
- System Metrics (CPU, Memory, Disk)
- Service Health (Response time, Error rate)
- Database Performance
- Business Metrics (Orders, Revenue, Customer growth)

### Key Metrics

```
techmo_orders_total             -- Total orders created
techmo_orders_value_total       -- Total order revenue
techmo_repairs_created_total    -- Total repair tickets
techmo_repairs_completed_total  -- Completed repairs
techmo_inventory_low_stock      -- Low stock alerts
techmo_api_requests_total       -- API request count
techmo_api_errors_total         -- API error count
techmo_api_latency_seconds      -- API response time
```

### View Logs
```bash
# All service logs
docker compose logs -f

# Specific service
docker compose logs -f order-service

# Search logs (Loki)
curl 'http://localhost:3100/loki/api/v1/query' \
  --data-urlencode 'query={container_name="techmo-order"}'
```

---

## 🚀 Deployment

### Docker Image Builds

All services are containerized and built on startup:

```bash
# Build all images
docker compose build

# Build specific service
docker compose build order-service

# Build without cache
docker compose build --no-cache
```

### Production Deployment Checklist

- [ ] Generate strong JWT secrets (use `openssl rand -base64 32`)
- [ ] Configure SMTP credentials for email
- [ ] Set up Cloudinary account (for image uploads)
- [ ] Create Cloudflare Tunnel token (for secure public access)
- [ ] Set `NODE_ENV=production`
- [ ] Enable Cloudflare WAF rules
- [ ] Configure automated backups
- [ ] Set up monitoring alerts
- [ ] Enable Prometheus retention policy
- [ ] Configure log rotation (Loki)
- [ ] Set strong Grafana admin password

### Deploy with Cloudflare Tunnel

```bash
# Get token from: https://one.dash.cloudflare.com/
docker compose --profile production up -d

# Verify tunnel status
curl https://api.cloudflare.com/client/v4/accounts/{account-id}/cfd_tunnel \
  -H "Authorization: Bearer {api-token}"
```

### Backup & Recovery

#### Automated Backups
```bash
# Run backup script (runs daily)
./scripts/backup.sh

# Restore from backup
./scripts/backup.sh restore backup_2024_01_15.sql
```

#### Manual Backup
```bash
docker compose exec postgres pg_dump -U techmo --all > full_backup.sql
```

#### Restore
```bash
docker compose exec -T postgres psql -U techmo < full_backup.sql
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# Check which service is using the port
lsof -i :3000

# Kill the process
kill -9 {PID}

# Or change the port in docker-compose.yml
```

#### 2. Docker Compose Won't Start
```bash
# Check logs
docker compose logs

# Rebuild images
docker compose build --no-cache

# Reset containers
docker compose down -v
docker compose up -d
```

#### 3. Database Connection Error
```bash
# Check Postgres is running
docker compose ps postgres

# Verify credentials in .env
docker compose logs postgres

# Restart Postgres
docker compose restart postgres
```

#### 4. Admin Dashboard Unreachable (Port 4001)
```bash
# This is a known bug. Fix it:
sed -i 's/EXPOSE 4000/EXPOSE 4001/g; s/ENV PORT=4000/ENV PORT=4001/g' apps/admin/Dockerfile

# Rebuild
docker compose up -d --build admin
```

#### 5. Migrations Not Applied
```bash
# Check if migrations ran
docker compose exec order-service npx prisma migrate status

# Manually run migrations
docker compose exec order-service npx prisma migrate deploy

# If stuck, reset (DESTRUCTIVE)
docker compose exec order-service npx prisma migrate reset --force
```

#### 6. High Memory Usage
```bash
# Monitor resource usage
docker stats

# Reduce container limits (edit docker-compose.yml)
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 2G
```

#### 7. Network Timeout Between Services
```bash
# Verify network exists
docker network ls

# Restart network
docker compose down
docker compose up -d

# Check service DNS resolution
docker compose exec gateway ping postgres
```

### Debugging Commands

```bash
# Interactive shell in container
docker compose exec gateway sh

# View environment variables
docker compose exec gateway env | grep DATABASE

# Check service health
docker compose exec gateway curl http://localhost:3000/health

# View container stats
docker stats

# Full container inspection
docker inspect techmo-gateway

# Test database connection
docker compose exec postgres psql -U techmo -d techmo_auth -c "SELECT 1"
```

### Getting Help

Check the following files for more information:
- [PRE_LAUNCH_GUIDE.md](./PRE_LAUNCH_GUIDE.md) – Deployment checklist
- [ENTERPRISE_ECOMMERCE_SYSTEM.md](./ENTERPRISE_ECOMMERCE_SYSTEM.md) – Business requirements
- Service-specific READMEs in `services/*/README.md`

---

## 📞 Support & Contact

For issues, questions, or feature requests:

1. Check existing [GitHub Issues](https://github.com/Umesh080797668/techmo/issues)
2. Create a new issue with:
   - Detailed error message
   - Docker version & OS
   - Steps to reproduce
   - `.env` configuration (without secrets)

---

## 📄 License

TechMo is proprietary software. Unauthorized copying or distribution is prohibited.

© 2024 TechMo Electronics. All rights reserved.

---

## 🎓 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma ORM Guide](https://www.prisma.io/docs/)
- [Spring Boot Reference](https://spring.io/projects/spring-boot)
- [FastAPI Tutorial](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Manual](https://www.postgresql.org/docs/)
- [N8N Workflow Engine](https://docs.n8n.io/)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/docs/)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -am 'Add feature'`)
4. Push to branch (`git push origin feature/your-feature`)
5. Create a Pull Request

---

**Last Updated:** May 2024  
**Version:** 1.0.0  
**Status:** Production Ready ✅
