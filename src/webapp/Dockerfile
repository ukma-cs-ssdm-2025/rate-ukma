# Base stage - common setup for both development and production
FROM --platform=$BUILDPLATFORM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files and orval config
COPY src/webapp/package.json src/webapp/pnpm-lock.yaml src/webapp/orval.config.ts ./

# Create docs/api directory structure at the correct location for orval
RUN mkdir -p /docs/api
COPY docs/api/openapi-generated.yaml /docs/api/openapi-generated.yaml

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy remaining source code
COPY src/webapp/ ./

# Development stage - uses base directly without building
FROM base AS development
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# Build stage - only used for production builds
FROM base AS builder
RUN pnpm build

# Production stage - minimal Alpine to handle file operations
FROM alpine:3.19 AS production
COPY --from=builder /app/dist /dist
CMD ["cp", "-r", "/dist/.", "/static/"]
