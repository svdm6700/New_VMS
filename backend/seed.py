import sys
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy.orm import Session

_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.core.config import settings
from backend.database import init_db, SessionLocal, UserModel, RoleModel, DocumentModel
from backend.security import hash_password

def seed_database():
    """CLI seed script to initialize roles and initial Admin user from settings."""
    init_db()
    db: Session = SessionLocal()
    try:
        # Seed Roles
        for role_name, desc in [("admin", "Administrator with full system privileges"), ("user", "Standard User")]:
            existing_role = db.query(RoleModel).filter(RoleModel.role_name == role_name).first()
            if not existing_role:
                db.add(RoleModel(role_name=role_name, description=desc))
        db.commit()

        # Seed Initial Admin Account from settings
        admin_email = settings.INITIAL_ADMIN_EMAIL
        admin_username = settings.INITIAL_ADMIN_USERNAME
        admin_password = settings.INITIAL_ADMIN_PASSWORD
        admin_name = settings.INITIAL_ADMIN_NAME

        admin_user = db.query(UserModel).filter(
            (UserModel.email == admin_email) | (UserModel.username == admin_username)
        ).first()

        if not admin_user:
            admin_user = UserModel(
                full_name=admin_name,
                email=admin_email,
                username=admin_username,
                password_hash=hash_password(admin_password),
                role="admin",
                is_active=True,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print(f"[Seed] Created default Admin: username='{admin_username}', email='{admin_email}'")
        else:
            print(f"[Seed] Admin user '{admin_user.username}' already exists. Preserving existing account.")

        # Associate unassigned existing documents to Admin and set default location if missing
        existing_docs = db.query(DocumentModel).all()
        for d in existing_docs:
            if d.uploaded_by is None and admin_user:
                d.uploaded_by = admin_user.id
            if not d.district:
                d.district = "పశ్చిమ గోదావరి (West Godavari)"
            if not d.constituency:
                d.constituency = "తాడేపల్లిగూడెం (Tadepalligudem)"
            if not d.area:
                d.area = "రామచంద్రపురం (Ramachandrapuram)"
            if not d.ward_number:
                d.ward_number = "2"
        db.commit()
        print("[Seed] Seed process completed successfully.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
