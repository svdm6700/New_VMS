"""
VMS - Permanent 5-Character Alphanumeric Unique Key Generator
Format: Exactly 5 characters, Uppercase A-Z and digits 0-9.
Keyspace: 36^5 = 60,466,176 possible unique combinations.
Cryptographically secure generation using python's secrets module.
"""

import string
import secrets
from typing import Set, List
from sqlalchemy.orm import Session
from sqlalchemy import text

# Allowed character set: Exactly uppercase letters A-Z and numbers 0-9 (36 chars)
KEY_CHARACTERS = string.ascii_uppercase + string.digits
KEY_LENGTH = 5

def generate_random_key() -> str:
    """Generate a single cryptographically secure 5-character alphanumeric key."""
    return "".join(secrets.choice(KEY_CHARACTERS) for _ in range(KEY_LENGTH))

def is_valid_unique_key(key: str) -> bool:
    """Validate whether key is exactly 5 uppercase alphanumeric characters."""
    if not key or not isinstance(key, str):
        return False
    return len(key) == KEY_LENGTH and all(c in KEY_CHARACTERS for c in key)

def generate_unique_voter_key(db: Session, max_attempts: int = 100) -> str:
    """
    Generate a permanent 5-character unique key, validating against existing database records.
    Retries automatically in the extremely rare event of a collision.
    """
    from backend.database import VoterRecordModel

    for _ in range(max_attempts):
        candidate = generate_random_key()
        # Fast indexed lookup for collision check
        exists = db.query(VoterRecordModel.id).filter(VoterRecordModel.unique_key == candidate).first()
        if not exists:
            return candidate

    raise RuntimeError("Failed to generate a collision-free 5-character unique key after multiple attempts.")

def generate_bulk_unique_keys(db: Session, count: int, existing_in_batch: Set[str] = None) -> List[str]:
    """
    Generate multiple unique 5-character keys with zero collisions within the batch
    and against all existing records in the database.
    """
    from backend.database import VoterRecordModel

    if count <= 0:
        return []

    # Load existing keys from database for quick set membership lookup.
    # Use a column-only query (no full ORM load) so this scales to 100,000+ records without memory issues.
    db_keys: Set[str] = set()
    rows = db.execute(
        __import__("sqlalchemy").text("SELECT unique_key FROM voter_records WHERE unique_key IS NOT NULL")
    ).fetchall()
    for (k,) in rows:
        if k:
            db_keys.add(k)

    if existing_in_batch:
        db_keys.update(existing_in_batch)

    generated: List[str] = []
    while len(generated) < count:
        candidate = generate_random_key()
        if candidate not in db_keys:
            db_keys.add(candidate)
            generated.append(candidate)

    return generated

def backfill_missing_unique_keys(db: Session) -> int:
    """
    Backfills permanent 5-character unique keys for any voter records in PostgreSQL
    that do not currently have a valid key. Preserves existing valid keys.
    """
    from backend.database import VoterRecordModel

    # Find voters with missing or empty unique_key
    missing_voters = db.query(VoterRecordModel).filter(
        (VoterRecordModel.unique_key.is_(None)) | (VoterRecordModel.unique_key == "")
    ).all()

    if not missing_voters:
        return 0

    count = len(missing_voters)
    keys = generate_bulk_unique_keys(db, count)

    for voter, key in zip(missing_voters, keys):
        voter.unique_key = key

    db.commit()
    print(f"[VMS Unique Key] Successfully backfilled {count} voter records with permanent 5-character unique keys.")
    return count
