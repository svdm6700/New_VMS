"""
VMS - Centralized Structured Logging System
Supports separate log channels stored under storage/logs/:
- backend.log
- system.log
- errors.log
- document_processing.log
- bulk_processing.log
- pdf_export.log
- frontend.log

Features:
- Thread-safe rotating file handlers (10MB, 5 backups)
- Sensitive data redaction (passwords, tokens, keys)
- Structured JSON formatting & standard console output
- Configurable log levels via environment variables
"""

import os
import re
import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Base Storage Directory
STORAGE_BASE = Path(__file__).resolve().parent.parent / "storage"
LOGS_DIR = STORAGE_BASE / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Log rotation settings
MAX_LOG_BYTES = int(os.getenv("LOG_MAX_BYTES", 10 * 1024 * 1024)) # 10 MB
LOG_BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", 5))
LOG_LEVEL_NAME = os.getenv("LOG_LEVEL", "INFO").upper()
DEFAULT_LOG_LEVEL = getattr(logging, LOG_LEVEL_NAME, logging.INFO)

# Sensitive fields to redact
SENSITIVE_KEYS = {
    "password", "new_password", "confirm_password", "current_password",
    "token", "access_token", "refresh_token", "secret", "secret_key",
    "authorization", "api_key", "credentials"
}

def redact_sensitive_data(data: Any) -> Any:
    """Recursively redact passwords, tokens, and secrets from dictionaries/lists/strings."""
    if isinstance(data, dict):
        clean_dict = {}
        for k, v in data.items():
            if str(k).lower() in SENSITIVE_KEYS:
                clean_dict[k] = "[REDACTED]"
            elif isinstance(v, (dict, list)):
                clean_dict[k] = redact_sensitive_data(v)
            else:
                clean_dict[k] = v
        return clean_dict
    elif isinstance(data, list):
        return [redact_sensitive_data(item) for item in data]
    elif isinstance(data, str):
        # Redact Bearer tokens in headers
        data = re.sub(r'Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*', 'Bearer [REDACTED]', data)
        # Redact passwords in query parameters
        data = re.sub(r'(password|token|secret)=([^&]+)', r'\1=[REDACTED]', data, flags=re.IGNORECASE)
        return data
    return data

class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as clean structured JSON lines."""
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process_id": record.process,
            "thread_id": record.thread
        }
        
        # Attach correlation ID, document ID, etc. if present in record.__dict__
        if hasattr(record, "request_id"):
            log_entry["request_id"] = getattr(record, "request_id")
        if hasattr(record, "correlation_id"):
            log_entry["correlation_id"] = getattr(record, "correlation_id")
        if hasattr(record, "document_id"):
            log_entry["document_id"] = getattr(record, "document_id")
        if hasattr(record, "user_id"):
            log_entry["user_id"] = getattr(record, "user_id")
        if hasattr(record, "extra_data"):
            log_entry["extra_data"] = redact_sensitive_data(getattr(record, "extra_data"))
            
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_entry, ensure_ascii=False)

def _create_channel_logger(name: str, filename: str, level=DEFAULT_LOG_LEVEL) -> logging.Logger:
    """Create a configured logger channel that writes to storage/logs/<filename>."""
    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.propagate = False # Avoid duplicate logs in root logger
    
    # Check if handlers already exist to avoid duplicates
    if not logger.handlers:
        file_path = LOGS_DIR / filename
        handler = RotatingFileHandler(
            filename=str(file_path),
            maxBytes=MAX_LOG_BYTES,
            backupCount=LOG_BACKUP_COUNT,
            encoding="utf-8"
        )
        handler.setLevel(level)
        handler.setFormatter(StructuredJsonFormatter())
        logger.addHandler(handler)
        
        # Also log errors to errors.log if this isn't already the errors logger
        if filename != "errors.log":
            error_path = LOGS_DIR / "errors.log"
            err_handler = RotatingFileHandler(
                filename=str(error_path),
                maxBytes=MAX_LOG_BYTES,
                backupCount=LOG_BACKUP_COUNT,
                encoding="utf-8"
            )
            err_handler.setLevel(logging.ERROR)
            err_handler.setFormatter(StructuredJsonFormatter())
            logger.addHandler(err_handler)
            
    return logger

# Dedicated Log Channels
backend_logger = _create_channel_logger("backend", "backend.log")
system_logger = _create_channel_logger("system", "system.log")
errors_logger = _create_channel_logger("errors", "errors.log", level=logging.ERROR)
doc_proc_logger = _create_channel_logger("document_processing", "document_processing.log")
bulk_proc_logger = _create_channel_logger("bulk_processing", "bulk_processing.log")
pdf_export_logger = _create_channel_logger("pdf_export", "pdf_export.log")
frontend_logger = _create_channel_logger("frontend", "frontend.log")

def log_event(channel_logger: logging.Logger, level: str, message: str, **kwargs: Any):
    """Helper to log structured events with extra fields."""
    lvl = getattr(logging, level.upper(), logging.INFO)
    extra = {"extra_data": kwargs}
    for k in ["request_id", "correlation_id", "document_id", "user_id"]:
        if k in kwargs:
            extra[k] = kwargs.pop(k)
    channel_logger.log(lvl, message, extra=extra)
