# TECHMO ENTERPRISE RETAIL & SERVICE MANAGEMENT SYSTEM
## Electronics Sales, Inventory, Repair & Loyalty Platform
### Enterprise MVP – 2 Month Delivery Plan

---

## 1. PROJECT OVERVIEW

### Business Objective
TechMo requires an **enterprise-grade, local-first retail and service management system**
for smartphones and electronic accessories that supports:

- Retail sales (manual billing)
- Inventory & compatibility intelligence
- Repair & service ticketing
- Warranty validation
- Employee & HR management
- Loyalty & CRM
- Full audit & security controls

The system must:
- Run **locally on client machines initially**
- Use **only free / open-source tools**
- Be **microservice-based**
- Be **production-ready**, not a demo

---

## 2. CORE USER REQUIREMENTS (TECHMO)

---

## 2.1 Universal Device Compatibility Mapping

### Features
- Cross-model compatibility tagging
  - A single part (LCD, battery, back cover) can be linked to **multiple phone models**
- Compatibility verification
  - When a cashier selects or scans a part, the system **instantly displays all supported devices**
- Prevents:
  - Selling wrong spare parts
  - Repair mismatches
  - Warranty disputes

### Business Value
- Reduces returns
- Improves repair accuracy
- Increases customer trust

---

## 2.2 IMEI, Serial Number & Warranty Management

### Features
- IMEI / Serial Number mandatory entry for:
  - Phones
  - High-value accessories
  - Replaced parts
- Serial numbers printed on:
  - Invoice
  - Repair receipt
- Warranty eligibility validation:
  - Purchase date check
  - Warranty period check
  - Serial number match
  - Repair history check
- Supplier return support

### Warranty Claim Flow
1. Staff enters IMEI / serial number
2. System checks:
   - Product
   - Invoice date
   - Warranty period
   - Previous claims
3. System shows:
   - Eligible / Not eligible
   - Reason if rejected

---

## 2.3 Repair & Service Ticketing Workflow

### Features
- Repair ticket creation
- Job status lifecycle:
  - Pending Diagnosis
  - Awaiting Parts
  - Under Repair
  - Ready for Pickup
  - Completed
- QR code generated on drop-off receipt
- Customer can:
  - Scan QR
  - View real-time repair status (read-only)

### Benefits
- Transparent repair process
- Reduced staff inquiries
- Professional customer experience

---

## 2.4 Smart Inventory & Automated Alerts

### Features
- Real-time inventory tracking
- SKU-based stock
- Multi-location ready
- Low-stock thresholds
- Automatic alerts:
  - Email (NodeMailer)
- Custom barcode / QR generation for:
  - Unbranded accessories
  - Bulk items

### Inventory Rules
- Stock reservation vs deduction
- Immutable stock movement history
- Adjustment reason codes

---

## 2.5 Advanced Employee & HR Management

### Features
- Employee profiles
- Role-based system access
- Attendance logging
- Shift management
- Sales attribution per employee
- Commission & allowance calculation
- Payroll-ready reports

---

## 2.6 Security & Audit Trails

### Features
- Role-Based Access Control (RBAC)
- Permission-based actions
- Manager PIN for sensitive actions:
  - Discounts
  - Stock adjustments
  - Sale voids
- Immutable audit logs:
  - Deleted items
  - Modified stock
  - Voided sales
  - Permission overrides

---

## 2.7 Customer Loyalty & CRM

### Features
- Customer profiles:
  - Name
  - Contact
  - Purchase history
  - Repair history
- Loyalty points:
  - Earned on purchases
  - Earned on repairs
- Tier system:
  - Normal
  - Premium
- Redeemable discounts
- Manual adjustments (audited)

---

## 2.8 Dynamic Pricing & Combo Offers

### Features
- Rule-based pricing engine
- Automated combo discounts:
  - Example:
    - Buy Back Cover + Display Repair → 15% off Tempered Glass
- Time-based promotions
- Staff override with manager approval

---

## 2.9 Customer Trust & Transparency

### 📸 Repair Photo Timeline
- Technician uploads **before / during / after** photos per repair ticket
- Photos stored in Cloudinary under `techmo/repairs/{ticketRef}/`
- Customer Portal shows a **Photo Timeline** tab on the repair detail view (read-only)
- Eliminates "you scratched my phone" disputes with timestamped visual evidence

### ✍️ Digital Signature on Repair Completion
- Canvas-based signature pad rendered in Admin on the "Complete Repair" action
- Customer signs on pickup (mouse / touchscreen)
- Signature PNG embedded into the repair completion PDF via worker-service
- PDF uploaded to Cloudinary; `secure_url` saved on the repair record
- Serves as legal proof of delivery

---

## 2.10 Sales Intelligence & Conversion

### 🔔 Abandoned Reservation Tracker
- Reservations submitted on the marketing site are tracked with status `pending → contacted → converted | abandoned`
- A daily cron flags reservations > 48 h old with no staff action as `abandoned`
- Admin **"Follow-up Needed"** tab lists them with one-click WhatsApp button
- Zero cost — DB flag + existing WhatsApp deep-link

### 📱 Device Upgrade Reminder Engine
- Nightly query identifies customers whose smartphone purchase was > 18 months ago
- Results appear in Admin `/customers` with an **"Upgrade Candidate"** badge
- n8n workflow: Cron → fetch candidates → send personalised WhatsApp / email with current promotion

---

## 2.11 Staff Productivity & Offline Resilience

### 🚨 POS Mistake Prevention Engine
- Post-order rule checks:
  - Discount > 25 % → manager PIN required + audit log
  - Incompatible part + device detected → red warning before checkout
  - Same employee voids > 3 orders/day → manager Telegram alert
- Rules configurable in Admin `/settings` → **"POS Rules"**

### ⚡ Smart Defaults in POS
- `GET /api/v1/pos/smart-defaults?deviceModel=&staffId=` returns:
  - `mostCommonPart` — most sold part for this device (last 30 days)
  - `lastPrice` — last used price for that part
  - `suggestedCombo` — combo offer triggered by device + part match

### 💾 POS Offline Queue Mode
- If internet drops, orders are stored in **IndexedDB** (Dexie.js)
- Background sync replays queued orders on reconnect
- POS header shows: 🟢 Online / 🟡 Offline — N orders queued

### 🖨️ Printable Emergency POS Mode
- Manager-only button: **"Print Emergency Sheet"**
- Generates printable A4 PDF with product list, prices, and a daily-unique QR code
- Staff fill manually during outage; scan QR later to batch-import to system

---

## 3. ADDITIONAL ENTERPRISE FEATURES
- Marketing website (marketing pages read-only; product listings support inquiries/reservations but no online payment gateway)
- Admin dashboard
- Reports (CSV / PDF)
- Backup & restore
- Health monitoring (Grafana + Prometheus + Loki)
- API versioning
- Error tracking & observability (GlitchTip — self-hosted Sentry)
- Typo-tolerant product & customer search (Meilisearch)
- Customer communication (WhatsApp Click-to-Chat + Telegram Bot)
- Behavioural analytics & session replays (PostHog)
- Self-hosted secret management (Vaultwarden)
- Visual workflow automation (n8n — self-hosted Zapier)
- Uptime & cron-job monitoring (UptimeRobot + Healthchecks.io)
- Repair photo timeline (before/during/after — Cloudinary)
- Digital signature on repair pickup (canvas → PDF embed)
- Abandoned reservation tracker with follow-up queue
- Device upgrade reminder engine (18-month purchase trigger)
- POS mistake prevention engine (discount / void / compatibility rules)
- Smart defaults in POS (most common part, last price, combo suggestion)
- Offline POS queue mode (IndexedDB + background sync)
- Printable emergency POS fallback sheet (QR batch import)
- Impossible login detection (IP geolocation + travel speed check)
- Read-only emergency lockdown (one-click, Redis-backed, audited)
- Dead stock detector (configurable threshold per category)
- Repair failure rate analytics (parts re-replaced within 14 days)
- QR repair status stickers (public read-only tracking page)
- Review request engine (WhatsApp deep-link to Google review)
- Recently viewed devices / repairs per staff (localStorage)
- Keyboard-only POS mode (full shortcut set)
- Warranty terms auto-attach on invoice PDF
- Consent logs (GDPR / Sri Lanka PDPA — marketing, WhatsApp, SMS)
- Rule-based AI-like insights dashboard (zero OpenAI cost)

---

## 4. SYSTEM ARCHITECTURE

### Enterprise Microservices Architecture
                ┌────────────────────────┐
                │ API Gateway / BFF       │
                │ JWT Validation          │
                └──────────┬─────────────┘
                           │
 ┌─────────────────────────┼─────────────────────────┐
 │                         │                         │
 ┌────▼─────┐ ┌───────▼───────┐ ┌───────▼───────┐
│ Auth │ │ Product │ │ Inventory │
│ Service │ │ Service │ │ Service │
│ Spring │ │ NestJS │ │ NestJS │
│ Boot │ │ │ │ │
└──────────┘ └────────────────┘ └───────────────┘
│ │ │
│ ┌──────▼───────┐ ┌───────▼───────┐
│ │ Order / POS │ │ Loyalty / CRM │
│ │ Service │ │ Service │
│ │ NestJS │ │ NestJS │
│ └──────┬────────┘ └───────────────┘
│ │
│ ┌───────▼────────┐
│ │ Worker Service │
│ │ Python │
│ │ PDF + Email │
│ └─────────────────┘


---

## 5. TECHNOLOGY STACK (100% FREE)

### Backend
| Component | Technology |
|---|---|
| Auth & Security | Spring Boot 3 + Spring Security |
| Core APIs | NestJS (TypeScript) |
| Worker | Python 3.11 + FastAPI |
| Queue | Redis |
| Database | PostgreSQL |
| ORM | Prisma / JPA |
| PDF | WeasyPrint |
| Email | NodeMailer (SMTP – Gmail / custom SMTP) |
| Search | Meilisearch (self-hosted, Rust) |
| Error Tracking | GlitchTip (self-hosted Sentry OSS) |
| Metrics | Prometheus + Grafana |
| Log Aggregation | Grafana Loki + Promtail |
| Notifications | Telegram Bot API (`python-telegram-bot`) |
| Automation | n8n (self-hosted)

---

### Frontend
| Area | Tech |
|---|---|
| Marketing | Astro (Static + Islands) |
| Admin / POS | Next.js (CSR) |
| Styling | Tailwind CSS |

### Static Marketing Pages (Astro)

- Use Astro for read-only, high-performance marketing or documentation pages (landing pages, product marketing pages, FAQ, docs). Astro produces fast static HTML with optional island hydration for interactive widgets.
- Keep Admin / POS in Next.js (CSR) as originally specified — do not convert the full application.

### Design & Color Palette

- Use a clear, professional color palette for both the Marketing site and the Admin/POS web apps.
  - Define brand tokens (for example: `--color-primary`, `--color-secondary`, `--color-accent`, `--color-background`, `--color-surface`, `--color-success`, `--color-warning`, `--color-danger`).
  - Provide a Tailwind CSS configuration mapping these tokens to Tailwind colors and expose them as CSS variables to support easy theming (light/dark).
  - Ensure accessibility: all text and interactive elements must meet WCAG AA contrast ratios.
  - Keep the visual language minimal and consistent across both apps; document the palette and usage rules in the design system or README.

### Motion & Transitions

- Aim for smooth, purposeful transitions and subtle micro-interactions inspired by the Studio Vi website.
  - Use CSS transitions/animations and Tailwind utilities; prefer `transform` and `opacity` changes (GPU-accelerated) and avoid animating layout properties.
  - Recommended durations: 150ms–350ms for most UI transitions; use easing such as `cubic-bezier(0.2, 0.8, 0.2, 1)` or `ease-out` for natural motion.
  - Use `prefers-reduced-motion` to disable non-essential animations and respect user accessibility preferences.
  - Keep animations performant: limit simultaneous animated elements, batch DOM updates, and avoid causing layout thrashing.
  - For complex illustrations or hero animations, consider lightweight Lottie animations (lazy-load and limit file size).
  - Document motion tokens (durations, easings, key timelines) in the design system and expose them via Tailwind config for consistency.
  - Ensure animations do not interfere with usability or readability; provide an accessible setting to disable animations if needed.

Example Astro page (minimal):

```astro
---
const { title = 'Product' } = Astro.props;
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>{title}</title>
  </head>
  <body class="prose mx-auto py-12">
    <h1>{title}</h1>
    <p>This is a static product marketing page rendered by Astro.</p>
  </body>
</html>
```

Quick folder suggestion for Astro marketing site:

- `astro/` — project root
  - `src/pages/` — static pages (e.g. `index.astro`, `product/[slug].astro`)
  - `src/components/` — small UI islands (e.g. review widget, newsletter form)

Notes:
- Astro works well when the marketing site is predominantly static; use CSR/Next.js only for Admin/POS and for any server-driven pages that require auth or realtime updates.
- This recommendation is optional and limited to the marketing/read-only site only — not a full migration of the platform.

Product listings and checkout notes:

- Product listings exposed on the marketing site are not strictly read-only: they can include interactive elements such as `inquiry` forms, `reserve`/`hold` actions, and lead-capture flows that submit customer interest to the system.
- There is no integrated online payment gateway in the MVP. Without a payment gateway, customers cannot complete a paid checkout on the public marketing site — purchases should be completed via the POS (in-store), offline payment methods, or a future payment integration.
- If you want minimal interactivity on the static site (reserve, request-quote), implement small server endpoints or serverless functions to accept inquiries; keep full order/payment flows inside the Admin/POS service.

---

### Infrastructure (Local-First + Cloudflare Edge)
| Area | Tool |
|---|---|
| Containers | Docker |
| Orchestration | Docker Compose |
| Secrets | `.env` files + Vaultwarden |
| Hosting | Client local machine |
| Edge / CDN | Cloudflare (free plan) |
| Tunnel | Cloudflare Tunnel (`cloudflared`) |
| Media Storage | Cloudinary (25 GB free / month) |
| Bot Protection | Cloudflare Turnstile (free) |
| Analytics | Cloudflare Web Analytics (free) |
| Static Hosting | Cloudflare Pages (Astro marketing site) |
| DDoS / WAF | Cloudflare DDoS protection (free plan) |
| Search Engine | Meilisearch (local Docker) |
| Error Tracking | GlitchTip (local Docker) |
| Metrics & Dashboards | Prometheus + Grafana (local Docker) |
| Log Aggregation | Grafana Loki + Promtail (local Docker) |
| Secret Management | Vaultwarden (local Docker, Bitwarden-compatible) |
| Workflow Automation | n8n (local Docker) |
| Uptime Monitoring | UptimeRobot (free cloud — 50 monitors) |
| Cron Monitoring | Healthchecks.io (free cloud — 20 checks) |
| Behavioural Analytics | PostHog (cloud free tier — 1M events/month) |

---

## 5.1 CLOUDFLARE FREE TIER INTEGRATION

TechMo leverages **Cloudflare's generous free plan** to add enterprise-grade edge capabilities
at zero cost, complementing the local-first Docker setup.

### Why Cloudflare?
- Protects the local server without exposing raw IP addresses
- Provides CDN, WAF, DDoS protection, analytics — all free
- Enables a public marketing site without a separate server
- Bot/spam protection for public forms (Turnstile)

