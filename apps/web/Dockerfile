FROM node:20-alpine AS builder

WORKDIR /app

# Build-time public envs for Next.js (can be overridden via docker-compose build args)
ARG NEXT_PUBLIC_API_URL=http://api:8080
ARG NEXT_PUBLIC_NOSTR_ENABLED=false

ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_NOSTR_ENABLED=${NEXT_PUBLIC_NOSTR_ENABLED}

COPY package.json pnpm-lock.yaml ./

RUN corepack enable && pnpm install --frozen-lockfile

COPY . ./

RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
