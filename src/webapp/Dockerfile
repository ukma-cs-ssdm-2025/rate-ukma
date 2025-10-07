# Build stage
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

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

# Build the project
RUN pnpm build

# For development - builder stage directly
FROM builder AS development
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# For production - minimal Alpine to handle file operations
FROM alpine:3.19 AS production
COPY --from=builder /app/dist /dist
CMD ["cp", "-r", "/dist/.", "/static/"]
