import os
import sys
from pathlib import Path
from typing import List, Union, Optional
from urllib.parse import quote_plus
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine base paths
# config.py is at backend/app/core/config.py
# backend dir is parent of parent of parent
CORE_DIR = Path(__file__).resolve().parent
APP_DIR = CORE_DIR.parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

ENV_FILE_PATHS = (
    str(BACKEND_DIR / ".env"),
    str(PROJECT_ROOT / ".env"),
    ".env",
)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE_PATHS,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

    # 1. Application Info & Branding
    APP_NAME: str = "VMS"
    APP_FULL_NAME: str = "Voter Management System"
    APP_SHORT_NAME: str = "VMS"
    APP_TAGLINE: str = "Smart Voter Data Extraction & Management System"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = 8000
    APP_VERSION: str = "1.0.0"

    # 2. PostgreSQL Connection (psycopg 3)
    DATABASE_URL: Optional[str] = None
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "vms_database"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_ECHO: bool = False

    # 3. Authentication & Security
    JWT_SECRET_KEY: str = "vms_production_secret_key_change_me_super_secure_329487"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_HASH_ALGORITHM: str = "argon2"
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # 4. Initial Admin Credentials
    INITIAL_ADMIN_NAME: str = "System Administrator"
    INITIAL_ADMIN_EMAIL: str = "admin@example.com"
    INITIAL_ADMIN_USERNAME: str = "admin"
    INITIAL_ADMIN_PASSWORD: str = "Admin@12345"

    # 5. PDF Upload Settings
    PDF_UPLOAD_DIR: str = "storage/uploads"
    PDF_MAX_SIZE_MB: int = 300
    PDF_ALLOWED_EXTENSIONS: str = ".pdf"
    PDF_AUTO_PROCESS: bool = True
    PDF_KEEP_ORIGINAL: bool = True
    PDF_DUPLICATE_CHECK: bool = True

    # 6. OCR Configuration
    OCR_ENABLED: bool = True
    OCR_ENGINE: str = "tesseract"
    OCR_LANGUAGES: str = "tel+eng"
    OCR_DPI: int = 300
    OCR_MIN_CONFIDENCE: float = 60.0
    OCR_PARALLEL_WORKERS: int = 2

    # 7. Ollama Integration (Optional)
    OLLAMA_ENABLED: bool = False
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_TIMEOUT: int = 120
    OLLAMA_TEMPERATURE: float = 0.2
    OLLAMA_MAX_RETRIES: int = 2

    # 8. Storage Directories
    STORAGE_TYPE: str = "local"
    STORAGE_BASE_DIR: str = "storage"
    STORAGE_UPLOAD_DIR: str = "storage/uploads"
    STORAGE_TEMP_DIR: str = "storage/temp"
    STORAGE_EXPORT_DIR: str = "storage/exports"

    # 9. CORS Configuration
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    CORS_ALLOW_CREDENTIALS: bool = True

    # 10. Logging Configuration
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "logs"
    LOG_FILE: str = "application.log"
    LOG_MAX_SIZE_MB: int = 10
    LOG_BACKUP_COUNT: int = 5

    # 11. Background Processing
    PROCESSING_MAX_WORKERS: int = 2
    PROCESSING_POLL_INTERVAL_SECONDS: int = 3
    PROCESSING_RETRY_COUNT: int = 2
    PROCESSING_TIMEOUT_SECONDS: int = 600

    @property
    def database_url(self) -> str:
        """Construct or return PostgreSQL SQLAlchemy database URL using psycopg 3 driver."""
        if self.DATABASE_URL and self.DATABASE_URL.strip():
            url = self.DATABASE_URL.strip()
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+psycopg://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+psycopg://", 1)
            return url
        encoded_pass = quote_plus(self.DB_PASSWORD)
        return (
            f"postgresql+psycopg://{self.DB_USER}:{encoded_pass}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def admin_database_url(self) -> str:
        """Connection URL to maintenance 'postgres' database for auto DB creation."""
        encoded_pass = quote_plus(self.DB_PASSWORD)
        return (
            f"postgresql+psycopg://{self.DB_USER}:{encoded_pass}@"
            f"{self.DB_HOST}:{self.DB_PORT}/postgres"
        )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list of strings."""
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    def resolve_path(self, relative_path: str) -> Path:
        """Resolve a storage or data path relative to project root or backend."""
        p = Path(relative_path)
        if p.is_absolute():
            return p
        return PROJECT_ROOT / p

    def ensure_directories(self) -> None:
        """Ensure all storage, logs, and upload directories exist."""
        dirs_to_create = [
            self.resolve_path(self.STORAGE_BASE_DIR),
            self.resolve_path(self.STORAGE_UPLOAD_DIR),
            self.resolve_path(self.STORAGE_TEMP_DIR),
            self.resolve_path(self.STORAGE_EXPORT_DIR),
            self.resolve_path(self.PDF_UPLOAD_DIR),
            self.resolve_path(self.LOG_DIR),
        ]
        for d in dirs_to_create:
            d.mkdir(parents=True, exist_ok=True)

# Instantiate the centralized settings singleton
settings = Settings()
settings.ensure_directories()
