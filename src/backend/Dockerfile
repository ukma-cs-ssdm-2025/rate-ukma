FROM python:3.12

ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

COPY django-entrypoint.sh /django-entrypoint.sh
RUN chmod +x /django-entrypoint.sh

ENTRYPOINT ["/django-entrypoint.sh"]