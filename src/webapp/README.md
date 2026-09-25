# Rate UKMA Webapp

## 🛠️ Tech Stack

- **React 19** with TypeScript
- **TanStack Router** for file-based routing
- **Tailwind CSS** for styling
- **shadcn/ui** for component library
- **Oxlint/Oxfmt** for linting and formatting
- **Vitest** for testing

## 🚀 IDE Setup for Better Development Experience

The application runs in Docker containers as described in the main [README](../../README.md). For fast IDE feedback and IntelliSense, set up local Node.js environment:

### Prerequisites

- Node.js v22.18+ and pnpm 11

### 0. Install pnpm

```bash
npm install -g pnpm@11.20.0
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
# Unit tests
# Local
pnpm test

# Docker
docker exec -it <frontend_container_name> pnpm test

# E2E tests (headless mode)
# Local (requires .env file with CORPORATE_EMAIL and CORPORATE_PASSWORD)
pnpm test:e2e

# E2E tests (interactive mode - opens browser)
pnpm test:e2e:ui

# Docker
docker exec -it <frontend_container_name> pnpm test:e2e
```

#### E2E Test Setup

E2E tests require Microsoft authentication credentials. Make sure the `src/.env` file contains:

```bash
CORPORATE_EMAIL=your-ukma-email@ukma.edu.ua
CORPORATE_PASSWORD=your-password
BASE_URL=http://localhost:3000  # optional, defaults to http://localhost:3000
```

Copy from `src/.env.sample` if you haven't set up your `.env` file yet.

### Screenshots

`pnpm shots` renders every app state (grouped by page: home, feed, course, rating, comments, my ratings, map, navigation, sign-in and errors, including open menus, dialogs and tooltips) at 1440x900 and 390x844 in light and dark, and writes the PNGs plus an `index.html` gallery to `shots/`. Every API call is answered from invented fixtures in `tests/shots/fixtures/`, so no backend or login is needed; an endpoint without a fixture is logged as `[shots] unmocked`.

```bash
pnpm shots                                 # build, preview, shoot into shots/
SHOT_ONLY=feed pnpm shots                  # only states whose name matches
SHOT_DIR=/tmp/after SHOT_BEFORE_DIR=/tmp/before pnpm shots   # index.html pairs before | after
SHOT_BASE_URL=http://127.0.0.1:4175 pnpm shots               # shoot a server that is already running
```

`pnpm shots:compare` shoots a base ref and the working tree with the same states and opens one before | after gallery. The base is built once per commit and cached in `$TMPDIR/rate-ukma-shots`; a state the base cannot reach shows as "no before shot".

```bash
pnpm shots:compare                         # origin/main vs working tree
pnpm shots:compare my-branch               # any branch, tag or sha as the base
SHOT_ONLY='^course' SHOT_DIR=/tmp/cmp SHOT_NO_OPEN=1 pnpm shots:compare   # scripted: prints the index path
```

The gallery groups states by page in a sidebar and marks each one changed, new or same (byte-identical). Keys: `1`–`4` switch width and theme, `j`/`k` step through states, `/` filters by name, `c` hides unchanged states. The URL hash keeps the view and state, so a link opens the same spot.

When a UI change depends on data shape (long lists, many years, empty or missing fields, long titles), add a state for that edge to `tests/shots/shots.spec.ts` with a fixture in `tests/shots/fixtures/`, as `my-ratings-many` does for four years of courses. The state then stays in every later compare.

### Code Quality

```bash
# Local
pnpm lint
pnpm format
pnpm typecheck
pnpm check      # lint + format:check + typecheck, same as CI
pnpm check:all  # the above plus unit tests

# Docker
docker exec -it <frontend_container_name> pnpm lint
docker exec -it <frontend_container_name> pnpm format
docker exec -it <frontend_container_name> pnpm check
```

### Build

```bash
# Local
pnpm build

# Docker
docker exec -it <frontend_container_name> pnpm build
```

## 🔐 Developer Authentication

For development and testing purposes, developers can authenticate using Django credentials directly in the webapp:

### Quick Authentication Shortcut

- **Keyboard Shortcut:** `Ctrl+Shift+D`
- **Purpose:** Authenticate with Django credentials without going through the normal user flow
- **Use Case:** Development, testing, or admin access with Django superuser credentials

> **Important:**
>
> - Ensure you enter the shortcut using an English keyboard layout
> - This feature is intended for developers only and is hidden from regular users
> - Use Django admin credentials when prompted

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

The API client generation is configured in [`orval.config.ts`](./orval.config.ts) and generates files to `src/lib/api/generated/`. The client uses React Query for data fetching and includes infinite query support.

### Security Audit

```bash
# Local
pnpm run security:audit

# CI/CD
# Runs automatically on webapp file changes and periodically
```
