FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY pyproject.toml README.md ./
COPY telar ./telar
RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["uvicorn", "telar.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
