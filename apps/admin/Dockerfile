# ── builder ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm config set fetch-retry-maxtimeout 300000 && \
    npm config set fetch-retries 5 && \
    npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 4001
ENV PORT=4001
CMD ["node", "server.js"]
