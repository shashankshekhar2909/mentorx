from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True)

    app_name: str = "mentorXAI API"
    environment: str = "development"
    api_prefix: str = "/api"
    app_public_url: str | None = None
    cors_origins: str = "http://localhost:3000,http://localhost:3002"
    secret_key: str = Field(default="change-me")
    access_token_exp_minutes: int = 30
    refresh_token_exp_days: int = 7

    database_url: str = "sqlite:///./exammentor.db"

    redis_url: str = "redis://redis:6379/0"

    s3_endpoint: str = "http://minio:9000"
    s3_public_endpoint: str | None = None
    s3_access_key: str = "minio"
    s3_secret_key: str = "minio123"
    s3_bucket: str = "exammentor"
    s3_region: str = "us-east-1"
    s3_force_path_style: bool = True
    s3_auto_create_bucket: bool = False

    livekit_url: str = "http://livekit:7880"
    livekit_public_url: str | None = None
    livekit_api_key: str = "devkey"
    livekit_api_secret: str = "devsecret"

    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_refresh_token: str | None = None
    google_token_uri: str = "https://oauth2.googleapis.com/token"

    openai_api_key: str | None = None

    litellm_base_url: str = "http://litellm:4000/v1"
    litellm_api_key: str = "change-me"
    default_chat_model: str = "groq/llama-3.3-70b-versatile"

    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None


settings = Settings()
