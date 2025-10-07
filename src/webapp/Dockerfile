# Base stage - common setup for both development and production
FROM --platform=$BUILDPLATFORM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

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
