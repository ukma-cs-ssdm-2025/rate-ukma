FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y curl && \
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
RUN useradd --create-home --shell /bin/bash user
USER user
WORKDIR /home/user/app

COPY --from=builder /app/.venv ./.venv
COPY --from=builder /app/ .

ENV PATH="/home/user/app/.venv/bin:$PATH"

EXPOSE 8000

COPY --chown=user:user django-entrypoint.sh /django-entrypoint.sh
RUN chmod +x /django-entrypoint.sh

ENTRYPOINT ["/django-entrypoint.sh"]