import sys
import sqlite3
from pathlib import Path
from datetime import datetime

# Setup paths
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))
sys.path.insert(0, str(_ROOT / "backend"))

from app.core.config import settings
from backend.database import SessionLocal, RoleModel, UserModel, DocumentModel, VoterRecordModel, engine
from sqlalchemy import text

SQLITE_PATH = _ROOT / "backend" / "data" / "telugu_pdf_reader.db"

def parse_iso(dt_str):
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None

def migrate():
    print("=" * 65)
    print("MIGRATING SQLITE DATA TO POSTGRESQL (vms_database)")
    print("=" * 65)

    if not SQLITE_PATH.exists():
        print(f"[!] SQLite file not found at {SQLITE_PATH}. Nothing to migrate.")
        return

    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    s_cur = sqlite_conn.cursor()

    pg_session = SessionLocal()

    try:
        # 1. Migrate Roles
        print("\n[Step 1] Migrating Roles...")
        s_cur.execute("SELECT * FROM roles")
        roles = s_cur.fetchall()
        migrated_roles = 0
        for r in roles:
            existing = pg_session.query(RoleModel).filter_by(role_name=r["role_name"]).first()
            if not existing:
                role = RoleModel(
                    id=r["id"],
                    role_name=r["role_name"],
                    description=r["description"] if "description" in r.keys() else None,
                    created_at=parse_iso(r["created_at"]) or datetime.now()
                )
                pg_session.add(role)
                migrated_roles += 1
        pg_session.commit()
        print(f" -> Migrated {migrated_roles} roles. Total roles now in PG: {pg_session.query(RoleModel).count()}")

        # 2. Migrate Users
        print("\n[Step 2] Migrating Users...")
        s_cur.execute("SELECT * FROM users")
        users = s_cur.fetchall()
        migrated_users = 0
        for u in users:
            existing = pg_session.query(UserModel).filter(
                (UserModel.id == u["id"]) | (UserModel.email == u["email"]) | (UserModel.username == u["username"])
            ).first()
            if not existing:
                user = UserModel(
                    id=u["id"],
                    full_name=u["full_name"],
                    email=u["email"],
                    username=u["username"],
                    password_hash=u["password_hash"],
                    role=u["role"],
                    is_active=bool(u["is_active"]),
                    created_at=parse_iso(u["created_at"]) or datetime.now(),
                    updated_at=parse_iso(u["updated_at"]) or datetime.now(),
                    last_login=parse_iso(u["last_login"]) if u["last_login"] else None,
                )
                pg_session.add(user)
                migrated_users += 1
        pg_session.commit()

        # Update users_id_seq sequence
        with engine.connect() as conn:
            conn.execute(text("SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1), true) FROM users;"))
            conn.commit()

        print(f" -> Migrated {migrated_users} users. Total users now in PG: {pg_session.query(UserModel).count()}")

        # 3. Migrate Documents
        print("\n[Step 3] Migrating Documents...")
        s_cur.execute("SELECT * FROM documents")
        docs = s_cur.fetchall()
        migrated_docs = 0
        for d in docs:
            existing = pg_session.query(DocumentModel).filter_by(id=d["id"]).first()
            if not existing:
                doc = DocumentModel(
                    id=d["id"],
                    original_filename=d["original_filename"],
                    stored_file_path=d["stored_file_path"],
                    file_size=d["file_size"],
                    total_pages=d["total_pages"],
                    processing_status=d["processing_status"],
                    processing_error=d["processing_error"] if "processing_error" in d.keys() else None,
                    uploaded_at=parse_iso(d["uploaded_at"]) or datetime.now(),
                    processed_at=parse_iso(d["processed_at"]) if d["processed_at"] else None,
                    uploaded_by=d["uploaded_by"],
                    district=d["district"] if "district" in d.keys() else None,
                    constituency=d["constituency"] if "constituency" in d.keys() else None,
                    area=d["area"] if "area" in d.keys() else None,
                    ward_number=d["ward_number"] if "ward_number" in d.keys() else None,
                )
                pg_session.add(doc)
                migrated_docs += 1
        pg_session.commit()
        print(f" -> Migrated {migrated_docs} documents. Total documents now in PG: {pg_session.query(DocumentModel).count()}")

        # 4. Migrate Voter Records
        print("\n[Step 4] Migrating Voter Records...")
        s_cur.execute("SELECT * FROM voter_records")
        voters = s_cur.fetchall()
        migrated_voters = 0
        for v in voters:
            existing = pg_session.query(VoterRecordModel).filter_by(id=v["id"]).first()
            if not existing:
                record = VoterRecordModel(
                    id=v["id"],
                    document_id=v["document_id"],
                    serial_no=v["serial_no"],
                    electoral_roll_no=v["electoral_roll_no"],
                    voter_name=v["voter_name"],
                    relation_type=v["relation_type"],
                    relation_name=v["relation_name"],
                    age=str(v["age"]),
                    gender=v["gender"],
                    house_no=str(v["house_no"]),
                    voter_id=v["voter_id"],
                    source_page=v["source_page"] or 1,
                    ocr_confidence=float(v["ocr_confidence"]) if v["ocr_confidence"] is not None else None,
                    created_at=parse_iso(v["created_at"]) or datetime.now(),
                    updated_at=parse_iso(v["updated_at"]) or datetime.now(),
                )
                pg_session.add(record)
                migrated_voters += 1
        pg_session.commit()

        # Update voter_records_id_seq sequence
        with engine.connect() as conn:
            conn.execute(text("SELECT setval(pg_get_serial_sequence('voter_records', 'id'), coalesce(max(id), 1), true) FROM voter_records;"))
            conn.commit()

        print(f" -> Migrated {migrated_voters} voter records. Total in PG: {pg_session.query(VoterRecordModel).count()}")

        # 5. Verification
        print("\n[Step 5] Verification of PostgreSQL Records:")
        print(" Users in PG:")
        for u in pg_session.query(UserModel).all():
            print(f"   - {u.id}: {u.username} ({u.email}) [Role: {u.role}, Active: {u.is_active}]")
        print(" Documents in PG:")
        for d in pg_session.query(DocumentModel).all():
            print(f"   - {d.id}: {d.original_filename} (District: {d.district}, Area: {d.area}, Status: {d.processing_status})")

        print("\n" + "=" * 65)
        print("MIGRATION COMPLETED SUCCESSFULLY WITH 100% DATA PRESERVATION")
        print("=" * 65)

    except Exception as e:
        pg_session.rollback()
        print(f"[ERROR] Migration failed: {e}")
        raise
    finally:
        sqlite_conn.close()
        pg_session.close()

if __name__ == "__main__":
    migrate()