### Feature Breakdown

#### 🔒 Cloudflare Tunnel (cloudflared) — Free Forever
- Securely exposes local services (marketing site, gateway) via HTTPS
- No port forwarding or firewall rules needed
- DNS record managed automatically
- Configured via `cloudflare/tunnel.yml`
- Runs as a Docker container (`cloudflare/cloudflared`)
- **What it protects:** API gateway + marketing site

```
Local Docker Stack ──► cloudflared ──► Cloudflare Edge ──► Public HTTPS URL
```

#### 🌍 Cloudflare CDN + DNS — Free
- Marketing site assets served from 300+ PoPs worldwide
- Automatic HTTP→HTTPS redirect
- HSTS, TLS 1.3, HTTP/2 + HTTP/3 (QUIC)
- Enable "Proxied" DNS records on your domain dashboard
- Rocket Loader, Minification, Brotli compression (toggle in Cloudflare dashboard)

#### 📄 Cloudflare Pages — Free (500 builds/month, unlimited requests)
- Deploy the Astro marketing site with `wrangler pages deploy dist/`
- Automatic preview deployments from Git
- Custom domain support (techmo.lk)
- Headers / redirects via `_headers` / `_redirects` files
- Configured via `cloudflare/wrangler.toml`

```bash
# Deploy marketing site to Cloudflare Pages
cd apps/marketing && npm run build
npx wrangler pages deploy dist/ --project-name techmo-marketing
```

#### 🤖 Cloudflare Turnstile — Free (unlimited)
- Privacy-first CAPTCHA replacement (no user interaction required in managed mode)
- Protects: Contact / inquiry form, Admin login page
- Integration: Small `<script>` tag + server-side token validation
- No fees, no quotas on the free plan
- Environment variables: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`

```astro
<!-- Astro component: src/components/Turnstile.astro -->
<div class="cf-turnstile" data-sitekey={siteKey} data-theme="light"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

#### �️ Cloudinary — Free (25 GB storage, 25 GB bandwidth/month)
- Cloud media storage and CDN for:
  - Generated invoice PDFs
  - Repair receipt PDFs
  - Product images
  - QR code images
- Used by worker-service (Python `cloudinary` SDK)
- Files auto-optimised and served via Cloudinary's global CDN
- Returns a permanent `secure_url` for each uploaded asset
- Supports raw file uploads (PDFs), image transforms, and signed URLs
- Environment variables: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET`

```python
# worker-service: upload PDF after generation
import cloudinary.uploader
result = cloudinary.uploader.upload(
    pdf_path,
    resource_type="raw",
    folder="techmo/invoices",
    public_id=invoice_no,
)
return result["secure_url"]
```

#### 🛡️ Cloudflare WAF + DDoS — Free (via Tunnel)
- Any traffic routed through the Cloudflare Tunnel gets:
  - Automatic L3/L4 DDoS mitigation
  - Bot score filtering
  - Managed WAF rules (OWASP core rule set)
  - Rate limiting at the edge (configure in dashboard)
  - IP reputation blocking
- Free plan allows 5 WAF custom rules

#### 📊 Cloudflare Web Analytics — Free (unlimited)
- Cookie-free, GDPR-compliant web analytics
- Add the `<script>` beacon to Astro layout
- Privacy-respecting: no personal data collected
- No sampling — full data

```html
<!-- Add to Layout.astro <head> -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js'
  data-cf-beacon='{"token": "YOUR_BEACON_TOKEN"}'></script>
```

### Setup Checklist
1. [ ] Create Cloudflare account at cloudflare.com (free)
2. [ ] Add your domain (e.g. `techmo.lk`) to Cloudflare (update nameservers)
3. [ ] Create a Cloudflare Tunnel in Zero Trust dashboard → get `CF_TUNNEL_TOKEN`
4. [ ] Generate Turnstile widget → get `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
5. [ ] Create Cloudinary account at cloudinary.com (free) → get `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
6. [ ] Create Cloudflare Pages project `techmo-marketing`
7. [ ] Copy `cloudflare/tunnel.yml.example` → `cloudflare/tunnel.yml` and fill in values
8. [ ] Set all CF + Cloudinary env vars in `.env`
9. [ ] Enable Web Analytics beacon token in Cloudflare dashboard

### Architecture with Cloudflare
```
                 ┌─────────────────────────────┐
                 │     Cloudflare Edge          │
                 │  CDN · WAF · DDoS · Analytics│
                 └──────────┬──────────────────-┘
                            │ HTTPS
        ┌───────────────────┴────────────────────┐
        │                                        │
 ┌──────▼──────┐                         ┌───────▼──────────┐
 │  CF Pages   │                         │  CF Tunnel       │
 │  Marketing  │                         │  (cloudflared)   │
 │  Astro      │                         └───────┬──────────┘
 └─────────────┘                                 │
                                       ┌─────────▼──────────┐
                                       │   Local Docker      │
                                       │   API Gateway :3000 │
                                       │   NestJS + JWT      │
                                       └────────────────────-┘
                                                 │
                         ┌───────────────────────┼───────────┐
                    ┌────▼─────┐         ┌────────▼────┐  ┌──▼──────────┐
                    │  Auth    │         │  NestJS     │  │   Python    │
                    │ Spring   │         │  Services   │  │  Worker     │
                    │  Boot    │         │  x6 +       │  │   Worker   │
                    │          │         │  NodeMailer │  │+ Cloudinary│
                    └──────────┘         └─────────────┘  └────────────┘
```

---

## 5.2 OBSERVABILITY & MONITORING STACK

TechMo self-hosts a full observability stack inside Docker Compose — no external services, no per-event billing, complete visibility into every service.

### 🐛 GlitchTip — Self-Hosted Error Tracking (Sentry Alternative)
- Open-source, **Sentry-SDK-compatible** error tracking server
- Captures uncaught exceptions from all frontends (Next.js, Astro) and all backends (NestJS, Spring Boot, Python FastAPI)
- Use the official Sentry SDK and point the DSN at your local GlitchTip instance — **zero code changes required**
- Docker image: `glitchtip/glitchtip` · Container: `techmo-glitchtip` on port **8010**
- All error data stays on your local network — 100% private

```ts
// apps/admin/src/instrumentation.ts — GlitchTip via Sentry SDK
import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_GLITCHTIP_DSN,  // http://localhost:8010/api/<project-id>/
  tracesSampleRate: 0.2,
  environment: process.env.NODE_ENV,
});
```

```ts
// services/gateway/src/main.ts — NestJS error capture
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.GLITCHTIP_DSN });
```

**Environment variables:** `GLITCHTIP_DOMAIN`, `GLITCHTIP_SECRET_KEY`, `GLITCHTIP_DATABASE_URL`, `NEXT_PUBLIC_GLITCHTIP_DSN`, `GLITCHTIP_DSN`

---

### 📊 Grafana + Prometheus — System Metrics Dashboards
- **Prometheus** scrapes `/metrics` from every service on a 15-second interval
- **Grafana** visualises metrics with pre-built community dashboards (import by ID)
- Containers: `techmo-prometheus` → port **9090**, `techmo-grafana` → port **3100**

**Metrics exposed per service:**
| Service | Method | Key Metrics |
|---|---|---|
| NestJS services | `prom-client` + interceptor | HTTP rate, latency p95/p99, error rate |
| Spring Boot (Auth) | Actuator `/actuator/prometheus` | JVM heap, GC pause, DB pool |
| Python FastAPI | `prometheus-fastapi-instrumentator` | Request count, response time |
| PostgreSQL | `postgres_exporter` sidecar | Connections, query duration, table bloat |
| Redis | `redis_exporter` sidecar | Memory, hit/miss ratio, connected clients |

**Recommended Grafana dashboard IDs (import from grafana.com/dashboards):**
- `11159` — Node.js Application Dashboard
- `4701` — JVM (Micrometer / Spring Boot)
- `9628` — PostgreSQL Database
- `763` — Redis Dashboard

```yaml
# observability/prometheus.yml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: gateway
    static_configs: [{ targets: ['gateway:3001'] }]
  - job_name: product-service
    static_configs: [{ targets: ['product-service:3002'] }]
  - job_name: inventory-service
    static_configs: [{ targets: ['inventory-service:3003'] }]
  - job_name: order-service
    static_configs: [{ targets: ['order-service:3004'] }]
  - job_name: repair-service
    static_configs: [{ targets: ['repair-service:3005'] }]
  - job_name: loyalty-service
    static_configs: [{ targets: ['loyalty-service:3006'] }]
  - job_name: hr-service
    static_configs: [{ targets: ['hr-service:3007'] }]
  - job_name: auth-service
    metrics_path: /actuator/prometheus
    static_configs: [{ targets: ['auth-service:8081'] }]
  - job_name: worker-service
    static_configs: [{ targets: ['worker-service:8000'] }]
  - job_name: postgres
    static_configs: [{ targets: ['postgres-exporter:9187'] }]
  - job_name: redis
    static_configs: [{ targets: ['redis-exporter:9121'] }]
```

---

### 📜 Grafana Loki — Centralized Log Aggregation
- Loki stores compressed log lines indexed only by labels (container name, log level)
- **Promtail** agent ships stdout/stderr from every Docker container to Loki automatically
- Query logs from all 13+ services in **one Grafana Explore panel** — no more `docker logs`
- Container: `techmo-loki` → port **3200**; Promtail runs as a sidecar with no exposed port

```yaml
# observability/promtail/promtail.yml
server:
  http_listen_port: 9080
clients:
  - url: http://loki:3100/loki/api/v1/push
scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        target_label: container
```

**Example LogQL queries in Grafana:**
```logql
# All errors across all services
{container=~"techmo-.*"} |= "ERROR"

# Repair service logs only
{container="techmo-repair"}

# Failed order events
{container="techmo-order"} |= "failed"
```

**Observability folder structure:**
```
observability/
  prometheus.yml
  grafana/
    provisioning/
      datasources/
        prometheus.yml    # auto-configure Prometheus
        loki.yml          # auto-configure Loki
      dashboards/
        dashboards.yml
        node-dashboard.json
        jvm-dashboard.json
        postgres-dashboard.json
  loki/
    loki.yml
  promtail/
    promtail.yml
```

---

## 5.3 CUSTOMER COMMUNICATION (ZERO COST)

### 💬 WhatsApp Click-to-Chat — Staff-Initiated Notifications (Free)
No WhatsApp Business API subscription required. Uses the public `wa.me` deep-link protocol — completely free, no registration.

**How it works:**
1. Staff opens a repair ticket in the Admin dashboard
2. Clicks the **"Notify via WhatsApp"** button next to the customer's name
3. WhatsApp Desktop (or Web) opens with a fully pre-filled, status-specific message ready to send
4. Staff clicks Send — done in under 3 seconds

```ts
// services/gateway/src/util/whatsapp.ts
export function buildWhatsAppLink(
  phone: string,        // international format: "94771234567"
  customerName: string,
  device: string,
  ticketRef: string,
  status: string,
): string {
  const templates: Record<string, string> = {
    'Pending Diagnosis': `Hi ${customerName}, we've received your ${device} and diagnosis is underway. Ref: #${ticketRef} — TechMo.`,
    'Awaiting Parts':    `Hi ${customerName}, parts have been ordered for your ${device}. We'll update you shortly. Ref: #${ticketRef} — TechMo.`,
    'Under Repair':      `Hi ${customerName}, our technician is now working on your ${device}. Ref: #${ticketRef} — TechMo.`,
    'Ready for Pickup':  `Hi ${customerName}, great news! Your ${device} is ready for pickup. Ref: #${ticketRef} — TechMo Service Centre.`,
    'Completed':         `Hi ${customerName}, your ${device} repair is complete. Thank you for choosing TechMo! Ref: #${ticketRef}`,
  };
  const msg = encodeURIComponent(templates[status] ?? `Update on your repair #${ticketRef}.`);
  return `https://wa.me/${phone}?text=${msg}`;
}
```

- Admin `/repairs` page renders a WhatsApp icon button per ticket row
- Phone number stored in customer profile in **international format** (e.g. `94771234567`)
- Button opens `wa.me` link in a new tab — works on desktop WhatsApp and WhatsApp Web

---

### 🤖 Telegram Bot — Automated Real-Time Push Notifications (Free)
Customers opt-in to receive instant repair status pushes via Telegram. Worker-service (Python) delivers them via the Telegram Bot API — **100% free, no rate-limit concerns** at this scale.

**Bot Commands:**
| Command | Action |
|---|---|
| `/start` | Welcome message + usage instructions |
| `/track TK-456` | Subscribe Telegram chat to repair ticket `TK-456` |
| `/status` | Show current status of all tracked tickets |
| `/untrack TK-456` | Unsubscribe from a ticket |

**Integration flow:**
```
Customer → Telegram → /track TK-456
                 ↓
  Bot stores {chat_id, ticket_ref} in Redis
                 ↓
repair-service → status change → publish event to Redis queue
                 ↓
worker-service consumes event
                 ↓
Telegram Bot API → push notification to customer's phone
```

```python
# services/worker-service/app/telegram.py
import httpx, os

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BASE_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

STATUS_EMOJI = {
    "Pending Diagnosis": "🔍",
    "Awaiting Parts":    "📦",
    "Under Repair":      "🔧",
    "Ready for Pickup":  "✅",
    "Completed":         "🎉",
}

async def send_status_update(chat_id: str, ticket_ref: str, status: str, device: str):
    emoji = STATUS_EMOJI.get(status, "📋")
    text = (
        f"{emoji} <b>Repair Update — #{ticket_ref}</b>\n\n"
        f"Device: {device}\n"
        f"Status: <b>{status}</b>\n\n"
        f"<i>TechMo Service Centre</i>"
    )
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{BASE_URL}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
        )
```

**Environment variables:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`

---

## 5.4 SEARCH & BEHAVIOURAL ANALYTICS

### 🔍 Meilisearch — Typo-Tolerant Search Engine
Self-hosted, open-source search engine written in Rust. Sub-10 ms responses. Replaces all PostgreSQL `LIKE` / `ILIKE` queries in the POS and admin search bars.

**Features:**
- Search-as-you-type with instant results
- Typo tolerance: `"Iphne"` → iPhone 15, `"samsng"` → Samsung Galaxy
- Faceted filters: brand, category, in-stock
- Custom ranking rules per index

```ts
// services/product-service/src/products/search.service.ts
import { MeiliSearch } from 'meilisearch';

@Injectable()
export class SearchService {
  private client = new MeiliSearch({
    host:   process.env.MEILISEARCH_HOST!,
    apiKey: process.env.MEILISEARCH_API_KEY,
  });

  async indexProduct(product: Product) {
    await this.client.index('products').addDocuments([{
      id: product.id, name: product.name, brand: product.brand,
      model: product.model, sku: product.sku, category: product.category,
      price: product.price, inStock: product.stockQty > 0,
    }]);
  }

  async search(query: string, filters?: string) {
    return this.client.index('products').search(query, {
      limit: 20, filter: filters,
      attributesToHighlight: ['name', 'model'],
    });
  }
}
```

**Indexed entities:**
| Index | Fields | Used In |
|---|---|---|
| `products` | name, brand, model, SKU, barcode, category | POS search bar, Admin product list |
| `customers` | name, phone, email | Admin CRM search (staff only) |
| `repairs` | ticket ref, device model, customer name | Admin repair list search |

