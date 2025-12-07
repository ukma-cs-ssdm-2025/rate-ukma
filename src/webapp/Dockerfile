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

# Copy the apiClient.ts file that orval needs during install
RUN mkdir -p ./src/lib/api
COPY src/webapp/src/lib/api/apiClient.ts ./src/lib/api/

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
ARG VITE_API_BASE_URL
ARG VITE_SENTRY_DSN_FRONTEND
ARG VITE_ENVIRONMENT
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT_FRONTEND
RUN test -n "${VITE_API_BASE_URL}" || (echo "VITE_API_BASE_URL build arg required" && exit 1)
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SENTRY_DSN_FRONTEND=${VITE_SENTRY_DSN_FRONTEND}
ENV VITE_ENVIRONMENT=${VITE_ENVIRONMENT}
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
ENV SENTRY_ORG=${SENTRY_ORG}
ENV SENTRY_PROJECT_FRONTEND=${SENTRY_PROJECT_FRONTEND}
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

# Production stage - minimal Alpine to handle file operations
FROM alpine:3.19 AS production
COPY --from=builder /app/dist /dist
CMD ["cp", "-r", "/dist/.", "/static/"]
