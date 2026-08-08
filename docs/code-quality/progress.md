
# Project Progress Report
**Date:** *17.10.2025*

## 1. Overview
   During Lab 05, our team focused on improving code quality by performing a structured code review, integrating Ruff and Bandit into CI, providing authentication, building scraper, implementing the initial API endpoints for the Course module.


## 2. Code Review Summary

| Problem | Proposed Solution | Reference |
|----------|-------------------|------------|
| **No clear description of the project’s structure** | Since the foundational architecture is still being developed, this remains in the backlog. However, a *brief* overview of the current structure is provided below. | [Issue #102](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/102) |
| **Rating module includes unnecessary methods** | Will be addressed during the next iteration of the Rating module refactor. | [Issue #87](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/87) |
| **Long lines (up to 154 characters)** | Identified as a maintainability issue — is fixed by applying `ruff` line length enforcement (max 100 chars). | [Issue #85](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/85)/[Issue #92](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/92) |
| **Security concerns** | Enabled scans integrated into CI/CD pipeline. | [Issue #91](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/91) |


> Reference: [code review](https://github.com/ukma-cs-ssdm-2025/punkcoders/blob/dev/docs/Code-quality/review-report.md)


## 3. Implementation Progress

###  Implemented Components

| Component | Description | Reference| Status |
|------------|-------------|--------|-----------|
| Microsoft `Authentication` | Microsoft OIDC authentication system with session-based security and authorization middleware. |[Issue 89](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/89)| ✅ Working |
| `Course` API | Endpoints for listing and retrieving courses |[Issue 88](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/88)| ✅ Working |
| `Rating` module | To be done |[Issue 87](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/87)|🛠 In progress |
| `Scraper`| Create internal parser tool to extract course data from my.ukma.edu.ua for later integration into the rating system. |[Issue 90](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/90) |✅ Working  |
| `Security` Audits| Ensure code security by automatically scanning for vulnerabilities and security issues. |[Issue 91](https://github.com/ukma-cs-ssdm-2025/rate-ukma/issues/91) |✅ Working  |


## 4. Project Overview
### Backend

```text
backend/  
│  
├── rateukma/                      # Django project configuration  
│   ├── settings/                  # Environment-specific settings  
│   ├── urls.py                    # Root URL configuration  
│   └── wsgi.py / asgi.py          # WSGI/ASGI entry points  
│  
├── rating_app/                    # Main application  
│   ├── models/                    # Django ORM models (Domain Layer)  
│   ├── repositories/              # Data Access Layer  
│   ├── services/                  # Business Logic Layer  
│   ├── serializers/               # REST Framework Serializers  
│   ├── views/                     # API Endpoints (ViewSets)  
│   ├── ioc_container/             # Dependency Injection  
│   ├── admin/                     # Django Admin customization  
│   ├── auth/                      # Authentication utilities  
│   ├── exception/                 # Custom exception handlers  
│   └── migrations/                # Database migrations  
│  
├── scraper/                       # Data Scraper  
├── static/                        # Static files (CSS, JS)  
├── media/                         # User-uploaded files  
├── manage.py                      # Django management script  
├── requirements.txt               # Python dependencies  
└── Dockerfile                     # Backend container definition
```

### Webapp / Frontend
```text
webapp/  
│  
├── src/                            # Source files  
│   ├── components/                 # Reusable UI components  
│   ├── routes/                     # File-based routing (TanStack Router)  
│   │   ├── __root.tsx              # Root layout route  
│   │   ├── index.tsx               # Home page (course catalog)  
│   │   └── my-ratings.tsx          # User's ratings page  
│   │  
│   ├── integrations/               # Third-party integrations  
│   │   └── tanstack-query/         # React Query configuration  
│   │  
│   ├── lib/                        # Utility functions  
│   │   └── utils.ts                # Helper functions (cn, formatters, etc.)  
│   │  
│   ├── env.ts                      # Environment configuration  
│   ├── main.tsx                    # Application entry point  
│   ├── routeTree.gen.ts            # Auto-generated route tree  
│   └── styles.css                  # Global styles (Tailwind)  
│  
├── public/                         # Static assets  
│   ├── manifest.json               # PWA manifest  
│   └── robots.txt                  # SEO configuration  
│  
├── package.json                    # Node.js dependencies  
├── vite.config.ts                  # Vite configuration  
├── .oxlintrc.json                  # Oxlint linting rules
├── .oxfmtrc.json                    # Oxfmt formatting rules
├── orval.config.ts                 # API client generation config  
├── tailwind.config.ts              # Tailwind CSS configuration  
├── components.json                 # shadcn/ui configuration  
└── Dockerfile                      # Frontend container definition
```

## 5. Next steps
- Add test suite.
- Prepare minimal working prototype (MVP) for demo.
- Course/Rating pages.
- Scraper Data Ingestion & Deduplication
- Switching to `uv` as package manager