Container: `techmo-meilisearch` on port **7700**
**Environment variables:** `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY` (master key)

---

### 📹 PostHog — Session Replays & Product Analytics (Free Cloud)
Open-source product analytics. Use the **PostHog Cloud free tier** (1 million events/month) — no self-hosting required.

**Integrated into:**
- `apps/marketing/` — page views, inquiry form drop-off funnels, scroll depth
- `apps/customer/` — session replays on repair tracking page (identify where customers get confused)
- **Not integrated** in `apps/admin/` — staff PII risk; use GlitchTip for admin error tracking

```ts
// apps/customer/src/app/providers.tsx
import posthog from 'posthog-js';
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: 'https://app.posthog.com',
  capture_pageview: true,
  session_recording: {
    maskAllInputs: true,               // GDPR: mask all form fields
    maskTextSelector: '[data-sensitive]',
  },
});
```

**Environment variables:** `NEXT_PUBLIC_POSTHOG_KEY` (customer portal), `PUBLIC_POSTHOG_KEY` (marketing Astro)

---

## 5.5 ENHANCED SECURITY & RELIABILITY

### 🔑 Vaultwarden — Self-Hosted Password & Secrets Manager
Bitwarden-compatible server written in Rust. Runs on ~10 MB RAM. Manages all team API keys and credentials **inside the local network** — no cloud dependency.

**What to store in Vaultwarden:**
- Cloudinary API key / secret
- SMTP credentials
- Cloudflare API tokens
- Telegram Bot token
- GlitchTip secret key
- n8n encryption key
- PostgreSQL admin password
- Meilisearch master API key

**Access:** Bitwarden browser extension or Bitwarden mobile app → change the **Server URL** to `http://localhost:8020`

```yaml
# docker-compose snippet
vaultwarden:
  image: vaultwarden/server:latest
  container_name: techmo-vaultwarden
  volumes:
    - vaultwarden-data:/data
  ports:
    - "8020:80"
  environment:
    - ADMIN_TOKEN=${VAULTWARDEN_ADMIN_TOKEN}
    - DOMAIN=http://localhost:8020
    - SIGNUPS_ALLOWED=false    # Disable after initial team setup
  restart: unless-stopped
```

Container: `techmo-vaultwarden` on port **8020**
**Environment variables:** `VAULTWARDEN_ADMIN_TOKEN`, `VAULTWARDEN_DOMAIN`

---

### 📡 UptimeRobot — External Uptime Monitor (Free Cloud)
Monitors your Cloudflare Tunnel public URL **from outside your network**. Free tier: 50 monitors at 5-minute intervals. **No Docker container required** — purely external.

**Monitors to configure:**
| Monitor Name | URL | Alert Channel |
|---|---|---|
| API Gateway Health | `https://api.techmo.lk/health` | Email + Telegram |
| Marketing Site | `https://techmo.lk` | Email |
| Customer Portal | `https://portal.techmo.lk` | Email |

- Register at `uptimerobot.com` (free)
- Connect the Telegram alert channel to your **TechMo Telegram Bot** for instant push notifications when the server goes offline
- If local power fails or the tunnel drops → alert within 5 minutes

---

### ✅ Healthchecks.io — Cron Job Dead-Man's Switch (Free Cloud)
Monitors scheduled jobs by expecting a regular HTTP ping. If the ping doesn't arrive within the time window → instant alert. Free tier: 20 checks. **No Docker container required.**

```bash
#!/bin/bash
# scripts/backup.sh — daily PostgreSQL backup + healthcheck ping
set -e
BACKUP_FILE="/backups/techmo_$(date +%F).sql"
docker exec techmo-postgres pg_dumpall -U postgres > "$BACKUP_FILE"
gzip "$BACKUP_FILE"
# Ping healthchecks.io only on success — silence = alert
curl -fsS --retry 3 "${HEALTHCHECKS_PING_URL}" > /dev/null
echo "Backup complete and healthcheck pinged."
```

**Environment variables:** `HEALTHCHECKS_PING_URL`
Register at `healthchecks.io` (free), create a check, copy the ping URL.

---

## 5.6 WORKFLOW AUTOMATION (n8n)

### ⚡ n8n — Self-Hosted Visual Workflow Automation
Open-source Zapier / Make alternative with a drag-and-drop node editor. Connects all TechMo services without writing custom glue code.
Container: `techmo-n8n` on port **5678**.

**Pre-built Workflow Templates:**
| Workflow | Trigger | Steps |
|---|---|---|
| **Repair Follow-Up** | Webhook: repair marked `Completed` | 1. Wait 24 h → 2. Send Google Review request via WhatsApp |
| **High-Value Sale Alert** | Webhook: order total > LKR 50,000 | 1. Immediately send Telegram message to manager channel |
| **Low-Stock Daily Digest** | Cron: every day at 09:00 | 1. GET `/api/v1/inventory/low-stock` → 2. Send formatted digest email |
| **New Customer Welcome** | Webhook: customer registered | 1. Wait 5 min → 2. Send welcome email with loyalty points info |
| **Warranty Expiry Reminders** | Cron: every day at 10:00 | 1. GET `/api/v1/warranty/expiring-soon` → 2. Send reminder email per customer |
| **GlitchTip Fatal Alert** | GlitchTip webhook: new issue | 1. If severity = `fatal` → 2. Telegram alert to dev channel immediately |
| **Abandoned Reservation Digest** | Cron: daily 08:00 | 1. `UPDATE reservations SET status='abandoned'...` → 2. Email digest to manager |
| **Device Upgrade Campaign** | Cron: every Monday 09:00 | 1. GET `/api/v1/crm/upgrade-candidates` → 2. Send personalised WhatsApp per customer |
| **Dead Stock Weekly Digest** | Cron: every Monday 08:00 | 1. GET `/api/v1/inventory/dead-stock` → 2. Email full list to manager |
| **Loyalty Re-engagement** | Cron: every Sunday 10:00 | 1. GET `/api/v1/loyalty/silent-customers` → 2. Send re-engagement WhatsApp offer |

```json
// Webhook payload from repair-service on status change → n8n trigger
{
  "event": "repair.status.changed",
  "ticketRef": "TK-456",
  "customerName": "Saman Perera",
  "customerEmail": "saman@email.com",
  "customerPhone": "94771234567",
  "device": "Samsung Galaxy S23",
  "previousStatus": "Under Repair",
  "newStatus": "Completed",
  "completedAt": "2026-02-25T14:30:00Z"
}
```

**n8n Credentials to configure (in n8n UI → Credentials):**
- SMTP (NodeMailer-compatible)
- Telegram Bot API
- HTTP Basic Auth (for internal NestJS API calls)

**Setup steps:**
1. `docker compose up -d n8n`
2. Visit `http://localhost:5678` → create admin account
3. Import workflow JSON templates from `automation/n8n-workflows/`
4. Configure credentials in the n8n Credentials panel
5. Add n8n webhook URLs to relevant NestJS services as event targets

**Environment variables:** `N8N_BASIC_AUTH_ACTIVE=true`, `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`, `N8N_ENCRYPTION_KEY`, `WEBHOOK_URL=http://n8n:5678/webhook`

---

## 5.8 COOKIE SERVICE & TOKEN SECURITY

### Why HttpOnly Cookies for Refresh Tokens?

Storing JWT access tokens in `localStorage` is vulnerable to XSS attacks — any injected
script can steal the token. TechMo uses a **two-token / cookie-based session model**:

| Token | Storage | Lifetime | Accessible to JS? |
|---|---|---|---|
| Access token | **In-memory only** (`tokenStore`) | 15 min | ✅ Yes (needed for `Authorization: Bearer`) |
| Refresh token | **HttpOnly cookie** (set by gateway) | 7 days | ❌ No (invisible to JavaScript — XSS-proof) |

On every page load the frontend calls `POST /auth/refresh` → the browser automatically
sends the HttpOnly cookie → the gateway returns a fresh access token → stored in memory.
If the refresh cookie has expired, the user is sent to `/login`.

### Architecture

```
Browser Memory (JS)          HttpOnly Cookie (browser kernel)
┌───────────────────┐        ┌──────────────────────────────────┐
│  tokenStore.ts    │        │  Name:  techmo_refresh           │
│  _accessToken     │        │  Path:  /api/v1/auth             │
│  (no persistence) │        │  SameSite: Strict, HttpOnly      │
└───────────────────┘        │  Secure: true (prod)             │
         │                   └──────────────────────────────────┘
         │  Authorization: Bearer <access>          │ auto-sent by browser
         ▼                                          ▼
    API Gateway ─────────────────────────────────────▶ POST /auth/refresh
                                                       └─ returns new accessToken
```

### Gateway: `CookieService`

Location: `services/gateway/src/cookie/cookie.service.ts`

| Method | Cookie Name | Description |
|---|---|---|
| `setRefreshToken(res, token)` | `techmo_refresh` | Set staff JWT refresh (HttpOnly, Strict, `/api/v1/auth`) |
| `getRefreshToken(req)` | `techmo_refresh` | Read staff refresh token from request |
| `clearRefreshToken(res)` | `techmo_refresh` | Expire on logout |
| `setCustomerRefreshToken(res, token)` | `techmo_customer_refresh` | Customer portal refresh (HttpOnly, Strict) |
| `getCustomerRefreshToken(req)` | `techmo_customer_refresh` | Read customer refresh token |
| `clearCustomerRefreshToken(res)` | `techmo_customer_refresh` | Expire on customer logout |
| `setCsrfToken(res, token)` | `techmo_csrf` | CSRF double-submit (non-HttpOnly, readable by JS) |
| `setConsentCookie(res, categories)` | `techmo_consent` | Cookie consent record (SameSite=Lax, 1 year) |
| `set(res, options)` | any | Generic setter with full attribute control |

`CookieModule` is `@Global()` so `CookieService` is injectable in any gateway module.

```ts
// Usage in an auth controller endpoint
@Post('login')
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const { accessToken, refreshToken, user } = await this.authService.login(dto);
  this.cookieService.setRefreshToken(res, refreshToken);
  return { accessToken, user };   // access token returned in JSON body only
}

@Post('refresh')
@Public()
async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const token = this.cookieService.getRefreshToken(req);
  if (!token) throw new UnauthorizedException();
  const { accessToken, refreshToken } = await this.authService.refresh(token);
  this.cookieService.setRefreshToken(res, refreshToken);  // rotate
  return { accessToken };
}

@Post('logout')
async logout(@Res({ passthrough: true }) res: Response) {
  this.cookieService.clearRefreshToken(res);
  return { ok: true };
}
```

### Frontend: `token-store.ts`

Location: `apps/admin/src/lib/token-store.ts` · `apps/customer/src/lib/token-store.ts`

Holds the access token in a module-level variable (resets on page refresh — intentional).
`AuthContext` registers a `silentRefresh` function via `tokenStore.setRefreshFn()`.
The axios interceptor calls `tokenStore.refresh()` on every 401 without importing React.

```ts
// Typical silent-refresh flow (already wired in AuthContext.tsx):
// 1. Axios gets 401 from gateway
// 2. Interceptor calls tokenStore.refresh()
// 3. tokenStore calls the registered silentRefresh() from AuthContext
// 4. silentRefresh() → POST /auth/refresh → new accessToken stored in memory
// 5. Original request retried with new token
```

### Frontend: `cookie.service.ts`

Location: `apps/admin/src/lib/cookie.service.ts` · `apps/customer/src/lib/cookie.service.ts`

Manages only **non-sensitive, non-HttpOnly** browser cookies:

| Service export | Cookie | Purpose |
|---|---|---|
| `consentService.saveConsent(prefs)` | `techmo_consent` | GDPR/PDPA consent choices (1 year) |
| `consentService.getConsent()` | `techmo_consent` | Read back current consent |
| `consentService.isGranted(category)` | — | Check a single category (analytics / marketing / functional) |
| `themeService.save(theme)` | `techmo_theme` | Persist light/dark/system preference (1 year) |
| `localeService.save(locale)` | `techmo_locale` | Persist UI language (1 year) |

### Cookie Inventory

| Cookie Name | Set By | HttpOnly | SameSite | Max-Age | Purpose |
|---|---|---|---|---|---|
| `techmo_refresh` | Gateway | ✅ | Strict | 7 days | Staff JWT refresh token |
| `techmo_customer_refresh` | Gateway | ✅ | Strict | 7 days | Customer JWT refresh token |
| `techmo_csrf` | Gateway | ❌ | Strict | 1 day | CSRF double-submit value |
| `techmo_access` | — | ❌ | — | — | SSR fallback (short-lived, set only for SSR routes) |
| `techmo_consent` | Browser JS | ❌ | Lax | 1 year | GDPR/PDPA consent record |
| `techmo_theme` | Browser JS | ❌ | Strict | 1 year | UI theme preference |
| `techmo_locale` | Browser JS | ❌ | Strict | 1 year | UI language preference |

### `cookie-parser` Dependency

Add to the gateway package.json and install before running:

```bash
cd services/gateway && npm install cookie-parser @types/cookie-parser
```

Already registered in `services/gateway/src/main.ts` via `app.use(cookieParser())`.
`withCredentials: true` is set on both admin and customer axios instances so cookies
are sent cross-origin (required when the frontend and gateway are on different ports).

---

## 5.7 ADVANCED FEATURE SPECIFICATIONS

---

### 📸 Repair Photo Timeline

DB table: `repair_photos` (`id`, `repair_id`, `phase ENUM['before','during','after']`, `cloudinary_url`, `uploaded_by`, `created_at`)

```ts
// repair-service endpoint
// POST /api/v1/repairs/:id/photos  (multipart: file + phase)
// Uploads file to Cloudinary → stores secure_url → emits SSE event to customer portal
```

Customer Portal `/dashboard/repairs/[id]` renders a **Photo Timeline** tab with phase-grouped images loaded from `repair_photos`. Images are served directly from Cloudinary CDN.

---

### ✍️ Digital Signature on Repair Completion

```tsx
// apps/admin/src/components/SignatureModal.tsx
import SignatureCanvas from 'react-signature-canvas';
const sig = useRef<SignatureCanvas>(null);
const onComplete = async () => {
  const dataURL = sig.current!.toDataURL('image/png');
  await api.post(`/repairs/${id}/complete`, { signatureDataUrl: dataURL });
};
```

```python
# services/worker-service/app/pdf.py — embed signature into repair receipt
from weasyprint import HTML

def generate_repair_receipt(repair: dict, signature_data_url: str) -> str:
    html = render_template('repair_receipt.html', repair=repair, signature=signature_data_url)
    pdf_path = f"/tmp/receipt_{repair['ticketRef']}.pdf"
    HTML(string=html).write_pdf(pdf_path)
    result = cloudinary.uploader.upload(
        pdf_path, resource_type="raw",
        folder="techmo/receipts", public_id=repair['ticketRef']
    )
    return result["secure_url"]
```

---

### 🔔 Abandoned Reservation Tracker

