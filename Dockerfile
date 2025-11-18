# Multi-stage build for the lightweight Next.js chat app
FROM node:20.18.1-bookworm-slim AS deps

ENV PNPM_HOME="/root/.local/share/pnpm" \
    PATH="$PNPM_HOME:$PATH" \
    NEXT_TELEMETRY_DISABLED="1"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile=false

FROM node:20.18.1-bookworm-slim AS builder

ENV NODE_ENV="production" \
    NEXT_TELEMETRY_DISABLED="1"

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

FROM node:20.18.1-bookworm-slim AS runner

ENV NODE_ENV="production" \
    NEXT_TELEMETRY_DISABLED="1"

WORKDIR /app

COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
