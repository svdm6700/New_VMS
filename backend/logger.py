"""
VMS - Centralized Structured Logging System
Supports separate log channels stored under storage/logs/:
- backend_DDMMYY.log
- system_DDMMYY.log
- errors_DDMMYY.log
- document_processing_DDMMYY.log
- bulk_processing_DDMMYY.log
- pdf_export_DDMMYY.log
- frontend_DDMMYY.log
- document_deletion_DDMMYY.log

Features:
- Thread-safe daily rotating file handlers (DDMMYY filename format)
- Sensitive data redaction (passwords, tokens, keys)
- Structured JSON formatting & standard console output
- Configurable log levels via environment variables
- Flexible log_event() supports both Logger and string channel names
"""

import os
import re
import json
import logging
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Union

# Base Storage Directory
STORAGE_BASE = Path(__file__).resolve().parent.parent / "storage"
LOGS_DIR = STORAGE_BASE / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Log rotation settings
MAX_LOG_BYTES = int(os.getenv("LOG_MAX_BYTES", 10 * 1024 * 1024))  # 10 MB
LOG_BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", 30))
LOG_LEVEL_NAME = os.getenv("LOG_LEVEL", "INFO").upper()
DEFAULT_LOG_LEVEL = getattr(logging, LOG_LEVEL_NAME, logging.INFO)

# Timezone for log filenames (IST = UTC+5:30)
LOG_TIMEZONE = timezone(timedelta(hours=5, minutes=30))

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


