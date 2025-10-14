# Rate UKMA Webapp

## 🛠️ Tech Stack

- **React 19** with TypeScript
- **TanStack Router** for file-based routing
- **Tailwind CSS** for styling
- **shadcn/ui** for component library
- **Biome** for linting and formatting
- **Vitest** for testing

## 🚀 IDE Setup for Better Development Experience

The application runs in Docker containers as described in the main [README](../../README.md). For fast IDE feedback and IntelliSense, set up local Node.js environment:

### Prerequisites

- Node.js v20+ and pnpm

### 0. Install pnpm

```bash
npm install -g pnpm
```

### 1. Install Dependencies

```bash
cd src/webapp
pnpm install
```

### 2. VS Code Integration

Install recommended extensions from [`.vscode/extensions.json`](../../.vscode/extensions.json) when VS Code prompts you.

That's it! Your IDE will now provide full React/TypeScript support while the application continues running in Docker.

## 🛠️ Useful Commands

These commands can be run either locally (after IDE setup) or through Docker:

### Development Server

```bash
# Local
pnpm start

# Docker (already running)
# Available at http://localhost:3000
```

### Testing

```bash
# Local
pnpm test

# Docker
docker exec -it <frontend_container_name> pnpm test
```

### Code Quality

```bash
# Local
pnpm lint
pnpm format --write
pnpm check

# Docker
docker exec -it <frontend_container_name> pnpm lint
docker exec -it <frontend_container_name> pnpm format --write
docker exec -it <frontend_container_name> pnpm check
```

### Build

```bash
# Local
pnpm build

# Docker
docker exec -it <frontend_container_name> pnpm build
```

## 🔌 API Client Generation

The application uses **Orval** to automatically generate a type-safe API client from the OpenAPI specification. The generated client includes:

- TypeScript interfaces for all API models
- React Query hooks for API endpoints
- Full type safety and IntelliSense support

### Manual Generation

The API client is automatically generated during `pnpm install`, but you can also regenerate it manually:

```bash
# Local
pnpm generate-api

# Docker
docker exec -it <frontend_container_name> pnpm generate-api
```

### Configuration

The API client generation is configured in [`orval.config.ts`](./orval.config.ts) and generates files to `src/lib/api-generated/`. The client uses React Query for data fetching and includes infinite query support.

### Security Audit

```bash
# Local
pnpm run security:audit

# CI/CD
# Runs automatically on webapp file changes and periodically
```