```sql
CREATE TYPE reservation_status AS ENUM
  ('pending', 'contacted', 'converted', 'abandoned', 'cancelled');

CREATE TABLE reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID REFERENCES customers(id),
  product_id   UUID REFERENCES products(id),
  source       TEXT,          -- 'marketing_site', 'pos'
  status       reservation_status DEFAULT 'pending',
  staff_note   TEXT,
  follow_up_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

n8n cron (daily 08:00): `UPDATE reservations SET status='abandoned' WHERE status='pending' AND created_at < NOW() - INTERVAL '48 hours'` → send manager digest.

---

### 📱 Device Upgrade Reminder Engine

```sql
-- Upgrade candidates query (run nightly via n8n)
SELECT c.id, c.name, c.phone, c.email,
       p.name AS device_name, oi.created_at AS purchase_date,
       EXTRACT(DAYS FROM NOW() - oi.created_at)::int AS age_days
FROM customers c
JOIN order_items oi ON oi.customer_id = c.id
JOIN products p ON p.id = oi.product_id
WHERE p.category = 'smartphone'
  AND oi.created_at < NOW() - INTERVAL '18 months'
  AND c.id NOT IN (
    SELECT DISTINCT customer_id FROM order_items oi2
    JOIN products p2 ON p2.id = oi2.product_id
    WHERE p2.category = 'smartphone'
      AND oi2.created_at > NOW() - INTERVAL '6 months'
  )
ORDER BY age_days DESC;
```

---

### 🚨 POS Mistake Prevention Engine

Rule engine runs as a NestJS guard on `POST /orders`:

```ts
// services/order-service/src/orders/pos-rules.guard.ts
@Injectable()
export class PosRulesGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext) {
    const { order, staffId } = ctx.switchToHttp().getRequest().body;

    // Rule 1: Excessive discount
    if (order.discountPct > 25) {
      await this.requireManagerPin(ctx);
      await this.auditLog('EXCESSIVE_DISCOUNT', staffId, order);
    }

    // Rule 2: Compatibility check
    for (const item of order.items) {
      const compatible = await this.compatibilityService.check(item.productId, order.deviceModelId);
      if (!compatible) throw new BadRequestException(`Part ${item.sku} incompatible with ${order.deviceModel}`);
    }

    // Rule 3: Void rate check
    const voidsToday = await this.ordersRepo.countVoidsByStaff(staffId, today());
    if (voidsToday >= 3) await this.notifyManager('EXCESSIVE_VOIDS', staffId);

    return true;
  }
}
```

---

### ⚡ Smart Defaults in POS

```ts
// GET /api/v1/pos/smart-defaults?deviceModel=Samsung+Galaxy+S23&staffId=3
// Response:
{
  "mostCommonPart": { "productId": "uuid", "name": "Samsung S23 LCD Assembly", "sku": "LCD-SGS23" },
  "lastPrice": 18500,
  "suggestedCombo": {
    "trigger": "LCD Assembly",
    "suggest": "Tempered Glass",
    "discount": "15%",
    "message": "Add Tempered Glass for 15% off!"
  }
}
```

---

### 💾 POS Offline Queue Mode

```ts
// apps/admin/src/lib/offline-queue.ts
import Dexie, { Table } from 'dexie';

export interface OfflineOrder { id?: number; status: 'pending'|'synced'; payload: CreateOrderDto; createdAt: Date; }

export class OfflineDB extends Dexie {
  orders!: Table<OfflineOrder>;
  constructor() {
    super('techmoOffline');
    this.version(1).stores({ orders: '++id, status, createdAt' });
  }
}
export const offlineDB = new OfflineDB();

export async function syncOfflineOrders(api: AxiosInstance) {
  const pending = await offlineDB.orders.where('status').equals('pending').toArray();
  for (const item of pending) {
    try {
      await api.post('/api/v1/orders', item.payload);
      await offlineDB.orders.update(item.id!, { status: 'synced' });
    } catch { /* retain for next sync */ }
  }
}
```

`useOnlineStatus()` hook subscribes to `window.online` / `offline` events and fires `syncOfflineOrders` on reconnect.

---

### 🖨️ Printable Emergency POS Mode

- Manager-only button in Admin `/pos` header
- Calls `POST /api/v1/worker/emergency-sheet` → worker-service generates PDF
- PDF includes: today's product list + prices, daily-unique QR (`/api/v1/orders/batch-import/{date}/{token}`), staff instruction text
- On QR scan: opens a protected Admin page to type/scan the completed order refs for bulk import

---

### 🌍 Impossible Login Detection

```java
// services/auth-service: ImpossibleLoginDetector.java
@Component
public class ImpossibleLoginDetector {
    private static final double MAX_KMH = 900; // commercial flight speed

    public boolean isImpossibleTravel(LoginRecord last, LoginRecord current) {
        double km = haversine(last.getLat(), last.getLon(),
                              current.getLat(), current.getLon());
        double hours = Duration.between(last.getTimestamp(),
                                        current.getTimestamp()).toMinutes() / 60.0;
        return hours > 0 && (km / hours) > MAX_KMH;
    }
}
// IP geolocation: MaxMind GeoLite2 — free, offline, no API quota
// On trigger: lock account + log IMPOSSIBLE_TRAVEL audit event + email manager
```

---

### 🔒 Read-Only Emergency Lockdown

```ts
// services/gateway/src/guards/lockdown.guard.ts
@Injectable()
export class LockdownGuard implements CanActivate {
  constructor(private redis: RedisService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const mutating = ['POST','PUT','PATCH','DELETE'].includes(req.method);
    if (mutating) {
      const reason = await this.redis.get('system:lockdown');
      if (reason) throw new HttpException(
        { message: 'System is in read-only lockdown mode', reason }, 423
      );
    }
    return true;
  }
}
// Activate: POST /api/v1/admin/lockdown { reason, managerPin }
// Deactivate: DELETE /api/v1/admin/lockdown { managerPin }
// Both write to audit_logs
```

---

### 💀 Dead Stock Detector

```sql
-- Dead stock query (n8n cron weekly / Grafana panel)
SELECT p.name, p.sku, p.brand, i.qty_on_hand, i.last_sold_date,
       EXTRACT(DAYS FROM NOW() - i.last_sold_date)::int AS days_unsold,
       COALESCE(i.dead_stock_threshold_days, 60) AS threshold
FROM inventory i
JOIN products p ON p.id = i.product_id
WHERE i.qty_on_hand > 0
  AND (
    i.last_sold_date < NOW() - (COALESCE(i.dead_stock_threshold_days,60) || ' days')::INTERVAL
    OR (i.last_sold_date IS NULL AND i.created_at < NOW() - INTERVAL '60 days')
  )
ORDER BY days_unsold DESC;
```

Amber badge in Admin `/inventory`. Weekly n8n email digest to manager.

---

### 🔧 Repair Failure Rate Analytics

```sql
-- Parts re-replaced within 14 days (repeat failure)
SELECT r1.supplier_id, p_sup.name AS supplier,
       r1.part_category,
       COUNT(*) AS failures,
       ROUND(COUNT(*)::numeric / total.cnt * 100, 1) AS failure_rate_pct
FROM repairs r1
JOIN repairs r2 ON  r2.device_imei = r1.device_imei
                AND r2.part_category = r1.part_category
                AND r2.id <> r1.id
                AND r2.created_at BETWEEN r1.completed_at
                                      AND r1.completed_at + INTERVAL '14 days'
JOIN suppliers p_sup ON p_sup.id = r1.supplier_id
JOIN LATERAL (
  SELECT COUNT(*) AS cnt FROM repairs WHERE supplier_id = r1.supplier_id
) total ON TRUE
GROUP BY r1.supplier_id, p_sup.name, r1.part_category, total.cnt
HAVING COUNT(*)::numeric / total.cnt * 100 > 10
ORDER BY failure_rate_pct DESC;
```

Report in Admin `/reports` → **"Part Failure Rates by Supplier"**. Suppliers above 10 % threshold get an amber alert badge in `/inventory`.

---

### 📌 QR Repair Status Stickers

- Admin `/repairs/[id]` → **"Print Status Sticker"** button
- Worker-service generates a 5×5 cm PDF with a QR encoding `https://techmo.lk/track/{ticketRef}`
- Marketing site adds a new public unauthenticated route: `/track/[ref]` — shows repair status + photo timeline
- No login required for customers; eliminates status-check phone calls

---

### ⭐ Review Request Engine

```ts
// apps/admin/src/lib/review-request.ts
const GOOGLE_REVIEW_URL = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL;

export function buildReviewWhatsAppLink(phone: string, name: string): string {
  const msg = encodeURIComponent(
    `Hi ${name}, thank you for choosing TechMo! 😊 ` +
    `We'd love your feedback — could you spare 30 seconds to leave us a Google review? ` +
    `${GOOGLE_REVIEW_URL} — it means the world to us! 🙏`
  );
  return `https://wa.me/${phone}?text=${msg}`;
}
// Rendered as a button in Admin /repairs/[id] and /orders/[id]
```

---

### 🕐 Recently Viewed (Per Staff)

```ts
// apps/admin/src/lib/recent.ts
export type RecentItem = { type: 'repair'|'order'|'customer'; id: string; label: string; href: string; };

