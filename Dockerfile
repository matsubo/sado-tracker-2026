# syntax=docker/dockerfile:1

FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

FROM oven/bun:1.4-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Tokyo \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data

RUN apk add --no-cache tzdata curl \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs \
 && mkdir -p /app/data && chown -R nextjs:nodejs /app/data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/api/race > /dev/null || exit 1

CMD ["node", "server.js"]
