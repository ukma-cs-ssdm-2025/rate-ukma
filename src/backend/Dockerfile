FROM python:3.12

ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY . .

RUN pip install --no-cache-dir .

EXPOSE 8000

COPY django-entrypoint.sh /django-entrypoint.sh
RUN chmod +x /django-entrypoint.sh

ENTRYPOINT ["/django-entrypoint.sh"]