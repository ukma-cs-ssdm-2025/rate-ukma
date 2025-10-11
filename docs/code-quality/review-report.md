# Bottleneck Team Code Review

## What to check and improve

- Enforce **code style rules** for automated formatting. Can be stored under version control.
- Lack of a clear **folder structure** (not organized by feature or type).
- **VCS History:** Messy history due to many **merge commits** and non-descriptive **commit messages**.
- **DB Mismatch:** **Postgres** is shown in the deployment diagram, but application settings use **`sqlite3`**.
- **Component diagram** is wrongly shown in high-level design document.
- **ENV:** Unclear source for variables like **`RDS_DB_NAME`**. Where are they set?
- **Code Quality:** **Imports** are placed randomly throughout files.
- **Cyrillic** in documentation and comments.
- **Minor Issues:** Nothing currently is present in **admin panel**, and it is better to have **"why" comments** (intent), than "what" comments (about implementation).

## Benefits

- **Consistent naming** conventions.
- Proper **ORM usage** - prevents SQL injection.
- **API documentation** is automatically generated on server startup.
- **Tests** are included.

## Security Issues

- Exposed **secret keys** (see [static analysis](static-analysis.md)) and configuration; no **`.env` file**, **`DEBUG=True`**, and permissive `ALLOWED_HOSTS = ["*"]` etc.
- **CORS app** is added but is **not configured**.
