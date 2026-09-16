# Rate UKMA

[![Deploy Staging](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/main-pipeline.yml/badge.svg)](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/main-pipeline.yml)
[![Deploy Live](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/prod-pipeline.yml/badge.svg)](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/prod-pipeline.yml)
![Tests Coverage](coverage.svg)
[![Release](https://img.shields.io/github/v/release/ukma-cs-ssdm-2025/rate-ukma?cacheSeconds=300)](https://github.com/ukma-cs-ssdm-2025/rate-ukma/releases)

**Rate. Review. Discover your best courses at NaUKMA.**

## 📌 Overview

**Rate UKMA** is a web platform designed for students of NaUKMA to share and view feedback on university courses. Our goal is to create a centralized hub for course reviews and ratings, empowering students to make more informed decisions about their academic choices.

**The problem.** To understand what a course is really like, a student has to ask around: older students, friends, acquaintances, course chats. In my.ukma.edu.ua a course is a name, a credit count and an annotation, and credits show the general workload, not the real one: the two do not always match. So the experience lives with people, scattered and never written down, and there is no single place to find it before enrolment.

**Target user.** NaUKMA students, mostly 2nd to 4th year bachelor's students choosing electives for the next year and planning their semester. They read reviews and leave ratings, and writing a review is optional. Access is student-only, via a NaUKMA Outlook account.

**The idea.** One place for the whole course choice: student reviews with usefulness and difficulty ratings and an interactive course map, live at rateukma.com, plus the semester planning and analytics we are building now.

**How it started.** Rate UKMA began as a project in one of our university courses and grew into a product. From the first days we treated it as a product rather than an assignment to hand in, and shipped it: the site has been live since 2025, about 300 students come to it every month, with a peak in the spring registration window. The first point was a hand-made chart someone shared in a student chat, courses plotted on two axes, usefulness and difficulty. The chart was not ours, but the format stuck: we turned the idea into a product, the same map built from real student reviews.

**Staging**: <https://staging.rateukma.com>

**Live**: <https://rateukma.com>

**Releases**: <https://github.com/ukma-cs-ssdm-2025/rate-ukma/releases>

## 🧩 Features

- Rate courses and leave reviews
- Vote and comment on reviews
- Interactive graphs and analytics
- Search and filter courses by department, professor, or rating
- Anonymity to protect student privacy and prevent bias
- NaUKMA Outlook authentication for secure student-only access

## 🧑‍💻 Team

| Name                    | Role             | GitHub                                                 |
| ----------------------- | ---------------- | ------------------------------------------------------ |
| Anastasiia Aleksieienko | Product engineer | [@stasiaaleks](https://github.com/stasiaaleks)         |
| Kateryna Bratiuk        | Product engineer | [@katerynabratiuk](https://github.com/katerynabratiuk) |
| Andrii Valenia          | Product engineer | [@Fybex](https://github.com/Fybex)                     |
| Milana Horalevych       | Product engineer | [@miqdok](https://github.com/miqdok)                   |
| Nastya Dvoilenko        | Product engineer | [@anastasiaaq](https://github.com/anastasiaaq)         |

Everyone writes and reviews code; the semester tracks are split across the team.

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
- [Final Report](labs/final-report.md) - Final report and navigation hub

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

## License

Copyright (C) 2025-present Anastasiia Aleksieienko, Kateryna Bratiuk, Andrii Valenia, Milana Horalevych

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