export function pushRecent(staffId: string, item: RecentItem) {
  const key = `techmo_recent_${staffId}`;
  const list: RecentItem[] = JSON.parse(localStorage.getItem(key) ?? '[]');
  const filtered = list.filter(i => i.href !== item.href);
  localStorage.setItem(key, JSON.stringify([item, ...filtered].slice(0, 5)));
}
export function getRecent(staffId: string): RecentItem[] {
  return JSON.parse(localStorage.getItem(`techmo_recent_${staffId}`) ?? '[]');
}
```

Rendered as a "Recent" dropdown pill in the POS search bar and repair list header.

---

### ⌨️ Keyboard-Only POS Mode

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open product search spotlight |
| `Ctrl+B` | Focus barcode / IMEI scan field |
| `Enter` | Add highlighted product to cart |
| `Ctrl+D` | Open discount dialog |
| `Ctrl+P` | Print / finalise bill |
| `Ctrl+Z` | Void last line item |
| `Escape` | Clear cart / cancel current action |
| `?` | Show keyboard shortcuts overlay |

All shortcuts registered via a global `useHotkeys` hook in the POS layout.

---

### 📋 Warranty Terms Auto-Attach

- `products` table gains FK `warranty_template_id → warranty_templates(id)`
- `warranty_templates` table: `(id, name, content_html, valid_for_days)`
- On invoice generation, worker-service fetches the template and appends it as **Page 2** of the invoice PDF
- One digital signature covers both the invoice and warranty terms

---

### 🛡️ Consent Logs (GDPR / Sri Lanka PDPA)

```sql
CREATE TABLE customer_consents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id),
  type         TEXT NOT NULL,   -- 'marketing_email' | 'whatsapp_contact' | 'sms_alerts'
  granted      BOOLEAN NOT NULL,
  granted_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  ip_address   TEXT,
  source       TEXT            -- 'pos_signup' | 'portal_profile' | 'inquiry_form'
);
```

- Customer Portal `/dashboard/profile` → **"Communication Preferences"** section
- Admin WhatsApp notify button disabled (greyed) if `whatsapp_contact` consent is `false`
- Marketing emails only sent if `marketing_email` consent is `true`
- Consent changes write to `audit_logs`

---

### 🧠 Rule-Based AI-Like Insights Dashboard

All powered by raw PostgreSQL queries + NestJS — zero OpenAI cost.

| Insight Card | Logic | Admin Action |
|---|---|---|
| Upgrade Candidates | Smartphone purchase > 18 months ago, no new phone since | WhatsApp upgrade offer |
| Repeat Screen Repairers | Screen repaired ≥ 2× on same IMEI | Suggest screen protector / upgrade |
| Loyal but Silent | Loyalty points > 500 + no purchase in 90 days | Re-engagement WhatsApp / email |
| Best Repair Staff | Lowest re-open rate per technician (last 90 days) | Commendation + performance badge |
| Worst-Quality Supplier | Part failure rate > 10 % within 14 days | Flag supplier in `/inventory` |
| Peak Hour Heatmap | Order count by hour-of-day (last 30 days) | Staff scheduling hint |
| Untaken Combo | Customer bought part A without part B (common combo) | Suggest on next visit note |

Insight cards surface on Admin `/dashboard` (top 3 by urgency) and a dedicated **`/insights`** page showing all seven.

---

## 6. DATABASE DESIGN (HIGH LEVEL)

### Core Tables
- users
- roles
- permissions
- employees
- attendance
- customers
- products
- product_variants
- device_models
- part_compatibility
- inventory
- inventory_movements
- orders
- order_items
- invoices
- repairs
- repair_status_history
- repair_photos *(phase: before/during/after, cloudinary_url, uploaded_by)*
- loyalty_points
- warranty_claims
- warranty_templates *(name, content_html, valid_for_days)*
- reservations *(status: pending/contacted/converted/abandoned/cancelled)*
- customer_consents *(type, granted, granted_at, revoked_at, source)*
- login_history *(user_id, ip_address, lat, lon, city, timestamp)*
- suppliers *(name, contact, failure_rate_pct)*
- pos_rules *(rule_type, threshold, action, enabled)*
- audit_logs

### Design Rules
- Immutable audit tables
- No shared DB across services
- Strong foreign keys
- Soft deletes only where allowed

---

## 7. WORKER SERVICE

### Responsibilities
- Invoice PDF generation (with warranty terms auto-attached as page 2)
- Repair receipt PDF generation (with embedded digital signature)
- QR code generation (repair ticket drop-off + status sticker)
- Emergency POS sheet PDF generation
- Email sending (NodeMailer)
- Telegram Bot push notifications (repair status updates)
- Retry & failure handling
- n8n webhook event publishing (repair status changes, high-value orders, upgrade candidates)

---

## 8. SECURITY MODEL

- Central auth service
- RSA-signed JWT
- Role + permission checks
- Manager PIN validation
- Rate limiting
- Audit logging
- **Impossible login detection** — MaxMind GeoLite2 (free, offline) + haversine travel-speed check; triggers account lock + manager email on anomaly
- **Read-only emergency lockdown** — one-click Redis flag rejects all mutation requests (HTTP 423); full audit trail on activate/deactivate
- **Consent enforcement** — WhatsApp notify and marketing emails blocked at gateway if consent record is `false`
- **POS rule engine** — excessive discount / void rate / compatibility violations caught pre-order

---

## 9. DELIVERY PLAN (2 MONTHS)

### Weeks 1–2
- Architecture & DB design
- Auth service
- Product & compatibility service
- Inventory service
- Docker Compose

### Weeks 3–4
- POS / Order service
- Repair ticketing
- Worker (PDF + Email)
- Warranty logic

### Weeks 5–6
- Loyalty & CRM
- HR & payroll logic
- Reports & exports
- Security hardening
- Repair photo timeline (Cloudinary upload + customer portal view)
- Digital signature on repair completion (canvas → PDF embed)
- Abandoned reservation tracker + follow-up queue
- Device upgrade reminder engine (CRM query + n8n workflow)
- POS mistake prevention engine (rule guard + manager alerts)
- Smart defaults API in POS
- Consent logs (GDPR / PDPA) + Customer Portal preferences UI
- Warranty terms auto-attach on invoice PDF

### Weeks 7–8
- End-to-end testing
- Performance tuning
- Backup & restore (with Healthchecks.io ping)
- Observability stack setup (Grafana dashboards, Prometheus scrape config, Loki log aggregation)
- GlitchTip DSN integration across all frontends and backends
- Meilisearch index sync for products, customers, repairs
- Telegram Bot deployment + customer opt-in flow
- WhatsApp notify buttons in Admin repair view
- Review request engine (WhatsApp Google Review link)
- QR repair status stickers + public `/track/[ref]` page on marketing site
- Impossible login detection (MaxMind GeoLite2 + auth-service)
- Read-only emergency lockdown (Redis flag + gateway guard)
- Offline POS queue mode (Dexie.js + background sync)
- Printable emergency POS sheet (worker-service PDF)
- Dead stock detector + repair failure rate analytics
- Rule-based AI-like insights dashboard (`/insights` page)
- Recently viewed + keyboard-only POS shortcuts
- n8n workflow automation setup (follow-up, alerts, digests, upgrade reminders)
- Vaultwarden initial secrets migration for the team
- UptimeRobot monitors for Cloudflare Tunnel URLs
- Documentation & handover

---

## 10. FINAL VERDICT

This system is:
- Enterprise-grade
- Fully local & free
- Secure & auditable (RBAC · manager PIN · impossible login detection · emergency lockdown)
- Retail + repair ready
- Dispute-proof (repair photo timeline · digital signature on pickup)
- Sales-recovering (abandoned reservation tracker · device upgrade reminder engine)
- Staff-optimised (POS mistake prevention · smart defaults · keyboard-only mode)
- Offline-resilient (IndexedDB order queue · printable emergency POS sheet)
- Inventory-intelligent (dead stock detector · supplier failure rate analytics)
- Customer-transparent (public QR repair tracking · Google review engine)
- GDPR / Sri Lanka PDPA compliant (consent logs · warranty terms auto-attached)
- Rule-based intelligent (7 AI-like insight cards — zero OpenAI cost)
- Fully observable (Grafana · Loki · GlitchTip)
- Customer-connected (WhatsApp · Telegram Bot — zero messaging cost)
- Automated (n8n workflows — follow-ups, alerts, digests, upgrade reminders)
- Typo-tolerant search (Meilisearch)
- Secret-safe (Vaultwarden)
- Self-healing awareness (UptimeRobot · Healthchecks.io)
- Expandable to cloud later
- Realistic within 2 months

This is **not a prototype** — this is a **business-ready platform**.

---


## 11. FRONTEND APPLICATIONS — COMPLETE REFERENCE

### 11.1 Application Inventory & Ports

| App | Framework | Port (dev) | Port (Docker) | Description |
|---|---|---|---|---|
| Marketing Site | Astro 4.4 | 4000 | 4000 | Public-facing static site |
| Admin / POS | Next.js 14 CSR | 3000 | 4001 | Staff management dashboard |
| Customer Portal | Next.js 14 CSR | 4002 | 4002 | Self-service customer dashboard |

---

### 11.2 Marketing Site — All Pages (`apps/marketing/`)

| Route | File | Description |
|---|---|---|
| `/` | `pages/index.astro` | Homepage — hero, products, services, loyalty CTA |
| `/about` | `pages/about.astro` | Company story & team |
| `/contact` | `pages/contact.astro` | Contact form + map |
| `/faq` | `pages/faq.astro` | Frequently asked questions |
| `/products` | `pages/products.astro` | Product listings (inquiry/reserve) |
| `/repairs` | `pages/repairs.astro` | Repair services, brands, 5-step process |
| `/warranty` | `pages/warranty.astro` | Product & repair warranty tables + claim process |
| `/loyalty` | `pages/loyalty.astro` | Tier system (Standard/Premium), points table, FAQs |
| `/privacy-policy` | `pages/privacy-policy.astro` | GDPR-compliant privacy policy (11 sections) |
| `/terms` | `pages/terms.astro` | Terms of Service (11 sections, Sri Lanka law) |
| `/cookies` | `pages/cookies.astro` | Cookie policy with minimal-cookie table |
| `/sitemap.xml` | `pages/sitemap.xml.astro` | Dynamic XML sitemap (13 URLs) |
| `/robots.txt` | `public/robots.txt` | Search engine directives |
| `404` | `pages/404.astro` | Custom 404 with quick links |
| `500` | `pages/500.astro` | Server error page |

#### SEO & Performance Features (Layout.astro)
- Full Open Graph meta tags (`og:type`, `og:url`, `og:title`, `og:description`, `og:image`, etc.)
- Twitter Card meta tags (`summary_large_image`)
- `<link rel="canonical">` — auto-generated from current URL
- JSON-LD **LocalBusiness** structured data schema
- `<meta name="robots">` — `noindex` opt-in prop for private pages
- Astro **ViewTransitions** — page-to-page fade animations
- Custom NProgress-style progress bar (driven by `astro:before-preparation` + `astro:page-load` events)
- Cloudflare Web Analytics beacon (conditional on `CF_ANALYTICS_TOKEN` env var)
- `prefers-reduced-motion` respected globally

---

### 11.3 Admin Dashboard — All Pages (`apps/admin/src/app/`)

All pages under `(authenticated)/` require JWT auth (`techmo_token` in localStorage).

| Route | Description |
|---|---|
| `/login` | Staff login with username + password |
| `/dashboard` | Overview: revenue, repairs, inventory alerts, charts |
| `/pos` | Point-of-sale interface for in-store billing |
| `/products` | Product catalogue management (CRUD) |
| `/inventory` | Stock levels, low-stock alerts |
| `/orders` | Order history + invoice list |
| `/repairs` | Repair ticket management, status updates |
| `/customers` | Customer CRM list |
| `/customers/[id]` | Customer detail: orders, repairs, loyalty transactions, edit modal, points modal |
| `/employees` | Employee list |
| `/employees/[id]` | Employee detail: attendance, shifts, payroll tabs, clock-in, edit modal |
| `/warranty` | Warranty claim management |
| `/imei` | IMEI / serial number lookup |
| `/compatibility` | Device compatibility matrix |
| `/pricing` | Pricing rules & combo offers |
| `/payroll` | Payroll processing & reports |
| `/reports` | Analytics exports (CSV / PDF) — incl. part failure rates by supplier |
| `/audit-logs` | Immutable audit trail viewer |
| `/settings` | System configuration + POS rules + lockdown toggle |
| `/reservations` | Abandoned reservation tracker + follow-up queue ("Follow-up Needed" tab) |
| `/insights` | Rule-based AI-like insights — upgrade candidates, repeat repairers, peak hours, etc. |

#### Error & Loading Pages (Admin)
| File | Description |
|---|---|
| `src/app/not-found.tsx` | Gradient 404, links to /dashboard and /pos |
| `src/app/global-error.tsx` | Full html wrapper error boundary (shows error.digest) |
| `src/app/loading.tsx` | Indigo spinner for root-level loading |
| `src/app/(authenticated)/loading.tsx` | Full skeleton: sidebar + stat cards + table rows (animated stagger) |

---

### 11.4 Customer Portal — All Pages (`apps/customer/src/app/`)

Self-service customer dashboard. Auth: **Phone OTP** (no password required).
Token stored as `techmo_customer_token` in localStorage.

#### Authentication Flow
```
POST /api/v1/auth/customer/otp/request  { phone }
    -> 6-digit OTP sent via SMS/email

POST /api/v1/auth/customer/otp/verify   { phone, otp }
    -> { accessToken, customer }
```

| Route | Description |
|---|---|
| `/` | Redirects to /dashboard |
| `/login` | 2-step OTP login: phone then 6-digit OTP grid; 60s resend countdown |
| `/dashboard` | Overview: 4 stat cards, loyalty tier progress, recent repairs, recent orders |
| `/dashboard/repairs` | Repair list + filter + expandable 5-step timeline |
| `/dashboard/orders` | Order history + filter + expandable line items + invoice PDF link |
| `/dashboard/points` | Points balance, tier progress, Points Value Guide, full transaction log |
| `/dashboard/warranty` | IMEI/serial lookup, warranty status (active/expiring/expired), claim form |
| `/dashboard/repairs/[id]` | Repair detail: 5-step status timeline + **Photo Timeline tab** (before/during/after Cloudinary images) |
| `/dashboard/profile` | View/edit profile (name, email, address); phone read-only + **Communication Preferences** (consent toggles) |
| `/track/[ref]` | **Public unauthenticated** repair status page — status + photo timeline; linked from QR sticker |

#### Error & Loading Pages (Customer Portal)
| File | Description |
|---|---|
| `src/app/not-found.tsx` | Gradient 404, links to /dashboard and /login |
| `src/app/global-error.tsx` | Full html wrapper error boundary |
| `src/app/loading.tsx` | Spinning ring animation |
| `src/app/dashboard/loading.tsx` | Skeleton grid: 4 stat cards + 2 content areas |

#### Design System (Dark Theme)
- `--primary: #5b8dee` (blue)
- `--accent: #f59e0b` (amber)
- `--background: #0f1117` (near-black)
- `--sidebar: #141824`
- `--surface: #1a2035`

---

## 12. DOCKER COMPOSE SERVICES

> **Container reduction:** The original 7 separate PostgreSQL containers have been **consolidated into one**
> (`techmo-postgres`). All 7 logical databases (`techmo_auth`, `techmo_product`, `techmo_inventory`,
> `techmo_order`, `techmo_repair`, `techmo_loyalty`, `techmo_hr`) live in a single Postgres instance,
> created automatically by `scripts/init-databases.sh` on first boot.
> This saves ~700 MB RAM and 6 container startup slots with zero loss of data isolation.

| Service | Container | Host Port | Tech |
|---|---|---|---|
| **postgres** | **techmo-postgres** | **5432** | **PostgreSQL 16 (all 7 logical databases)** |
| redis | techmo-redis | 6379 | Redis 7 |
| auth-service | techmo-auth | 8080 | Spring Boot 3 |
| gateway | techmo-gateway | 3000 | NestJS |
| product-service | techmo-product | 3001 | NestJS + Prisma |
| inventory-service | techmo-inventory | 3002 | NestJS + Prisma |
| order-service | techmo-order | 3003 | NestJS + Prisma |
| repair-service | techmo-repair | 3004 | NestJS + Prisma |
| loyalty-service | techmo-loyalty | 3005 | NestJS + Prisma |
| hr-service | techmo-hr | 3006 | NestJS + Prisma |
| worker-service | techmo-worker | 8000 | Python FastAPI |
| marketing | techmo-marketing | 4000 | Astro (Node adapter) |
| admin | techmo-admin | 4001 | Next.js standalone |
| customer | techmo-customer | 4002 | Next.js standalone |
| **— Observability —** | | | |
| prometheus | techmo-prometheus | 9090 | Prometheus metrics scraper |
| grafana | techmo-grafana | 3100 | Grafana dashboards |
| loki | techmo-loki | 3200 | Grafana Loki log storage |
| promtail | techmo-promtail | — | Log shipper (no exposed port) |
| glitchtip | techmo-glitchtip | 8010 | GlitchTip error tracking |
| postgres-exporter | techmo-pg-exporter | 9187 | PostgreSQL → Prometheus |
| redis-exporter | techmo-redis-exporter | 9121 | Redis → Prometheus |
| **— Search —** | | | |
| meilisearch | techmo-meilisearch | 7700 | Meilisearch search engine |
| **— Automation & Secrets —** | | | |
| n8n | techmo-n8n | 5678 | n8n workflow automation |
| vaultwarden | techmo-vaultwarden | 8020 | Vaultwarden secrets manager |

All services are connected on the `techmo-net` Docker bridge network.

---

## 13. ENVIRONMENT VARIABLES

### Marketing Site (`apps/marketing/.env`)
```
SITE_URL=https://techmo.lk
PUBLIC_CUSTOMER_PORTAL_URL=http://localhost:4002
CF_ANALYTICS_TOKEN=
PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

### Admin App (`apps/admin/.env.local`)
```
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:4001
NEXT_PUBLIC_GOOGLE_REVIEW_URL=https://g.page/r/XXXXXXXXXXXXXXXX/review
```

### Auth Service (`services/auth-service/.env`)
```
MAXMIND_DB_PATH=/etc/maxmind/GeoLite2-City.mmdb
IMPOSSIBLE_TRAVEL_MAX_KMH=900
```

### Customer Portal (`apps/customer/.env.local`)
```
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:4002
```

### Worker Service (`services/worker-service/.env`)
```
REDIS_URL=redis://redis:6379
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=techmo-docs
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@techmo.lk
SMTP_PASS=
GLITCHTIP_DSN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=TechMoServiceBot
HEALTHCHECKS_PING_URL=
```

### Observability Stack (root `.env` or `observability/.env`)
```
# GlitchTip
GLITCHTIP_DOMAIN=http://localhost:8010
GLITCHTIP_SECRET_KEY=
GLITCHTIP_DATABASE_URL=postgresql://postgres:password@postgres:5432/glitchtip
# DSNs are generated inside GlitchTip UI after first run
NEXT_PUBLIC_GLITCHTIP_DSN=
PUBLIC_GLITCHTIP_DSN=

# Grafana
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=
```

### Meilisearch (root `.env`)
```
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=
```

### PostHog (frontend `.env` files)
```
# apps/customer/.env.local
NEXT_PUBLIC_POSTHOG_KEY=

# apps/marketing/.env
PUBLIC_POSTHOG_KEY=
```

### Vaultwarden (root `.env`)
```
VAULTWARDEN_ADMIN_TOKEN=
VAULTWARDEN_DOMAIN=http://localhost:8020
```

### n8n (root `.env`)
```
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=
N8N_ENCRYPTION_KEY=
WEBHOOK_URL=http://n8n:5678/webhook
```

---

## 14. QUICK START

```bash
# 1. Copy env files
cp apps/marketing/.env.example      apps/marketing/.env
cp apps/admin/.env.local.example    apps/admin/.env.local
cp apps/customer/.env.local.example apps/customer/.env.local

# 2. Install frontend dependencies
cd apps/marketing && npm install && cd ../..
cd apps/admin     && npm install && cd ../..
cd apps/customer  && npm install && cd ../..

# 3. Start all services
docker compose up -d

# 4. Run database migrations
docker compose exec product-service   npx prisma migrate deploy
docker compose exec inventory-service npx prisma migrate deploy
docker compose exec order-service     npx prisma migrate deploy
docker compose exec repair-service    npx prisma migrate deploy
docker compose exec loyalty-service   npx prisma migrate deploy
docker compose exec hr-service        npx prisma migrate deploy

# 5. Access applications
# Marketing site   -> http://localhost:4000
# Admin dashboard  -> http://localhost:4001  (admin / techmo123)
# Customer portal  -> http://localhost:4002  (OTP login)
# API Gateway      -> http://localhost:3001

# --- Observability (auto-started with docker compose up -d) ---
# Grafana          -> http://localhost:3100   (admin / GF_SECURITY_ADMIN_PASSWORD)
# Prometheus       -> http://localhost:9090
# GlitchTip        -> http://localhost:8010   (create account on first run)

# --- Search & Automation ---
# Meilisearch      -> http://localhost:7700
# n8n              -> http://localhost:5678   (admin / N8N_BASIC_AUTH_PASSWORD)

# --- Security & Secrets ---
# Vaultwarden      -> http://localhost:8020/admin  (use VAULTWARDEN_ADMIN_TOKEN)

