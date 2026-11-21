import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    BigInteger,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    Index,
    text
)
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

# Ensure backend directory is in sys.path
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.core.config import settings

# PostgreSQL Engine using psycopg 3 and connection pooling from settings
engine = create_engine(
    settings.database_url,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    echo=settings.DB_ECHO,
    connect_args={"client_encoding": "utf8"}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def utcnow():
    return datetime.now(timezone.utc)

class RoleModel(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_name = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "role_name": self.role_name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), default="user", nullable=False, index=True) # "admin" or "user"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    documents = relationship("DocumentModel", back_populates="uploader")

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "username": self.username,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "documents_count": len(self.documents) if self.documents is not None else 0
        }

class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(String(64), primary_key=True, index=True)
    original_filename = Column(String(512), nullable=False)
    stored_file_path = Column(String(1024), nullable=False)
    file_size = Column(BigInteger, default=0)
    total_pages = Column(Integer, default=0)
    processing_status = Column(String(32), default="uploaded", index=True) # uploaded, processing, completed, failed
    processing_error = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # User ownership
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    uploader = relationship("UserModel", back_populates="documents")

    # Manual Location Metadata (District, Constituency, Area, Ward)
    district = Column(String(150), nullable=True, index=True)
    constituency = Column(String(150), nullable=True, index=True)
    area = Column(String(200), nullable=True, index=True)
    ward_number = Column(String(50), nullable=True, index=True)

    records = relationship("VoterRecordModel", back_populates="document", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "original_filename": self.original_filename,
            "stored_file_path": self.stored_file_path,
            "file_size": self.file_size,
            "total_pages": self.total_pages,
            "processing_status": self.processing_status,
            "processing_error": self.processing_error,
            "district": self.district or "Not Available",
            "constituency": self.constituency or "Not Available",
            "area": self.area or "Not Available",
            "ward_number": self.ward_number or "Not Available",
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "uploaded_by": self.uploaded_by,
            "uploader_name": self.uploader.full_name if self.uploader else "System / Admin",
            "records_count": len(self.records) if self.records is not None else 0
        }

