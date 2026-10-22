# syntax=docker/dockerfile:1

FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --omit=peer

FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOME=/tmp

COPY --chown=bun:bun package.json bun.lock ./
COPY --chown=bun:bun --from=deps /app/node_modules ./node_modules
COPY --chown=bun:bun index.ts ./
COPY --chown=bun:bun src ./src
COPY --chown=bun:bun drizzle ./drizzle

USER bun

# Probe endpoint only; no Service or Ingress is exposed.
EXPOSE 8080

CMD ["bun", "index.ts"]