# --- External cloud services (no local container) ---
# UptimeRobot      -> https://uptimerobot.com  (configure monitors for Cloudflare Tunnel URLs)
# Healthchecks.io  -> https://healthchecks.io  (configure backup cron ping)
# PostHog          -> https://app.posthog.com  (cloud free tier)
```

---

## 15. ADVANCED ENTERPRISE FEATURES (PHASE 2)

The following 15 features extend the platform with hardware integration, zero-cost AI, enhanced
customer experience, security hardening, and multi-location logistics support.
All features use exclusively free / open-source tools and run entirely on-premise.

---

### 15.1 ADVANCED INVENTORY & HARDWARE INTEGRATION

---

#### 📷 PWA Barcode Scanner
**File:** `apps/admin/src/components/BarcodeScanner.tsx`

Turns any modern staff smartphone into a wireless barcode / QR scanner — no dedicated hardware
required. Uses the browser-native **Barcode Detection API** (Chrome Android 9+, Safari 17.4+).

**How it works:**
1. Staff opens the Admin app on their phone and navigates to any scan prompt
2. Camera feed displays in a `<video>` element; an off-screen `<canvas>` frame is read by
   `BarcodeDetector.detect()` on every `requestAnimationFrame` tick
3. On successful scan: `navigator.vibrate([80,30,80])` haptic + Web Audio API beep
4. `onScan(value, format)` callback fires — used to populate IMEI fields, POS search, inventory lookup
5. 1.5 s debounce prevents duplicate scans; manual fallback input for unsupported browsers

**Supported formats:** `qr_code`, `code_128`, `ean_13`, `ean_8`, `code_39`, `data_matrix`, `pdf417`

**Scan history:** Last 20 scans kept in session memory; tap a history entry to re-emit it

**Props:** `onScan(value, format)`, `formats?`, `continuous?`

---

#### 🔋 Battery Shelf-Life & Degradation Tracker
**Files:**
- `services/inventory-service/prisma/battery-schema-extension.prisma`
- `services/inventory-service/src/inventory/battery-degradation.service.ts`
- `services/inventory-service/src/inventory/battery-degradation.controller.ts`

Tracks shelf-life of battery stock from the manufacture date and raises tiered alerts before
batteries degrade below safe selling condition. A `@Cron(EVERY_DAY_AT_6AM)` job runs daily.

**Prisma models added:**
```prisma
model BatteryStockEntry {
  id               String         @id @default(cuid())
  inventoryId      String
  manufacturedAt   DateTime       @default(now())
  shelfLifeDays    Int            @default(730)
  alertFractionPct Int            @default(80)
  batchNumber      String?
  ratedCapacityMah Int?
  notes            String?
  createdAt        DateTime       @default(now())
  alerts           BatteryAlert[]
}

model BatteryAlert {
  id             String           @id @default(cuid())
  entryId        String
  alertType      BatteryAlertType
  daysOnShelf    Int
  acknowledgedAt DateTime?
  acknowledgedBy String?
  createdAt      DateTime         @default(now())
}

enum BatteryAlertType { APPROACHING_SHELF_LIMIT  SHELF_LIMIT_EXCEEDED  CRITICAL_AGE }
```

**Alert thresholds:**

| Alert | Condition |
|---|---|
| `APPROACHING_SHELF_LIMIT` | `daysOnShelf >= shelfLifeDays × alertFractionPct / 100` |
| `SHELF_LIMIT_EXCEEDED` | `daysOnShelf >= shelfLifeDays` |
| `CRITICAL_AGE` | `daysOnShelf >= 540` (18 months, regardless of settings) |

**REST endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/inventory/battery/:inventoryId` | Register a new battery batch |
| `GET` | `/inventory/battery/:inventoryId` | List entries with calculated `shelfPct` |
| `GET` | `/inventory/battery/alerts` | List all unacknowledged alerts (`?type=`) |
| `GET` | `/inventory/battery/scan` | Manually trigger the daily scan |
| `PATCH` | `/inventory/battery/alerts/:id/acknowledge` | Acknowledge an alert |

---

#### 🏷️ Thermal Label Printing (CSS @media print)
**File:** `apps/admin/src/components/ThermalLabel.tsx`

Generates precision thermal labels using `window.open()` + CSS `@page { size: {W}mm {H}mm; margin:0 }`.
No external labelling software, no driver installation — works with any thermal printer.

**Label types:**

| Type | Contents | Default size |
|---|---|---|
| `part` | SKU, barcode string, price, bin location | 38 × 25 mm |
| `repair` | Ticket ref, QR placeholder, device, status | 38 × 25 mm |
| `asset` | IMEI, brand/model, purchase date, warranty expiry | 56 × 30 mm |

**Props:** `data: LabelData`, `copies?: number` (1–50), `widthMm?`, `heightMm?`

---

### 15.2 INTELLIGENCE & AUTOMATION (ZERO-COST AI)

---

#### 📄 On-Device OCR (Tesseract.js)
**File:** `apps/admin/src/components/OcrScanner.tsx`

Client-side OCR that eliminates manual IMEI / NIC entry during device intake.
Uses **Tesseract.js** (WebAssembly) — zero server cost, runs entirely in the browser.

**Extraction modes:**

| Mode | Extraction | Pattern |
|---|---|---|
| `imei` | 15-digit IMEI from phone sticker | `/\d{15}/` |
| `id` | Sri Lanka NIC (old + new format) | `9\d{8}[VvXx]` / `\d{12}` |
| `text` | Full raw OCR text | — |

**Input methods:** Live camera (`getUserMedia`) or file upload. Lazy-loaded — no bundle impact.

**Install:** `npm install tesseract.js` in `apps/admin`

---

#### 🤖 Ollama Local LLM Integration
**File:** `services/worker-service/app/ollama.py`

Three AI features powered by a locally running **Ollama** LLM (llama3 / mistral / phi3).

| Feature | Function | Output |
|---|---|---|
| Repair sentiment analysis | `analyse_repair_sentiment(notes, complaint?)` | `{sentiment, confidence, summary, flags[]}` |
| Audit log summarisation | `summarise_audit_logs(entries[])` | Manager-readable paragraph |
| Repair fault advice | `get_repair_advice(device_model, fault)` | `{likely_causes[], recommended_parts[], estimated_difficulty, notes}` |

Graceful degradation: if Ollama is unreachable, returns `{"available": false}` stub.

**docker-compose.yml addition:**
```yaml
  ollama:
    image: ollama/ollama
    container_name: techmo-ollama
    ports: ["11434:11434"]
    volumes: ["ollama-models:/root/.ollama"]
    networks: [techmo-net]
    restart: unless-stopped
```

**One-time setup:** `docker exec techmo-ollama ollama pull llama3`

**New env vars:** `OLLAMA_BASE_URL=http://ollama:11434`, `OLLAMA_MODEL=llama3`

---

#### 💰 Competitor Price Intelligence (n8n + Browserless)
**File:** `automation/n8n-workflows/competitor-price-scraping.json`

8-node n8n workflow: **Schedule (Mon 07:00) → Browserless scrape → price parse → compare vs
TechMo prices → flag >10% overpriced / >15% underpriced → Email + Telegram alerts**.

**New env vars:** `N8N_INTERNAL_API_TOKEN`, `MANAGER_EMAIL`, `MANAGER_TELEGRAM_CHAT_ID`

---

### 15.3 CUSTOMER EXPERIENCE & TRUST

---

#### 🖥️ Self-Service Kiosk Mode
**File:** `apps/admin/src/app/(authenticated)/kiosk/page.tsx`  **Route:** `/kiosk`

Full-screen tablet page for storefront self-service. Customers check in devices and track
repairs without staff intervention.

**Screen states:** `welcome → checkin-phone → checkin-device → checkin-confirm → checkin-done → track-input → track-result`

**Key features:**
- `NumPad` component — 3×4 touch grid for phone number + PIN
- Triple-tap TechMo logo within 1 s → manager exit PIN prompt
- 60-second inactivity auto-reset to welcome screen
- `POST /api/v1/repairs/kiosk-checkin` — new device intake
- `GET /api/v1/repairs/public/track?ref=` — repair status lookup with 5-step stepper

---

#### 🎨 Visual Damage Markup Tool
**File:** `apps/admin/src/components/DamageMarkup.tsx`

Canvas annotation tool for marking pre-existing damage on device photos at intake.
Creates timestamped visual evidence protecting against "you damaged my phone" disputes.

**Tools:** `pen`, `rect`, `circle`, `text` | **Colours:** Red, Amber, Blue, Green, White
**Undo stack:** 30 steps via `ImageData` snapshots | **Architecture:** Dual-canvas (prevents draw flicker)

**Props:** `imageUrl: string`, `onExport(dataUrl: string)`, `width?`, `height?`

---

#### �� Post-Repair Video Capture
**Files:**
- `apps/admin/src/components/RepairVideoCapture.tsx`
- `services/worker-service/app/video.py`

10-second "proof of function" video — technician demonstrates repaired device before handback.

**Phase state machine:** `idle → preview → recording → review → uploading → done | error`

**Tech:** `MediaRecorder` API (`video/webm;codecs=vp9,opus`) → 10 s hard limit → local review
→ `POST /api/v1/worker/upload-repair-video` (multipart) → Cloudinary transcodes WebM → MP4
→ stored at `techmo/repair-videos/{ticketRef}.mp4`

**Props:** `ticketRef: string`, `existingVideoUrl?: string`, `onUploaded(url: string)`

---

### 15.4 ENHANCED SECURITY & COMPLIANCE

---

#### 🔐 WebAuthn / Passkeys
**Files:**
- `services/gateway/src/auth/webauthn.service.ts`
- `apps/admin/src/components/PasskeyManager.tsx`

Managers authenticate with **device biometrics** (Touch ID / Face ID / Windows Hello) instead
of typing a PIN. Passkeys are phishing-resistant — private keys never leave the device.

**Libraries:** `@simplewebauthn/server` (gateway) + browser-native `navigator.credentials` (admin)

**Registration flow:**
1. `POST /auth/webauthn/register/options` → challenge in Redis (TTL 5 min)
2. Browser: `navigator.credentials.create({ publicKey })` → biometric prompt
3. `POST /auth/webauthn/register/verify` → attestation verified → credential saved

**Authentication flow:**
1. `POST /auth/webauthn/login/options` → challenge in Redis
2. Browser: `navigator.credentials.get({ publicKey })` → assertion
3. `POST /auth/webauthn/login/verify` → assertion verified → JWT issued

**New DB table:** `passkey_credentials (id, user_id, credential_id UNIQUE, public_key, counter, device_type, transports[], created_at)`

**New env vars:**
```
WEBAUTHN_RP_ID=admin.techmo.lk
WEBAUTHN_RP_NAME=TechMo
WEBAUTHN_ORIGIN=https://admin.techmo.lk
```

---

#### 🕵️ PII Masking in Audit Logs
**Files:**
- `services/gateway/src/util/pii-mask.ts`
- `services/gateway/src/util/audit-log.interceptor.ts`

Automatically redacts PII from all Loki audit entries. Masking is partial (middle chars replaced)
to preserve debugging context without exposing customer data.

**Masked types:**

| Type | Input | Output |
|---|---|---|
| Phone | `+94771234567` | `+9477****567` |
| Email | `saman@gmail.com` | `sam***@gmail.com` |
| IMEI | `358320089522184` | `35832*****22184` |
| NIC (old) | `972812345V` | `9728*****V` |
| NIC (new) | `200012345678` | `2000****5678` |
| Credit card | `4532 1234 5678 9012` | `4532 **** **** 9012` |

**Key exports:** `maskPii(str)`, `maskObject(obj)`, `detectPiiTypes(str)`

**Interceptor:** Registered as `APP_INTERCEPTOR`. Auth paths (`/auth/login`, `/auth/refresh`,
`/auth/webauthn/**`) log `[REDACTED]` body — passwords and challenges are never logged.

---

#### 🛡️ Cloudflare WAF IP Whitelist
**File:** `cloudflare/waf-rules.yml`

Four-tier WAF rule set restricting admin panel and API to the shop's static IP.

| Priority | Rule ID | Action | Scope |
|---|---|---|---|
| 1 | `POS-ADMIN-IP-WHITELIST` | Block | `/admin*` or `/api/v1*` from IPs outside whitelist |
| 2 | `LOGIN-RATE-LIMIT` | Managed Challenge | `POST /api/v1/auth/login` > 10 req/min/IP |
| 3 | `CF-MANAGED-OWASP` | Block | Cloudflare Managed Ruleset (SQLi, XSS, RCE) |
| 4 | `GEO-BLOCK-ADMIN-NON-LK` | Block (disabled) | `/admin*` from non-LK countries |

**New env vars:** `SHOP_STATIC_IP`, `VPN_CIDR`, `CF_ACCOUNT_ID`, `CF_ZONE_ID`, `CF_API_TOKEN`

---

### 15.5 LOGISTICS & MULTI-LOCATION

---

#### 🏪 Internal Branch Transfer Marketplace
**Files:**
- `services/inventory-service/src/transfers/transfers.module.ts`
- `services/inventory-service/src/transfers/transfers.service.ts`
- `services/inventory-service/src/transfers/transfers.controller.ts`
- `apps/admin/src/app/(authenticated)/inventory/transfers/page.tsx`
- `automation/n8n-workflows/branch-transfer-whatsapp.json`

Branch managers request stock from other branches. Requests flow through an approval workflow
with automatic WhatsApp + Telegram notifications to the source branch manager.

**Status lifecycle:** `REQUESTED → APPROVED → IN_TRANSIT → COMPLETED` (or `REJECTED` / `CANCELLED`)

**New Prisma model (inventory-service):**
```prisma
model InventoryTransfer {
  id           String         @id @default(cuid())
  fromBranchId String
  toBranchId   String
  productId    String
  productName  String
  qty          Int
  status       TransferStatus @default(REQUESTED)
  requestedBy  String
  approvedBy   String?
  notes        String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  completedAt  DateTime?
}

enum TransferStatus { REQUESTED  APPROVED  REJECTED  IN_TRANSIT  COMPLETED  CANCELLED }
```

