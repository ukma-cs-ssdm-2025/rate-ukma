FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /app

RUN set -eux; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*; \
    apt-get update -o Acquire::CompressionTypes::Order::=gz && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    apt-get purge -y --auto-remove curl && \
    rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.local/bin:$PATH"



FROM base AS builder
RUN uv venv
COPY pyproject.toml uv.lock* ./
RUN uv sync
COPY . .



FROM base AS final
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /app/ .

ENV PATH="/opt/venv/bin:$PATH"

EXPOSE 8000

COPY django-entrypoint.sh /django-entrypoint.sh
RUN chmod +x /django-entrypoint.sh

ENTRYPOINT ["/django-entrypoint.sh"]