class VoterRecordModel(Base):
    __tablename__ = "voter_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(64), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    serial_no = Column(String(64), nullable=False, default="Not Available", index=True)
    electoral_roll_no = Column(String(128), default="Not Available")
    voter_name = Column(String(512), default="Not Available")
    relation_type = Column(String(128), default="Not Available")
    relation_name = Column(String(512), default="Not Available")
    age = Column(String(32), default="Not Available")
    gender = Column(String(64), default="Not Available")
    house_no = Column(String(128), default="Not Available")
    voter_id = Column(String(128), default="Not Available", index=True)
    source_page = Column(Integer, default=1)
    ocr_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    document = relationship("DocumentModel", back_populates="records")

    __table_args__ = (
        Index("idx_voter_doc_serial", "document_id", "serial_no"),
        Index("idx_voter_doc_voter_id", "document_id", "voter_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "serial_no": self.serial_no,
            "electoral_roll_no": self.electoral_roll_no,
            "voter_name": self.voter_name,
            "relation_type": self.relation_type,
            "relation_name": self.relation_name,
            "age": self.age,
            "gender": self.gender,
            "house_no": self.house_no,
            "voter_id": self.voter_id,
            "source_page": self.source_page,
            "ocr_confidence": self.ocr_confidence,
            "district": getattr(self.document, "district", None) if self.document and self.document.district else "Not Available",
            "constituency": getattr(self.document, "constituency", None) if self.document and self.document.constituency else "Not Available",
            "area": getattr(self.document, "area", None) if self.document and self.document.area else "Not Available",
            "ward_number": getattr(self.document, "ward_number", None) if self.document and self.document.ward_number else "Not Available",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

def ensure_database_exists():
    """
    Connects to the default PostgreSQL maintenance database ('postgres')
    and creates the target database (settings.DB_NAME) with UTF-8 encoding
    if it does not already exist.
    """
    try:
        target_url = make_url(settings.database_url)
        target_db = target_url.database or settings.DB_NAME

        # Admin connection to default maintenance db 'postgres'
        admin_url = target_url.set(database="postgres")
        admin_engine = create_engine(
            admin_url,
            isolation_level="AUTOCOMMIT",
            connect_args={"client_encoding": "utf8"}
        )
        with admin_engine.connect() as conn:
            query = text("SELECT 1 FROM pg_database WHERE datname = :dbname")
            exists = conn.execute(query, {"dbname": target_db}).scalar()
            if not exists:
                print(f"[VMS Database] Target database '{target_db}' does not exist on PostgreSQL.")
                print(f"[VMS Database] Automatically creating database '{target_db}' with UTF-8 encoding...")
                sanitized_name = target_db.replace('"', '""')
                conn.execute(text(f'CREATE DATABASE "{sanitized_name}" WITH ENCODING \'UTF8\' TEMPLATE template1'))
                print(f"[VMS Database] Database '{target_db}' successfully created.")
            else:
                print(f"[VMS Database] Database '{target_db}' verified (exists).")
        admin_engine.dispose()
    except Exception as e:
        print(f"[VMS Database] Notice during database existence verification: {e}")

def ensure_tables_exist():
    """Ensure all SQLAlchemy metadata tables and indexes are created automatically."""
    try:
        Base.metadata.create_all(bind=engine)
        print("[VMS Database] Tables verified/created successfully.")
    except Exception as e:
        print(f"[VMS Database Error] Failed to create tables: {e}")
        raise

def ensure_default_seed():
    """Automatically seed default roles and initial admin user if not present."""
    try:
        from backend.security import hash_password
    except ImportError:
        try:
            from security import hash_password
        except Exception:
            return

    db = SessionLocal()
    try:
        # Check / create roles
        roles_to_seed = [
            ("admin", "Administrator with full system privileges"),
            ("user", "Standard User")
        ]
        for role_name, desc in roles_to_seed:
            existing = db.query(RoleModel).filter(RoleModel.role_name == role_name).first()
            if not existing:
                db.add(RoleModel(role_name=role_name, description=desc))
                print(f"[VMS Database] Created default role: {role_name}")
        db.commit()

        # Check / create initial admin account
        admin_user = db.query(UserModel).filter(
            (UserModel.username == settings.INITIAL_ADMIN_USERNAME) | 
            (UserModel.email == settings.INITIAL_ADMIN_EMAIL)
        ).first()

        if not admin_user:
            admin_user = UserModel(
                full_name=settings.INITIAL_ADMIN_NAME,
                email=settings.INITIAL_ADMIN_EMAIL,
                username=settings.INITIAL_ADMIN_USERNAME,
                password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
                role="admin",
                is_active=True,
                created_at=utcnow(),
                updated_at=utcnow()
            )
            db.add(admin_user)
            db.commit()
            print(f"[VMS Database] Created initial admin user: username='{settings.INITIAL_ADMIN_USERNAME}'")
    except Exception as e:
        db.rollback()
        print(f"[VMS Database Warning] Note during seed check: {e}")
    finally:
        db.close()

def init_db():
    """
    Main database initializer:
    1. Automatically creates database if it does not exist.
    2. Automatically creates all tables and indexes if they do not exist.
    3. Automatically seeds initial roles and admin user if they do not exist.
    """
    print(f"[VMS Database] Initializing database '{settings.DB_NAME}' on {settings.DB_HOST}:{settings.DB_PORT}...")
    ensure_database_exists()
    ensure_tables_exist()
    ensure_default_seed()
    print("[VMS Database] Database and tables are ready.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Automatically ensure database and tables exist on module load
try:
    init_db()
except Exception as _e:
    print(f"[VMS Database] Deferred initial auto-creation on module load: {_e}")

if __name__ == "__main__":
    from sqlalchemy import inspect
    print("=" * 60)
    print("VMS Database Initialization & Status Check")
    print("=" * 60)
    init_db()
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"[VMS Database] Verified Tables in '{settings.DB_NAME}': {tables}")
    
    _db = SessionLocal()
    try:
        user_cnt = _db.query(UserModel).count()
        doc_cnt = _db.query(DocumentModel).count()
        voter_cnt = _db.query(VoterRecordModel).count()
        print(f"[VMS Database] Users count: {user_cnt}")
        print(f"[VMS Database] Documents count: {doc_cnt}")
        print(f"[VMS Database] Extracted Voter Records count: {voter_cnt}")
    finally:
        _db.close()
    print("=" * 60)