**REST endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/inventory/transfers` | Create transfer request |
| `GET` | `/inventory/transfers?branchId=&status=` | List transfers |
| `GET` | `/inventory/transfers/stats?branchId=` | Counts per status |
| `PATCH` | `/inventory/transfers/:id/approve` | Manager approves |
| `PATCH` | `/inventory/transfers/:id/reject` | Reject with reason |
| `PATCH` | `/inventory/transfers/:id/transit` | Mark items dispatched |
| `PATCH` | `/inventory/transfers/:id/complete` | Confirm receipt → Prisma `$transaction` adjusts inventory |
| `DELETE` | `/inventory/transfers/:id` | Requester cancels |

**n8n WhatsApp workflow:** Webhook receives transfer events → Meta WhatsApp Cloud API (free:
1000 msgs/month) → falls back to Telegram if no phone configured.

**New env vars:**
```
N8N_TRANSFER_WEBHOOK_URL=http://n8n:5678/webhook/transfer-requested
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/PHONE_NUMBER_ID
WHATSAPP_API_TOKEN=
DEFAULT_MANAGER_WHATSAPP=
```

---

#### 🚚 Courier Tracking Integration
**Files:**
- `services/repair-service/src/repairs/courier-tracking.service.ts`
- `apps/admin/src/components/CourierTracking.tsx`

Multi-carrier shipment tracking within the Admin repair view. In-memory cache (30 min TTL).

**Supported carriers:**

| Carrier | API | Key required |
|---|---|---|
| DHL Express | `api-test.dhl.com/track/shipments` | Optional |
| 17TRACK | `api.17track.net/v2.2` | Free tier — 100 req/day, 1200+ carriers |
| Sri Lanka Post | No public API — links to `slpost.lk/tracking/` | — |

**Prisma additions (repair-service RepairTicket model):**
```
courierTrackingNumber  String?
courierCarrier         String?   // 'dhl' | 'slpost' | '17track'
courierStatus          String?
courierUpdatedAt       DateTime?
```

**Admin UI:** Status badge (IN_TRANSIT=blue, DELIVERED=green, EXCEPTION=red) + expandable
event timeline + carrier website link + manual refresh button.

**New env vars:** `DHL_API_KEY` (optional), `TRACK17_API_KEY` (free at 17track.net)

---

## 16. UPDATED DATABASE TABLES (PHASE 2)

### `battery_stock_entries` (inventory-service DB)
```
id, inventory_id FK, manufactured_at, shelf_life_days (default 730),
alert_fraction_pct (default 80), batch_number, rated_capacity_mah, notes, created_at
```

### `battery_alerts` (inventory-service DB)
```
id, entry_id FK, alert_type ENUM(APPROACHING_SHELF_LIMIT | SHELF_LIMIT_EXCEEDED | CRITICAL_AGE),
days_on_shelf, acknowledged_at, acknowledged_by, created_at
```

### `passkey_credentials` (auth-service DB)
```
id, user_id, credential_id UNIQUE (base64url), public_key (COSE base64url),
counter INT, device_type, transports TEXT[], created_at
```

### `inventory_transfers` (inventory-service DB)
```
id, from_branch_id, to_branch_id, product_id, product_name, qty,
status ENUM(REQUESTED | APPROVED | REJECTED | IN_TRANSIT | COMPLETED | CANCELLED),
requested_by, approved_by, notes, created_at, updated_at, completed_at
```

### `repair_tickets` additions (repair-service DB)
```
courier_tracking_number TEXT, courier_carrier TEXT,
courier_status TEXT, courier_updated_at TIMESTAMPTZ
```

---

## 17. DOCKER COMPOSE — PHASE 2 ADDITIONS

| Service | Container | Port | Purpose |
|---|---|---|---|
| `ollama` | `techmo-ollama` | `11434` | Local LLM (llama3 / mistral / phi3) |

```yaml
  ollama:
    image: ollama/ollama
    container_name: techmo-ollama
    ports: ["11434:11434"]
    volumes: ["ollama-models:/root/.ollama"]
    networks: [techmo-net]
    restart: unless-stopped
```

One-time model pull after first start:
```bash
docker exec techmo-ollama ollama pull llama3
```

---

## 18. ENVIRONMENT VARIABLES — PHASE 2 ADDITIONS

### `services/worker-service/.env`
```
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3
```

### `services/gateway/.env`
```
WEBAUTHN_RP_ID=admin.techmo.lk
WEBAUTHN_RP_NAME=TechMo
WEBAUTHN_ORIGIN=https://admin.techmo.lk
N8N_INTERNAL_API_TOKEN=
```

### `services/repair-service/.env`
```
DHL_API_KEY=
TRACK17_API_KEY=
```

### Root `.env` — n8n additions
```
N8N_TRANSFER_WEBHOOK_URL=http://n8n:5678/webhook/transfer-requested
MANAGER_EMAIL=
MANAGER_TELEGRAM_CHAT_ID=
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/PHONE_NUMBER_ID
WHATSAPP_API_TOKEN=
DEFAULT_MANAGER_WHATSAPP=
```

### `.env.production` — Cloudflare WAF
```
SHOP_STATIC_IP=
VPN_CIDR=
CF_ACCOUNT_ID=
CF_ZONE_ID=
CF_API_TOKEN=
```

---

## 19. ADMIN APP ROUTES — PHASE 2 ADDITIONS

| Route | File | Description |
|---|---|---|
| `/kiosk` | `app/(authenticated)/kiosk/page.tsx` | Self-service customer kiosk (tablet full-screen) |
| `/inventory/transfers` | `app/(authenticated)/inventory/transfers/page.tsx` | Branch transfer marketplace |

---

## 20. TECHNOLOGY STACK — PHASE 2 ADDITIONS

| Technology | Purpose | Cost |
|---|---|---|
| **Barcode Detection API** | Browser-native barcode/QR scanning (no library) | Free |
| **Tesseract.js** | Client-side OCR — IMEI stickers, NIC documents | Free (WASM, MIT) |
| **Ollama** | Local LLM server — llama3 / mistral / phi3 | Free (Apache 2.0) |
| **@simplewebauthn/server** | FIDO2/WebAuthn passkeys in NestJS gateway | Free (MIT) |
| **17TRACK API** | Courier tracking — 1200+ carriers | Free tier (100 req/day) |
| **DHL Track API** | DHL Express shipment tracking | Free tier |
| **Meta WhatsApp Cloud API** | Branch transfer WhatsApp notifications via n8n | Free (1000 msg/month) |
| **Browserless** | Headless Chrome for competitor price scraping | Free self-hosted |
| **Web Audio API** | Barcode scan beep feedback | Free (browser built-in) |
| **MediaRecorder API** | 10-second repair proof video recording | Free (browser built-in) |
| **Canvas 2D API** | Damage markup annotations with undo stack | Free (browser built-in) |

---

## 21. PHASE 3 — EDGE INTELLIGENCE, HARDWARE BRIDGE & OPERATIONS

> **Phase 3** builds on the foundations of Phase 1 (core platform) and Phase 2 (PWA hardware
> + zero-cost AI). All Phase 3 features are zero-additional-cost and leverage browser APIs,
> existing infrastructure (PostgreSQL, Redis, n8n, Grafana), and the Astro marketing site.

---

### 21.1 Offline-First Stocktake Mode

**Problem:** A Wi-Fi outage mid-stocktake means staff must restart the count. USB barcode guns
lose scans silently.

**Solution:** Every scan is written to **IndexedDB (Dexie.js)** first, then bulk-synced when
connectivity is restored.

#### Files
| File | Purpose |
|---|---|
| `apps/admin/src/lib/stocktake-db.ts` | Dexie.js schema — `sessions` + `scans` tables |
| `apps/admin/src/components/StocktakeScanner.tsx` | Camera-based scanner UI with offline log |
| `apps/admin/src/app/(authenticated)/inventory/stocktake/page.tsx` | Route `/inventory/stocktake` |
| `services/inventory-service/prisma/schema.prisma` | `StocktakeSession` + `StocktakeScan` + `StocktakeStatus` + `ScanStatus` models |

#### Architecture

```
Camera feed (BarcodeDetector API)
    │  every scan
    ▼
IndexedDB (Dexie.js)          ← works fully offline
    │  on Wi-Fi restored (or manual "Sync Now")
    ▼
POST /api/v1/inventory/stocktake/bulk-sync
    │
    ▼
inventory-service → PostgreSQL  stocktake_sessions / stocktake_scans
```

#### Key Code — `stocktake-db.ts`
```ts
export class StocktakeDB extends Dexie {
  scans!: Table<StocktakeScan>;
  sessions!: Table<StocktakeSession>;

  constructor() {
    super('techmo_stocktake');
    this.version(1).stores({
      scans:    '++id, sessionId, sku, status, scannedAt',
      sessions: 'id, branchId, staffId, status',
    });
  }
}

export async function bulkSyncSession(sessionId: string): Promise<void> {
  const pending = await db.scans.where({ sessionId, status: 'pending' }).toArray();
  await api.post('/inventory/stocktake/bulk-sync', { sessionId, scans: pending });
  await db.scans.where({ sessionId, status: 'pending' }).modify({ status: 'synced' });
}
```

#### Prisma Models (inventory-service)
```prisma
model StocktakeSession {
  id        String          @id @default(uuid())
  branchId  String
  staffId   String
  status    StocktakeStatus @default(IN_PROGRESS)
  startedAt DateTime        @default(now())
  syncedAt  DateTime?
  scans     StocktakeScan[]
  @@map("stocktake_sessions")
}

model StocktakeScan {
  id         String           @id @default(uuid())
  sessionId  String
  session    StocktakeSession @relation(fields: [sessionId], references: [id])
  sku        String
  scannedQty Int              @default(1)
  systemQty  Int?
  status     ScanStatus       @default(PENDING)
  scannedAt  DateTime
  @@map("stocktake_scans")
}
```

---

### 21.2 Client-Side Image Compression (Canvas API)

**Problem:** Cloudinary's free tier is 25 GB. Staff uploading 12 MP photos of damaged phones
wastes quota and slows uploads.

**Solution:** Compress images client-side to ≤1200 px before uploading to Cloudinary — no
external library, no server round-trip, no cost.

#### File
`apps/admin/src/lib/wasm-compress.ts`

#### Key Code
```ts
export async function compressImage(
  source: File | Blob | ImageBitmapSource,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const { maxDimension = 1200, quality = 0.82, outputType = 'image/jpeg' } = options;
  const bitmap = await createImageBitmap(source as Blob);
  // Scale maintaining aspect ratio
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale)
  );
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: outputType, quality });
  return { blob, compressionRatio: (source as File).size / blob.size };
}
```

#### Usage
```ts
const { blob, compressionRatio } = await compressImage(file);
// compressionRatio: typically 4-8× on smartphone photos
const compressed = new File([blob], file.name, { type: 'image/jpeg' });
await uploadToCloudinary(compressed);
```

---

### 21.3 On-Device Fraud Detection

**Problem:** A staff member's login credentials being stolen on a different device could go
unnoticed for days.

**Solution:** Canvas fingerprinting + Client Hints API builds a device signature. If a
sensitive action (refund, price override) is performed from an **unknown device**, an n8n
webhook fires a Telegram alert instantly.

#### File
`apps/admin/src/lib/device-fingerprint.ts`

#### How It Works
1. `buildFingerprint()` — draws a canvas string with stack-specific subpixel rendering,
   reads `navigator.userAgentData.getHighEntropyValues()`, hashes with `djb2`
2. `registerDeviceOnLogin()` — stores fingerprint in `localStorage` (`techmo_known_devices`,
   capped at 20 entries)
3. `checkDeviceBeforeAction(actionLabel, staffId, webhookUrl)` — if fingerprint is not in the
   known list, POSTs to n8n webhook

#### n8n Webhook Payload
```json
{
  "event": "UNKNOWN_DEVICE_SENSITIVE_ACTION",
  "staffId": "usr_abc123",
  "action": "ISSUE_REFUND",
  "fingerprint": "a3f92bc1",
  "userAgent": "Mozilla/5.0 ...",
  "platform": "Linux x86_64",
  "timestamp": "2026-02-25T14:23:11.000Z"
}
```

#### New Env Vars
```env
# apps/admin/.env.local
NEXT_PUBLIC_N8N_FRAUD_WEBHOOK_URL=http://n8n:5678/webhook/unknown-device-action
```

---

### 21.4 Web Serial API — Legacy Hardware Bridge

**Problem:** Workshop bench has USB digital scales and battery capacity testers with COM-port
output. Previously required a Windows-only application.

**Solution:** `SerialPortReader.tsx` — a browser-native Web Serial API component that reads
any COM-port device and parses common scale/tester output formats.

#### File
`apps/admin/src/components/SerialPortReader.tsx`

#### Features
- `baudRate` prop (default 9600) — configurable per device
- `LineBreakTransformer` TransformStream — splits continuous COM output into lines
- `tryParseWeight()` — parses: `123.45g`, `1.23kg`, `ST,+000123.4g`, `US,+000123g`
- `onWeight(grams)` callback — structured numeric weight for POS/repair forms
- `onData(line)` callback — raw line for battery tester or custom parsers
- Graceful `isSupported` fallback for Firefox/Safari

#### Usage in Repair Form
```tsx
<SerialPortReader
  deviceLabel="Battery Tester"
  baudRate={9600}
  onWeight={grams => setRepairForm(f => ({ ...f, batteryCapacity: grams }))}
/>
```

> **Browser Support:** Chrome 89+, Edge 89+. Requires HTTPS or localhost.

---

### 21.5 Web Bluetooth BLE Proximity Radar

**Problem:** Finding a specific part in a large warehouse bin requires physically walking
through every shelf. Parts have BLE beacon tags.

**Solution:** `BleProximityRadar.tsx` — Web Bluetooth `watchAdvertisements()` tracks RSSI
of nearby beacons in real time, converts to estimated distance, and renders a live radar.

#### File
`apps/admin/src/components/BleProximityRadar.tsx`

#### Key Details
- RSSI → Distance: path-loss model `d = 10^((txPower − rssi) / (10 × n))` where n=2
- Distance labels: `< 1 m` (🟢), `1–3 m` (🟡), `3–10 m` (🔴), `> 10 m` (⚫)
- `binMap` prop: `{ 'BLE-PART-001': 'Shelf A3 · Bin 12' }` — maps beacon names to bin labels
- Auto-prunes beacons not seen for 30 seconds
- `device.watchAdvertisements()` fires RSSI update on each advertisement packet (~1 Hz)
- Graceful fallback for non-Bluetooth browsers

#### Usage
```tsx
<BleProximityRadar
  targetName="BLE-PART-001"
  binMap={{ 'BLE-PART-001': 'Shelf A3 · Bin 12' }}
/>
```

> **Browser Support:** Chrome 56+. Requires HTTPS. Experimental on Android.

---

### 21.6 Native Share API — WhatsApp PDF Sharing

**Problem:** Staff had to screenshot repair receipts to share on WhatsApp. No traceability,
poor quality.

**Solution:** `native-share.ts` — 4-tier fallback share utility:
1. **Native file share** — `navigator.share({ files: [pdfBlob] })` — triggers native share
   sheet on Android/iOS with the PDF as an attachment
2. **Native URL share** — `navigator.share({ url })` — shares the Cloudinary PDF link
3. **Clipboard copy** — copies the URL to clipboard
4. **Browser download** — `<a download>` fallback

#### File
`apps/admin/src/lib/native-share.ts`

#### Key Functions
```ts
// Share a repair receipt PDF
await shareRepairReceipt({
  ticketNumber: 'REP-2026-00142',
  customerName: 'Kavindi Perera',
  pdfUrl: 'https://res.cloudinary.com/.../repair_REP-2026-00142.pdf',
});

