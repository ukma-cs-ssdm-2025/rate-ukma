# Use Node.js 20 LTS as base image
FROM --platform=$BUILDPLATFORM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml for dependency caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies with pnpm
# Use --frozen-lockfile for reproducible builds
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build step for production
RUN if [ "$NODE_ENV" = "production" ]; then \
      pnpm build; \
    fi

# Expose port 3000
EXPOSE 3000

# Start command based on environment
CMD if [ "$NODE_ENV" = "production" ]; then \
      pnpm serve dist --host 0.0.0.0; \
    else \
      pnpm dev --host 0.0.0.0; \
    fi
