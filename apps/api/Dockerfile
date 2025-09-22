FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY src ./src
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN pip install --upgrade pip setuptools wheel \
    && pip install .

RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["uvicorn", "proof_of_play_api.main:app", "--host", "0.0.0.0", "--port", "8080"]
