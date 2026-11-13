# Production Dockerfile for MessInsight Next.js 15 Web Application
# Multi-stage build for minimal image size and maximum security

# 1. Base stage
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat curl

# 2. Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm ci

# 3. Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dummy env vars for build time static generation
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    MONGODB_URI="mongodb://localhost:27017/build" \
    JWT_SECRET="temporary-build-secret-minimum-32-chars-long" \
    INSTITUTE_EMAIL_DOMAIN="college.edu" \
    ML_SERVICE_URL="http://localhost:8000" \
    ML_SERVICE_SECRET="build-secret-placeholder"

RUN npm run build

# 4. Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]

