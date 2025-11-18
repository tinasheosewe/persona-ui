# Multi-stage build for the with-external-store example
FROM node:20.18.1-bookworm-slim AS base

ENV PNPM_HOME="/root/.local/share/pnpm" \
    PATH="$PNPM_HOME:$PATH" \
    NEXT_TELEMETRY_DISABLED="1"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git openssh-client \
        python3 python-is-python3 build-essential pkg-config libvips libvips-dev \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable pnpm

COPY . .

RUN pnpm install --frozen-lockfile=false \
    && pnpm --filter assistant-stream run build \
    && pnpm --filter assistant-cloud run build \
    && pnpm --filter with-external-store run build

FROM node:20.18.1-bookworm-slim AS runner

ENV PNPM_HOME="/root/.local/share/pnpm" \
    PATH="$PNPM_HOME:$PATH" \
    NODE_ENV="production" \
    NEXT_TELEMETRY_DISABLED="1"

WORKDIR /app

RUN corepack enable pnpm

COPY --from=base /app /app

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter with-external-store run start -- --hostname 0.0.0.0 --port ${PORT:-3000}"]
