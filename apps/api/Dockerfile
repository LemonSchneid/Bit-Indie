FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src

RUN pip install --upgrade pip setuptools wheel \
    && pip install .

EXPOSE 8080

CMD ["uvicorn", "proof_of_play_api.main:app", "--host", "0.0.0.0", "--port", "8080"]
