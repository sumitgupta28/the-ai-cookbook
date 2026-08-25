from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed application configuration with typed defaults."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,
    )

    app_name: str = Field(default="The AI Cookbook", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    app_profile: str = Field(default="local", alias="APP_PROFILE")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    app_cors_origins: str = Field(default="http://localhost:3000", alias="APP_CORS_ORIGINS")
    app_max_upload_mb: int = Field(default=50, alias="APP_MAX_UPLOAD_MB")

    ai_chat_provider: Literal["anthropic"] = Field(default="anthropic", alias="AI_CHAT_PROVIDER")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(default="claude-sonnet-4-6", alias="ANTHROPIC_MODEL")
    anthropic_temperature: float = Field(default=0.7, alias="ANTHROPIC_TEMPERATURE")

    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="ragdb", alias="DB_NAME")
    db_user: str = Field(default="postgres", alias="DB_USER")
    db_password: str = Field(default="postgres", alias="DB_PASSWORD")

    rag_mode: str = Field(default="soft", alias="RAG_MODE")
    rag_top_k: int = Field(default=5, alias="RAG_TOP_K")
    rag_similarity_threshold: float = Field(default=0.0, alias="RAG_SIMILARITY_THRESHOLD")
    chunking_tiny_threshold: int = Field(default=600, alias="CHUNKING_TINY_THRESHOLD")
    chunking_small_threshold: int = Field(default=3000, alias="CHUNKING_SMALL_THRESHOLD")
    embedding_dimensions: int = Field(default=384, alias="EMBEDDING_DIMENSIONS")

    @property
    def cors_origin_list(self) -> list[str]:
        """Return configured CORS origins as a trimmed list."""
        return [origin.strip() for origin in self.app_cors_origins.split(",") if origin.strip()]

    @property
    def upload_max_bytes(self) -> int:
        """Convert the configured upload limit from megabytes to bytes."""
        return self.app_max_upload_mb * 1024 * 1024

    @property
    def database_url(self) -> str:
        """Build the SQLAlchemy PostgreSQL connection URL."""
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
