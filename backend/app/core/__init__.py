try:
    from backend.app.core.config import settings
except ImportError:
    from app.core.config import settings

__all__ = ["settings"]

