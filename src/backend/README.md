# Rate UKMA Backend

## 🛠️ Tech Stack

- **Django** with Django REST Framework
- **PostgreSQL** database
- **Python 3.11+**
- **OpenAPI** documentation
- **pytest** for testing

## 🚀 IDE Setup for Better Development Experience

The application runs in Docker containers as described in the main [README](../../README.md). For fast IDE feedback and IntelliSense, set up local Python environment:

### Prerequisites

- Python 3.11+

### 1. Create Virtual Environment

```bash
cd src/backend
python -m venv venv
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. VS Code Integration

Install recommended extensions from [`.vscode/extensions.json`](../../.vscode/extensions.json) when VS Code prompts you.

That's it! Your IDE will now provide full Python/Django support while the application continues running in Docker.

## 🛠️ Useful Commands

These commands can be run either locally (after IDE setup) or through Docker:

### Migrations

```bash
# Local
python manage.py makemigrations
python manage.py migrate

# Docker
docker exec -it <backend_container_name> python manage.py makemigrations
docker exec -it <backend_container_name> python manage.py migrate
```

### Superuser

```bash
# Local
python manage.py createsuperuser

# Docker
docker exec -it <backend_container_name> python manage.py createsuperuser
```

### Testing

```bash
# Local
pytest

# Docker
docker exec -it <backend_container_name> pytest
```

### Code Quality

```bash
# Local
ruff check .
black .

# Docker
docker exec -it <backend_container_name> ruff check .
```

### Security Audit

```bash
# Local
uv run safety scan --report          # Check for dependency vulnerabilities
uv run bandit -r .                   # Static code security analysis

# Docker
docker exec -it <backend_container_name> python -m safety scan --report
docker exec -it <backend_container_name> python -m bandit -r .
```

Security audit run automatically in CI via the [backend security audit workflow](../../.github/workflows/backend-audit.yml).
