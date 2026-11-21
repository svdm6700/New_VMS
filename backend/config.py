import sys
from pathlib import Path

# Ensure backend directory is in sys.path so 'app.core.config' is importable directly
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.core.config import settings

__all__ = ["settings"]
