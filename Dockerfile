# syntax=docker/dockerfile:1
# Imagem de produção multi-stage com o output standalone do Next.
FROM node:24.22.3-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat && corepack enable

# 1) Dependências
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 2) Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valores só de build (não vão pra imagem final). Os reais entram em runtime.
RUN PAYLOAD_SECRET=build-only-placeholder \
    DATABASE_URI=mongodb://build-placeholder:27017/build \
    pnpm run build

# 3) Runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
RUN mkdir .next media && chown nextjs:nodejs .next media
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Fontes da OG image (next/og lê do disco em runtime)
COPY --from=builder --chown=nextjs:nodejs /app/src/assets/og ./src/assets/og
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