def _get_dated_filename(base_name: str) -> str:
    """Return log filename with DDMMYY date suffix. E.g. 'backend_241126.log'"""
    now = datetime.now(LOG_TIMEZONE)
    date_str = now.strftime("%d%m%y")
    return f"{base_name}_{date_str}.log"


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as clean structured JSON lines."""
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(LOG_TIMEZONE).isoformat(),
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
            ed = getattr(record, "extra_data")
            if ed:
                log_entry["extra_data"] = redact_sensitive_data(ed)

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, ensure_ascii=False, default=str)


class DailyRotatingHandler(logging.Handler):
    """
    A handler that writes to a dated file (DDMMYY format).
    Automatically switches to a new file when the date changes.
    Thread-safe via locks inherited from logging.Handler.
    """
    def __init__(self, base_name: str, max_bytes: int = MAX_LOG_BYTES, encoding: str = "utf-8"):
        super().__init__()
        self.base_name = base_name
        self.max_bytes = max_bytes
        self.encoding = encoding
        self._current_date: Optional[str] = None
        self._stream = None

    def _get_current_path(self) -> Path:
        return LOGS_DIR / _get_dated_filename(self.base_name)

    def _open_stream(self):
        path = self._get_current_path()
        date_str = datetime.now(LOG_TIMEZONE).strftime("%d%m%y")
        if self._stream and self._current_date == date_str:
            return
        if self._stream:
            try:
                self._stream.close()
            except Exception:
                pass
        self._stream = open(path, "a", encoding=self.encoding)
        self._current_date = date_str

    def emit(self, record: logging.LogRecord):
        try:
            self._open_stream()
            msg = self.format(record)
            self._stream.write(msg + "\n")
            self._stream.flush()
        except Exception:
            self.handleError(record)

    def close(self):
        if self._stream:
            try:
                self._stream.close()
            except Exception:
                pass
        super().close()


def _create_channel_logger(name: str, base_name: str, level=DEFAULT_LOG_LEVEL) -> logging.Logger:
    """Create a configured logger channel that writes to storage/logs/<base_name>_DDMMYY.log."""
    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.propagate = False  # Avoid duplicate logs in root logger

    # Check if handlers already exist to avoid duplicates
    if not logger.handlers:
        handler = DailyRotatingHandler(base_name)
        handler.setLevel(level)
        handler.setFormatter(StructuredJsonFormatter())
        logger.addHandler(handler)

        # Also log errors to errors_DDMMYY.log if this isn't already the errors logger
        if base_name != "errors":
            err_handler = DailyRotatingHandler("errors")
            err_handler.setLevel(logging.ERROR)
            err_handler.setFormatter(StructuredJsonFormatter())
            logger.addHandler(err_handler)

        # Also write to legacy static filename for backward compatibility
        static_path = LOGS_DIR / f"{base_name}.log"
        static_handler = RotatingFileHandler(
            filename=str(static_path),
            maxBytes=MAX_LOG_BYTES,
            backupCount=5,
            encoding="utf-8"
        )
        static_handler.setLevel(level)
        static_handler.setFormatter(StructuredJsonFormatter())
        logger.addHandler(static_handler)

    return logger


# Dedicated Log Channels
backend_logger = _create_channel_logger("backend", "backend")
system_logger = _create_channel_logger("system", "system")
errors_logger = _create_channel_logger("errors", "errors", level=logging.ERROR)
doc_proc_logger = _create_channel_logger("document_processing", "document_processing")
bulk_proc_logger = _create_channel_logger("bulk_processing", "bulk_processing")
pdf_export_logger = _create_channel_logger("pdf_export", "pdf_export")
frontend_logger = _create_channel_logger("frontend", "frontend")
doc_deletion_logger = _create_channel_logger("document_deletion", "document_deletion")

# Channel name → Logger mapping for string-based lookups
_CHANNEL_MAP: Dict[str, logging.Logger] = {
    "backend": backend_logger,
    "system": system_logger,
    "errors": errors_logger,
    "error": errors_logger,
    "document_processing": doc_proc_logger,
    "doc_proc": doc_proc_logger,
    "bulk_processing": bulk_proc_logger,
    "pdf_export": pdf_export_logger,
    "frontend": frontend_logger,
    "document_deletion": doc_deletion_logger,
    "doc_deletion": doc_deletion_logger,
}


def log_event(channel_or_logger: Union[logging.Logger, str], *args: Any, **kwargs: Any):
    """
    Flexible helper to log structured events with extra fields.

    Supports multiple calling patterns:
        log_event(logger_obj, "INFO", "Message", key=val)        # original 3-arg style
        log_event("pdf_export", "Message", level="INFO", ...)    # string channel + message
        log_event("errors", "Message", level="ERROR", ...)       # string channel with level kwarg
        log_event(logger_obj, "Message")                         # logger + message (level defaults to INFO)
    """
    # Resolve logger from string or use the passed Logger object
    if isinstance(channel_or_logger, str):
        logger_obj = _CHANNEL_MAP.get(channel_or_logger)
        if logger_obj is None:
            logger_obj = logging.getLogger(channel_or_logger)
    else:
        logger_obj = channel_or_logger

    # Extract level from kwargs if provided
    level_kwarg = kwargs.pop("level", None)
    extra_data_kwarg = kwargs.pop("extra_data", None)

    # Determine level and message from positional args
    if len(args) >= 2:
        first_arg = str(args[0]).upper()
        # Check if first positional arg looks like a log level
        if first_arg in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL", "WARN"):
            level_str = first_arg
            msg_str = str(args[1])
        else:
            # First arg is the message, second arg is extra (treat level from kwarg)
            level_str = (level_kwarg or "INFO").upper()
            msg_str = str(args[0])
    elif len(args) == 1:
        msg_str = str(args[0])
        level_str = (level_kwarg or "INFO").upper()
    else:
        msg_str = kwargs.pop("message", "")
        level_str = (level_kwarg or "INFO").upper()

    lvl = getattr(logging, level_str, logging.INFO)

    # Build extra dict
    extra_fields = {}
    if extra_data_kwarg and isinstance(extra_data_kwarg, dict):
        extra_fields.update(extra_data_kwarg)
    extra_fields.update(kwargs)

    extra = {"extra_data": extra_fields}
    for k in ["request_id", "correlation_id", "document_id", "user_id"]:
        if k in extra_fields:
            extra[k] = extra_fields[k]

    logger_obj.log(lvl, msg_str, extra=extra)
