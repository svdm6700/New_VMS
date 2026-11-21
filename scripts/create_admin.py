#!/usr/bin/env python3
import sys
import os
from pathlib import Path

_BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BASE))

from backend.seed import seed_database

if __name__ == "__main__":
    print("Initializing Telugu PDF Reader Database and Admin User...")
    seed_database()
    print("Database seeding completed.")
