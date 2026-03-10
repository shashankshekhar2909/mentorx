FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir --upgrade pip

COPY pyproject.toml /app/pyproject.toml

RUN pip install --no-cache-dir \
    fastapi>=0.111 \
    uvicorn[standard]>=0.30 \
    sqlalchemy>=2.0 \
    alembic>=1.13 \
    pydantic>=2.7 \
    pydantic-settings>=2.3 \
    python-jose[cryptography]>=3.3 \
    passlib[bcrypt]>=1.7 \
    python-multipart>=0.0.9 \
    httpx>=0.27 \
    redis>=5.0 \
    boto3>=1.34 \
    google-api-python-client>=2.130 \
    google-auth>=2.30 \
    google-auth-oauthlib>=1.2 \
    openai>=1.35 \
    livekit-api>=0.8.1 \
    email-validator>=2.1

COPY app /app/app

EXPOSE 8000

CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
