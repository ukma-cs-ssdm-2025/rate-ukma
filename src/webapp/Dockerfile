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
# --prefer-frozen-lockfile ensures the lockfile is respected
RUN pnpm install --frozen-lockfile --prefer-frozen-lockfile

# Copy source code
COPY . .

# Expose port 3000 (as configured in package.json dev script)
EXPOSE 3000

# Default command for development
# Bind to 0.0.0.0 to make it accessible from outside the container
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
