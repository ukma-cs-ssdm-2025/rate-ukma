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
uv sync 

# Install main + dev dependencies
uv sync --extra dev
```

See all available extras in [pyproject.toml](./pyproject.toml).

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
# Fast unit-only (skip integration)
pytest -m "not integration"
# Integration only
pytest -m "integration"

# Docker
docker exec -it <backend_container_name> pytest
docker exec -it <backend_container_name> pytest -m "not integration"
docker exec -it <backend_container_name> pytest -m "integration"
```

To generate an HTML coverage report:

```bash
# Local
pytest --cov=rateukma --cov-report=html

# Docker
docker exec -it <backend_container_name> pytest --cov=rateukma --cov-report=html
```

Note: the default behavior remains to print the coverage report in the terminal

### Code Quality

```bash
# Local
ruff check .

# Docker
docker exec -it <backend_container_name> ruff check .
```

## Scraper

The backend includes web scraping functionality to collect course data from UKMA.

### Setup

Before running scraper commands for the first time, install Playwright browsers:

```bash
playwright install
```

### Main Commands

```bash
python manage.py prepare_filtered_url
python manage.py collect_catalog
python manage.py fetch_courses
python manage.py group_courses
python manage.py insert_scraped --file scraper/state/grouped_courses.jsonl
```

Add `--help` to any command to see all available arguments

### State Files and Outputs

The scraper creates intermediate state files in `scraper/state/`:

- `filtered_urls.txt` - Generated catalog URL
- `courses.jsonl` - Fetched course data
- `grouped_courses.jsonl` - Processed and grouped courses

### Full Flow of Scraper: Parsing to Ingestion

The scraper follows a complete pipeline from data collection to database ingestion. Use this workflow to test the complete flow from parsing my.ukma.edu.ua data to ingestion into the staging/live database.

#### 1. Prepare filtered catalog URL with all academic years and filters

```bash
python manage.py prepare_filtered_url

# Run with interactive browser to generate filtered URL
python manage.py prepare_filtered_url --interactive
```

#### 2. Collect course IDs from catalog pages

```bash
python manage.py collect_catalog

# Or use a custom URL with specific filters
python manage.py collect_catalog --url "https://example.com/course/catalog?academic_year=2025-2026"
```

#### 3. Fetch Detailed Course Information

```bash
python manage.py fetch_courses
```

#### 4. Group courses that are essentially the same (different years etc.)

```bash
python manage.py group_courses
```

#### 5. Insert grouped course data into the database

```bash
python manage.py insert_scraped --file scraper/state/grouped_courses.jsonl
```

## Security Audit

```bash
# Local
uv run safety scan --report          # Check for dependency vulnerabilities
uv run bandit -r .                   # Static code security analysis

# Docker
docker exec -it <backend_container_name> python -m safety scan --report
docker exec -it <backend_container_name> python -m bandit -r .
```

Security audit run automatically in CI via the [backend security audit workflow](../../.github/workflows/backend-audit.yml).
