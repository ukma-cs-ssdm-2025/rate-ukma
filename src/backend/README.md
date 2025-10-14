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
- uv package manager (faster, more secure alternative to pip)

### 1. Create Virtual Environment

```bash
cd src/backend
uv venv
```

### 2. Install Dependencies

```bash
source .venv/bin/activate  # Activate the virtual environment

# Install main dependencies
uv pip install -e .

# Install dev dependencies
uv pip install -e ".[dev]"
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
