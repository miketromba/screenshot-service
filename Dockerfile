# Using a dockerfile because digitalocean's default buildpack shits itself when
# it sees the monorepo and workspace:*-style imports

FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

FROM base AS builder
RUN apk update && \
    apk add --no-cache libc6-compat && \
    npm install -g pnpm turbo

WORKDIR /app

# Copy the app files first
COPY . ./apps/screenshot-service/

# Create minimal workspace setup
RUN echo '{"name":"root","private":true,"packageManager":"pnpm@10.7.1"}' > package.json && \
    echo '{"packages":["apps/*","packages/*"]}' > pnpm-workspace.yaml && \
    echo '{"$schema":"https://turbo.build/schema.json","pipeline":{}}' > turbo.json

# Generate pruned lockfile and workspace
RUN turbo prune @repo/screenshot-service --docker

FROM base AS installer
RUN apk update && \
    apk add --no-cache libc6-compat && \
    npm install -g pnpm

WORKDIR /app

# Copy pruned workspace
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy source files
COPY --from=builder /app/out/full/ .

# Install dependencies
RUN pnpm install

# Build the project
RUN pnpm turbo build --filter=@repo/screenshot-service...

FROM base AS runner
RUN apk add --no-cache libc6-compat chromium && \
    npm install -g tsx

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 screenshot-service && \
    adduser --system --uid 1001 screenshot-service
USER screenshot-service

# Copy built application
COPY --from=installer /app .

CMD ["tsx", "apps/screenshot-service/src/server.ts"]

EXPOSE 80
EXPOSE 3006