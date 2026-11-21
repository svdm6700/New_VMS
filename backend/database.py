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
    Index
)
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

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