// Instant WhatsApp text link (no share sheet, opens wa.me directly)
shareViaWhatsApp({
  phoneNumber: '94771234567',
  ticketNumber: 'REP-2026-00142',
  customerName: 'Kavindi Perera',
  statusUrl: 'https://techmoelectronics.lk/track/REP-2026-00142',
});
```

---

### 21.7 Ghost Inventory Reconciler (n8n)

**Problem:** When a product is deleted from PostgreSQL directly (e.g. via a migration mistake),
its Meilisearch index entry remains — causing "ghost" search results for items that don't exist.

**Solution:** Nightly n8n workflow compares the Meilisearch index against PostgreSQL and
auto-deletes ghost SKUs.

#### File
`automation/n8n-workflows/ghost-inventory-reconciler.json`

#### Workflow (8 nodes)
```
Cron: 02:00 daily
    │
    ├─ HTTP: POST {meilisearch}/indexes/products/search (limit 5000) → Set of Meilisearch SKUs
    └─ HTTP: GET /api/v1/inventory (all active SKUs)    → Set of PostgreSQL SKUs
                │
            Code node: ghostSkus = meiliSet.difference(pgSet)
                │
        ┌── If: ghosts.length > 0
        │       │
        │   HTTP: DELETE {meilisearch}/indexes/products/documents (batch delete ghost IDs)
        │       │
        │   Telegram: "⚠ Ghost Inventory: removed {n} ghost SKUs: ..."
        │
        └── Telegram: "✅ Ghost Reconciler: index is clean (n SKUs match)"
```

#### Required Env
```
MEILISEARCH_API_KEY=...
MANAGER_TELEGRAM_CHAT_ID=...
```

---

### 21.8 Crowdsourced Compatibility Wiki

**Problem:** Compatibility notes are written by one person and may be wrong. New phone models
appear every month; compatibility is discovered through testing.

**Solution:** Staff can up/downvote any `PartCompatibility` record. Votes drive a `confidence`
score (`high` / `medium` / `low` / `disputed`).

#### Files
| File | Purpose |
|---|---|
| `services/product-service/src/compatibility/compatibility-votes.service.ts` | Vote toggle logic, tally, confidence |
| `services/product-service/src/compatibility/compatibility-votes.controller.ts` | REST endpoints |
| `services/product-service/prisma/schema.prisma` | `CompatibilityVote` model + `CompatibilityVoteType` enum |

#### REST API
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/compatibility/:id/vote` | Cast or toggle vote `{ staffId, vote: "UP"\|"DOWN", notes? }` |
| `GET`  | `/compatibility/:id/tally` | `{ upVotes, downVotes, score, confidence }` |
| `GET`  | `/compatibility/product/:productId/tallies` | All tallies for a product |
| `GET`  | `/compatibility/:id/my-vote?staffId=` | Fetch current staff vote |
| `GET`  | `/compatibility/contributors/top` | Top 10 contributors leaderboard |

#### Confidence Logic
| Score | Confidence |
|---|---|
| ≥ 5 | `high` |
| ≥ 2 | `medium` |
| ≥ 0 | `low` |
| < 0 | `disputed` |

#### Prisma Model
```prisma
model CompatibilityVote {
  id              String            @id @default(uuid())
  compatibilityId String
  compatibility   PartCompatibility @relation(...)
  staffId         String
  vote            CompatibilityVoteType   // UP | DOWN
  notes           String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@unique([compatibilityId, staffId])
  @@map("compatibility_votes")
}
```

---

### 21.9 JIT Lead Time Calculator

**Problem:** "When will this supplier deliver?" is guesswork. Staff over-order to compensate,
tying up cash in slow-moving stock.

**Solution:** Raw SQL window functions on `stock_movements` calculate per-supplier median
lead time, P90, trend, and a human-readable POS warning.

#### Files
| File | Purpose |
|---|---|
| `services/inventory-service/src/inventory/jit-lead-time.service.ts` | SQL analysis service |
| `services/inventory-service/src/inventory/jit-lead-time.controller.ts` | REST endpoints |

#### REST API
| Endpoint | Description |
|---|---|
| `GET /inventory/lead-times` | All suppliers with lead time stats |
| `GET /inventory/lead-times/slowest` | Top 5 slowest suppliers |
| `GET /inventory/lead-times/pos-warning?supplierId=` | Human-readable warning string for POS |

#### Response Shape
```json
{
  "supplierId": "sup_abc",
  "supplierName": "Colombo Parts Ltd",
  "avgLeadTimeDays": 4.2,
  "medianLeadTimeDays": 3.5,
  "p90LeadTimeDays": 7.0,
  "isRunningLate": false,
  "trendDays": -0.8,
  "warning": null,
  "lastOrderDate": "2026-02-20T00:00:00.000Z"
}
```

#### SQL Technique
Uses PostgreSQL `PERCENTILE_CONT(0.5)` and `LEAD()` window function to pair
`PURCHASE_ORDER` + `STOCK_IN` movement pairs chronologically per supplier:

```sql
WITH paired AS (
  SELECT
    sm_po.reference AS supplier_id,
    EXTRACT(EPOCH FROM (sm_in.created_at - sm_po.created_at)) / 86400 AS lead_days
  FROM stock_movements sm_po
  JOIN LATERAL (
    SELECT created_at FROM stock_movements
    WHERE reference = sm_po.reference
      AND movement_type = 'STOCK_IN'
      AND created_at > sm_po.created_at
    ORDER BY created_at LIMIT 1
  ) sm_in ON true
  WHERE sm_po.movement_type = 'PURCHASE_ORDER'
)
SELECT
  supplier_id,
  AVG(lead_days)::numeric(5,1)                                 AS avg_lead_time_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lead_days)::numeric(5,1) AS median_lead_time_days,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY lead_days)::numeric(5,1) AS p90_lead_time_days
FROM paired
GROUP BY supplier_id
```

---

### 21.10 Repair Leaderboard — Grafana Dashboard

**Problem:** Technician performance is invisible. Top performers are not recognised;
under-performers are not coached.

**Solution:** Grafana dashboard provisioned at startup — 4 panels for breakroom TV display.

#### File
`infra/grafana/provisioning/dashboards/repair-leaderboard.json`

#### Dashboard Panels
| Panel | Type | Period | Metric |
|---|---|---|---|
| Top 5 Success Rate | Bar gauge | 90 days | `completed` repairs with no re-open within 14 days |
| Fastest Turnaround | Bar gauge | 30 days | Average `completed_at - created_at` in minutes |
| Daily Repairs by Tech | Time-series line chart | 14 days | COUNT per technician per day |
| Full Technician Scorecard | Table | 30 days | All technicians — repairs, success rate, avg turnaround |

#### Config
- **uid:** `techmo-repair-leaderboard`
- **Datasource:** `techmo-postgres`
- **Refresh:** 5 minutes
- **Timezone:** `Asia/Colombo`

#### SQL (Success Rate Panel)
```sql
SELECT
  r.assigned_to                                                           AS technician,
  COUNT(*)                                                                AS total,
  SUM(CASE WHEN r2.id IS NULL THEN 1 ELSE 0 END)                         AS successes,
  ROUND(
    100.0 * SUM(CASE WHEN r2.id IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1
  )                                                                       AS success_rate
FROM repairs r
LEFT JOIN repairs r2
  ON r2.customer_phone = r.customer_phone
 AND r2.device         = r.device
 AND r2.created_at > r.completed_at
 AND r2.created_at < r.completed_at + INTERVAL '14 days'
WHERE r.status = 'COMPLETED'
  AND r.completed_at >= NOW() - INTERVAL '90 days'
GROUP BY r.assigned_to
ORDER BY success_rate DESC
LIMIT 5
```

---

### 21.11 End-of-Day PDF (n8n Workflow + Worker Service)

**Problem:** Branch managers receive no nightly summary. Issues (low revenue, high battery
alerts) are only noticed the next morning.

**Solution:** n8n workflow at 21:00 pulls 4 PostgreSQL queries, generates a branded PDF via
the worker service, and sends it to a Telegram channel with a download button.

#### Files
| File | Purpose |
|---|---|
| `automation/n8n-workflows/end-of-day-pdf.json` | n8n workflow definition |
| `services/worker-service/app/routers/pdf.py` | New `POST /daily-pulse-pdf` endpoint |
| `services/worker-service/app/services/pdf_service.py` | `generate_daily_pulse_pdf()` function |
| `services/worker-service/templates/daily_pulse.html` | Branded Jinja2 HTML → WeasyPrint PDF |

#### Workflow (n8n)
```
Cron: 21:00 daily
    │
    ├─ PostgreSQL: Today's total sales + transactions
    ├─ PostgreSQL: Today's completed repairs count
    ├─ PostgreSQL: Top 5 products by revenue today
    └─ PostgreSQL: Battery alerts count
            │
        Code: Build reportData JSON
            │
        HTTP POST: worker-service:8000/api/v1/worker/daily-pulse-pdf
            │  returns { pdfUrl }
            │
        Telegram: message + inline "📄 Download PDF" button
```

#### Worker Endpoint
```
POST /api/v1/worker/daily-pulse-pdf
{
  "date": "2026-02-25",
  "total_sales": 485000,
  "total_transactions": 42,
  "total_repairs_completed": 18,
  "top_products": [{ "name": "iPhone 16 Pro", "qty": 3, "revenue": 360000 }],
  "battery_alerts": 2,
  "branch": "Colombo 03"
}
→ { "filename": "daily_pulse_2026-02-25.pdf", "url": "https://res.cloudinary.com/...", "public_id": "..." }
```

---

### 21.12 In-App Knowledge Base (Astro)

**Problem:** Technicians Google repair guides, land on low-quality YouTube videos, or ask
senior techs repeatedly for the same information.

**Solution:** Astro content collections host curated Markdown repair guides. Guides are
published at `techmoelectronics.lk/guides/[slug]` and can be searched from the admin dashboard.

#### Files
| File | Purpose |
|---|---|
| `apps/marketing/src/content/config.ts` | Astro content collection schema (zod) |
| `apps/marketing/src/content/guides/*.md` | Repair guide Markdown files |
| `apps/marketing/src/pages/guides/index.astro` | Searchable guide list with difficulty filters |
| `apps/marketing/src/pages/guides/[slug].astro` | Individual guide page with tools/parts sidebar |
| `apps/marketing/src/pages/api/guides.json.ts` | Static JSON manifest endpoint for admin search |
| `apps/admin/src/lib/knowledge-base-search.ts` | Admin search integration (fetches JSON manifest) |

#### Included Guides (v1)
| Guide | Device | Difficulty |
|---|---|---|
| iPhone 16 Screen Replacement | iPhone 16 / 16 Plus | Intermediate |
| Samsung Galaxy Battery Replacement | Galaxy S22/S23/S24 | Beginner |
| Emergency Water Damage Treatment | All smartphones | Beginner |
| iPhone Charging Port Repair | iPhone 13/14/15 | Advanced |

#### Content Schema (`config.ts`)
```ts
const guides = defineCollection({
  type: 'content',
  schema: z.object({
    title:         z.string(),
    device:        z.string(),
    difficulty:    z.enum(['Beginner', 'Intermediate', 'Advanced']),
    estimatedTime: z.string(),
    tools:         z.array(z.string()),
    parts:         z.array(z.object({ sku: z.string(), name: z.string() })).default([]),
    warnings:      z.array(z.string()).default([]),
    updatedAt:     z.string(),
    author:        z.string(),
  }),
});
```

#### Admin Search Integration
```ts
// In admin global search bar
import { searchKnowledgeBase } from '@/lib/knowledge-base-search';

const results = await searchKnowledgeBase('iphone battery');
// → [{ title, slug, device, difficulty, estimatedTime, url }]
```

The admin dashboard fetches from `NEXT_PUBLIC_MARKETING_URL/api/guides.json` (cached 1 hour,
ISR). Guides open in a new tab at `techmoelectronics.lk/guides/[slug]`.

#### Guide Page Features
- **Warning banner** — red callout block for safety warnings at the top of each guide
- **Tools sidebar** — complete tool list
- **Parts sidebar** — links to SKUs with a "Book This Repair" CTA button
- **Difficulty badge** — colour-coded (green/yellow/red)
- **Breadcrumb navigation** — Home → Knowledge Base → Guide title
- **SEO** — unique `<title>` + `<meta description>` per guide via `Layout.astro`

---

### 21.13 Phase 3 — Admin Routes

| Route | File | Description |
|---|---|---|
| `/inventory/stocktake` | `app/(authenticated)/inventory/stocktake/page.tsx` | Offline-first barcode stocktake with IndexedDB sync |

---

### 21.14 Phase 3 — Technology Stack

| Technology | Purpose | Cost |
|---|---|---|
| **Dexie.js v3** | IndexedDB ORM — offline stocktake sessions | Free (Apache 2.0) |
| **OffscreenCanvas API** | Client-side image compression in worker thread | Free (browser built-in) |
| **Client Hints API** (`getHighEntropyValues`) | Device fingerprinting for fraud detection | Free (browser built-in) |
| **Web Serial API** | USB/COM-port hardware bridge (scales, battery testers) | Free (browser built-in, Chrome 89+) |
| **Web Bluetooth API** | BLE beacon proximity radar for warehouse bin finding | Free (browser built-in, Chrome 56+) |
| **Web Share API** | Native file share sheet for repair PDF → WhatsApp | Free (browser built-in) |
| **Astro Content Collections** | Type-safe Markdown knowledge base | Free (Astro 4, MIT) |
| **WeasyPrint** | Python HTML → PDF for daily pulse report | Free (LGPL) |
| **PostgreSQL `PERCENTILE_CONT`** | JIT lead time median/P90 calculation | Free (built-in) |

---

### 21.15 Phase 3 — New Env Variables

```env
# apps/admin/.env.local
NEXT_PUBLIC_N8N_FRAUD_WEBHOOK_URL=http://n8n:5678/webhook/unknown-device-action
NEXT_PUBLIC_MARKETING_URL=https://techmoelectronics.lk

# apps/marketing/.env (Astro)
SITE_URL=https://techmoelectronics.lk

# n8n workflow env (set in n8n UI → Settings → Environment Variables)
MEILISEARCH_API_KEY=<your-master-key>
MANAGER_TELEGRAM_CHAT_ID=<chat-id>
```

---

### 21.16 Phase 3 — Database Migrations Required

```bash
# inventory-service (add stocktake tables)
cd services/inventory-service
npx prisma migrate dev --name phase3_stocktake_tables

# product-service (add compatibility_votes table + CompatibilityVoteType enum)
cd services/product-service
npx prisma migrate dev --name phase3_compatibility_votes
```

---

### 21.17 Phase 3 — Feature Summary

| # | Feature | Category | Key Files |
|---|---|---|---|
| 1 | Offline-First Stocktake Mode | Edge Inventory | `stocktake-db.ts`, `StocktakeScanner.tsx` |
| 2 | Client-Side Image Compression | Edge Inventory | `wasm-compress.ts` |
| 3 | On-Device Fraud Detection | Edge Inventory | `device-fingerprint.ts` |
| 4 | Web Serial API Bridge | Hardware | `SerialPortReader.tsx` |
| 5 | BLE Proximity Radar | Hardware | `BleProximityRadar.tsx` |
| 6 | Native Share API (PDF → WhatsApp) | Hardware | `native-share.ts` |
| 7 | Ghost Inventory Reconciler | Operations | `ghost-inventory-reconciler.json` |
| 8 | Crowdsourced Compatibility Wiki | Operations | `compatibility-votes.service.ts` |
| 9 | JIT Lead Time Calculator | Operations | `jit-lead-time.service.ts` |
| 10 | Repair Leaderboard (Grafana) | Productivity | `repair-leaderboard.json` |
| 11 | End-of-Day PDF (n8n + Worker) | Productivity | `end-of-day-pdf.json`, `daily_pulse.html` |
| 12 | In-App Knowledge Base (Astro) | Productivity | `guides/*.md`, `pages/guides/` |
