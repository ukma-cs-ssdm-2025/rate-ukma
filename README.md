# Rate UKMA

[![Linting](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/linting.yml/badge.svg)](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/linting.yml)
[![Tests](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/test.yml/badge.svg)](https://github.com/ukma-cs-ssdm-2025/rate-ukma/actions/workflows/test.yml)

**Rate. Review. Discover your best courses at NaUKMA.**

## 📌 Overview

**Rate UKMA** is a web platform designed for students of NaUKMA to share and view feedback on university courses. Our goal is to create a centralized hub for course reviews and ratings, empowering students to make more informed decisions about their academic choices.

## 🧩 Features

- Rate courses and leave reviews
- Interactive graphs and analytics
- Search and filter courses by department, professor, or rating
- Anonymity to protect student privacy and prevent bias
- NaUKMA Outlook authentication for secure student-only access

## 🧑‍💻 Team

| Name | GitHub |
|------|--------|
| Anastasiia Aleksieienko | [@stasiaaleks](https://github.com/stasiaaleks) |
| Kateryna Bratiuk | [@katerynabratiuk](https://github.com/katerynabratiuk) |
| Andrii Valenia | [@Fybex](https://github.com/Fybex) |
| Milana Horalevych | [@miqdok](https://github.com/miqdok) |

## 🛠️ Tech Stack

- **Backend:** Django
- **Frontend:** React
- **Database:** PostgreSQL
- **API Contract:** OpenAPI

## 📚 Additional Documentation

For comprehensive project information, please refer to the following documents:

- [Team Charter](TeamCharter.md) - Detailed information about our team structure, workflows, and collaboration guidelines
- [Project Description](Project-Description.md) - An overview of our project's core idea, goals, and key features
- [User Stories](docs/requirements/user-stories.md) - Detailed information about project user stories
- [Requirements Specification](docs/requirements/requirements.md) - Functional and non-functional requirements
- [Requirements Traceability Matrix](docs/requirements/rtm.md) - Mapping of user stories to functional and non-functional requirements

## 🚀 Running Project

### Prerequisites

- Python 3.11+
- Docker Engine 24.0+
- Docker Compose V2
- Git

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

3. Create and activate virtual environment:

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   ```

4. Build containers and start development environment:

   ```bash
   docker compose up -d --build
   ```

5. Create a superuser:

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

### Running Tests

```bash
docker exec -it <backend_container_name> pytest
```
