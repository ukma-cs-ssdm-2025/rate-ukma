# Rate UKMA Webapp

## 🛠️ Tech Stack

- **React 19** with TypeScript
- **TanStack Router** for file-based routing
- **Tailwind CSS** for styling
- **shadcn/ui** for component library
- **Biome** for linting and formatting
- **Vitest** for testing

## 🚀 Development

### Docker Setup (Recommended)

The frontend runs in Docker containers as part of the main project:

```bash
# From project root
docker compose up -d --build
```

The app will be available at `http://localhost:3000`.

### Local Development Setup

For the best IDE experience with full IntelliSense, linting, and hot reload:

1. **Install dependencies:**

   ```bash
   cd src/webapp
   pnpm install
   ```

2. **VS Code Setup**

   Install recommended extensions from [`.vscode/extensions.json`](../../.vscode/extensions.json) when VS Code prompts you.

3. **Start development server:**

   ```bash
   pnpm start
   ```

4. **Build for production:**

   ```bash
   pnpm build
   ```

## 🧪 Testing

Run tests with Vitest:

```bash
pnpm test
```

## 🔧 Code Quality

**Linting & Formatting with Biome:**

```bash
pnpm lint            # Check for issues
pnpm format          # Check code format issues
pnpm format --write  # Resolve code format issues
pnpm check           # Run all checks
```

## 🔗 IDE Integration

For optimal development experience:

1. **Install recommended extensions** from [`.vscode/extensions.json`](../../.vscode/extensions.json) when VS Code prompts you
2. **Use local dependencies** (not Docker) for full IDE features

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
