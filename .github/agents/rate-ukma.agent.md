---
name: Rate UKMA Assistant
description: AI assistant for the Rate UKMA course review platform - Django backend, React frontend, PostgreSQL database
---

# Rate UKMA Development Agent

You are an AI assistant for the **Rate UKMA** project - a web platform for NaUKMA students to share and view course feedback.

## Project Overview

**Rate UKMA** enables students to rate courses, leave reviews, and view analytics through interactive graphs. The platform uses NaUKMA Outlook authentication for secure student-only access and maintains anonymity to protect privacy.

### Tech Stack

- **Backend:** Django 5.2, Django REST Framework, PostgreSQL
- **Frontend:** React, TanStack Router, Vite, Biome
- **Database:** PostgreSQL
- **API Contract:** OpenAPI (drf-spectacular)
- **Package Managers:** uv (backend), pnpm (frontend)
- **Deployment:** Docker, Docker Compose

### Repository Structure

```
rate-ukma/
├── src/
│   ├── backend/          # Django application
│   │   ├── rateukma/     # Main Django project
│   │   ├── rating_app/   # Course rating app
│   │   ├── scraper/      # Course data scraper
│   │   ├── pyproject.toml
│   │   └── README.md     # Backend-specific instructions
│   └── webapp/           # React frontend
│       ├── src/
│       ├── biome.json
│       ├── AGENTS.md     # Frontend conventions
│       └── README.md     # Frontend-specific instructions
├── docs/                 # Architecture, ADRs, requirements
├── .github/              # GitHub workflows and templates
├── README.md             # Main project documentation
├── TeamCharter.md        # Team structure and workflows
└── Project-Description.md
```

## Essential Documentation References

**Always skim these before making changes:**

- **Main README:** [`README.md`](../README.md) - Project overview, tech stack, running instructions
- **Backend README:** [`src/backend/README.md`](../src/backend/README.md) - Django setup, virtual environment, IDE integration
- **Frontend README:** [`src/webapp/README.md`](../src/webapp/README.md) - React setup, dependencies, IDE integration
- **Frontend Conventions:** [`src/webapp/AGENTS.md`](../src/webapp/CLAUDE.md) - React patterns, component structure, tooling
- **Architecture Docs:** [`docs/architecture/`](../docs/architecture/) - High-level design, ADRs, UML diagrams
- **API Documentation:** [`docs/api/`](../docs/api/) - REST API design, OpenAPI schema, versioning
- **Testing Strategy:** [`docs/testing/testing-strategy.md`](../docs/testing/testing-strategy.md) - Test approach and quality gates

## Commit Message Convention

**CRITICAL:** All commits MUST follow semantic commit style with issue numbers:

```
<type>(#<issue_number>): <description>

Examples:
- fix(#42): resolve authentication redirect loop
- feat(#101): add scatter plot visualization
- refactor(#89): extract course service logic
- test(#56): add coverage for rating validation
- docs(#23): update API authentication guide
- chore(#78): upgrade Django to 5.2.8
```

### Common Types
- `feat`: New features
- `fix`: Bug fixes
- `refactor`: Code restructuring
- `test`: Test additions/changes
- `docs`: Documentation updates
- `chore`: Dependency updates, tooling
- `style`: Code style/formatting (no logic change)
- `perf`: Performance improvements

## Code Formatting Requirements

### Backend (Python)

**ALWAYS format with ruff before committing:**

```bash
# From project root
ruff format src/backend
ruff check src/backend --fix

# Or using pre-commit
pre-commit run ruff-format --all-files
pre-commit run ruff --all-files
```

### Frontend (TypeScript/React)

**ALWAYS format with Biome before committing:**

```bash
# From src/webapp directory
pnpm check         # Lint and format check
pnpm format --write  # Auto-fix formatting
pnpm lint          # Lint only
```
