#!/usr/bin/env bash
# Regenerate Rating App's UKMA Data models from the parser's OpenAPI spec.
# Run after src/parser changes docs/parser-service/openapi.json or its API types.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"

SPEC="../../docs/parser-service/openapi.json"
OUTPUT="rating_app/application_schemas/ukma_data_api.py"

uv run --quiet --extra codegen --extra linting datamodel-codegen \
  --input "$SPEC" \
  --input-file-type openapi \
  --output "$OUTPUT" \
  --output-model-type pydantic_v2.BaseModel \
  --base-class rating_app.application_schemas.ukma_data_base.UkmaDataModel \
  --snake-case-field \
  --use-annotated \
  --use-standard-collections \
  --use-union-operator \
  --target-python-version 3.12 \
  --openapi-scopes schemas \
  --extra-fields ignore \
  --disable-timestamp \
  --no-formatters

uv run --quiet --extra linting ruff format "$OUTPUT"
uv run --quiet --extra linting ruff check --fix --quiet "$OUTPUT"
