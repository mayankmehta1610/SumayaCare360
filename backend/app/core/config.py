from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://sumaya:sumaya_secure_2026@localhost:5432/sumayacare360"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Render Postgres may provide postgres:// or postgresql:// — SQLAlchemy needs psycopg2 driver.
        if isinstance(value, str):
            if value.startswith("postgres://"):
                return value.replace("postgres://", "postgresql+psycopg2://", 1)
            if value.startswith("postgresql://"):
                return value.replace("postgresql://", "postgresql+psycopg2://", 1)
        return value
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "sumaya-care-360-dev-jwt-secret-change-in-prod"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    app_env: str = "development"
    seed_on_start: bool = True
    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "sumaya"
    s3_secret_key: str = "sumaya_minio_2026"
    s3_bucket: str = "sumaya-docs"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
