# Rate UKMA

[![Deploy Staging](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/main-pipeline.yml/badge.svg)](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/main-pipeline.yml)
[![Deploy Live](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/prod-pipeline.yml/badge.svg)](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/prod-pipeline.yml)
![Tests Coverage](coverage.svg)
[![Release](https://img.shields.io/github/v/release/ukma-cs-ssdm-2025/rate-ukma?sort=semver)](https://github.com/ukma-cs-ssdm-2025/rate-ukma/releases)

**Rate. Review. Discover your best courses at NaUKMA.**

## 📌 Overview

**Rate UKMA** is a web platform designed for students of NaUKMA to share and view feedback on university courses. Our goal is to create a centralized hub for course reviews and ratings, empowering students to make more informed decisions about their academic choices.

**Staging**: <https://staging.rateukma.com>

**Live**: <https://rateukma.com>

## 🧩 Features

- Rate courses and leave reviews
- Interactive graphs and analytics
- Search and filter courses by department, professor, or rating
- Anonymity to protect student privacy and prevent bias
- NaUKMA Outlook authentication for secure student-only access

## 🧑‍💻 Team

| Name                    | GitHub                                                 |
| ----------------------- | ------------------------------------------------------ |
| Anastasiia Aleksieienko | [@stasiaaleks](https://github.com/stasiaaleks)         |
| Kateryna Bratiuk        | [@katerynabratiuk](https://github.com/katerynabratiuk) |
| Andrii Valenia          | [@Fybex](https://github.com/Fybex)                     |
| Milana Horalevych       | [@miqdok](https://github.com/miqdok)                   |

## 🛠️ Tech Stack

- **Backend:** Django
- **Frontend:** React
- **Database:** PostgreSQL
- **API Contract:** OpenAPI

## 📚 Additional Documentation

For comprehensive project information, please refer to the following documents:

- [Team Charter](TeamCharter.md) - Detailed information about our team structure, workflows and collaboration guidelines
- [Project Description](Project-Description.md) - An overview of our project's core idea, goals and key features
- [Architecture](docs/architecture/) - High-level design, ADRs and UML diagrams
- [User Stories](docs/requirements/user-stories.md) - Detailed information about project user stories
- [Requirements Specification](docs/requirements/requirements.md) - Functional and non-functional requirements
- [Traceability Matrix](docs/traceability-matrix.md) - Mapping of user stories to functional and non-functional requirements
- [API Documentation](docs/api/api-documentation.md) - OpenAPI schema generation, Swagger UI setup and API versioning guide
- [API Design](docs/api/api-design.md) - REST API architecture, resource model and design decisions
- [API Quality Attributes](docs/api/api-quality-attributes.md) - Performance, security, reliability, usability, and maintainability targets for the API
- [Testing Strategy](docs/testing/testing-strategy.md) - Comprehensive testing approach, tools, and quality gates
- [Test Plan](docs/validation/test-plan.md) - Detailed test cases and acceptance criteria

## 🚀 Running Project

### Prerequisites

- Docker Engine 24.0+
- Docker Compose V2
- Git
- uv package manager (for local development)
  [Installation](https://docs.astral.sh/uv/getting-started/installation/)

  ```bash
  # Install uv (Linux/macOS)
  curl -LsSf https://astral.sh/uv/install.sh | sh

  # Or using pip
  pip install uv
  ```

### Starting Development Environment

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd rate-ukma
   ```

2. Create and configure environment variables:

   ```bash
   cd src
   cp .env.sample .env
   ```

   Add actual values to `.env`.

3. Build containers and start development environment:

   ```bash
   docker compose --profile dev up -d --build
   ```

   The following services will be available:

   - **Webapp:** <http://localhost:3000>
   - **Backend API:** <http://localhost:8000>
   - **Admin Panel:** <http://localhost:8000/admin>

4. Create a superuser:

   ```bash
   docker exec -it <backend_container_name> bash
   python manage.py createsuperuser

   # Or one-liner:
   docker exec -it <backend_container_name> python manage.py createsuperuser
   ```

### Making Migrations

```bash
docker exec -it <backend_container_name> bash
python manage.py makemigrations
# Or a similar one-liner as above
```

Then restart the containers - migrations are run on startup

### Pre-commit Hooks Setup

Pre-commit is installed with other dependencies. To use it:

1. Install git hooks:

   ```bash
   pre-commit install
   ```

   This installs git hooks from `.pre-commit-config.yaml` into your local repository.

   Pre-commit will automatically run before every commit.

2. To run pre-commit manually:

   ```bash
   pre-commit run --all-files # all files
   pre-commit run --files <file1> <file2> <file3> # specific files
   pre-commit run # all staged files
   ```

## 💻 Development Resources

For detailed development instructions, IDE setup, and additional commands:

- **Backend Development:** See [Backend README](src/backend/README.md) - Django setup, virtual environment, and IDE integration
- **Frontend Development:** See [Webapp README](src/webapp/README.md) - React setup, local dependencies, and IDE integration

**Important:** While the project runs entirely in Docker, installing dependencies locally provides better IDE integration, IntelliSense, and real-time linting.
