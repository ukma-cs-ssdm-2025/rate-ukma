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
- **Frontend Conventions:** [`src/webapp/AGENTS.md`](../src/webapp/AGENTS.md) - React patterns, component structure, tooling
- **Architecture Docs:** [`docs/architecture/`](../docs/architecture/) - High-level design, ADRs, UML diagrams
- **API Documentation:** [`docs/api/`](../docs/api/) - REST API design, OpenAPI schema, versioning
- **Testing Strategy:** [`docs/testing/testing-strategy.md`](../docs/testing/testing-strategy.md) - Test approach and quality gates

## Commit Message Convention

All commits MUST follow semantic commit style: `<type>(#<issue_number>): <description>`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`

## Code Formatting

- **Backend:** `ruff format src/backend && ruff check src/backend --fix`
- **Frontend:** `pnpm check` and `pnpm format --write` (from `src/webapp/`)

## Final Review: Remove AI Code Slop

Before completing any task, check the diff against main and remove AI-generated slop:

- Extra comments that a human wouldn't add or are inconsistent with the file
- Unnecessary defensive checks or try/catch blocks (especially for trusted codepaths)
- Casts to `any` to bypass type issues
- Any style inconsistent with the rest of the file

Report with a 1-3 sentence summary of changes made.
