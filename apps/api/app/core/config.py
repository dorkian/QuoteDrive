from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "QuoteDrive API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Database
    POSTGRES_USER: str = "quotedrive"
    POSTGRES_PASSWORD: str = "quotedrive_dev_password"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "quotedrive"

    # Demo auth (local development only — not production auth, see AGENTS.md)
    JWT_SECRET_KEY: str = "demo-insecure-secret-change-if-this-ever-leaves-localhost"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # AI provider (see AGENTS.md: "Use FakeProvider for automated AI tests")
    AI_PROVIDER: Literal["fake", "openrouter", "ollama"] = "fake"
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    AI_REQUEST_TIMEOUT_SECONDS: float = 30.0

    @property
    def DATABASE_URL(self) -> str:
        # Name the driver explicitly: a bare postgresql:// resolves to psycopg2 on
        # SQLAlchemy 2.0 but to psycopg (v3, not installed) on 2.1+.
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


settings = Settings()
