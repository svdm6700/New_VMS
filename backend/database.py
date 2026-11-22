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
    Numeric,
    Date,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    Index,
    JSON,
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
    is_system = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    permissions = relationship("RolePermissionModel", back_populates="role", cascade="all, delete-orphan")
    user_roles = relationship("UserRoleModel", back_populates="role", cascade="all, delete-orphan")

    def to_dict(self, include_permissions=True):
        res = {
            "id": self.id,
            "role_name": self.role_name,
            "description": self.description,
            "is_system": self.is_system,
            "users_count": len(self.user_roles) if self.user_roles is not None else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_permissions:
            res["permissions"] = [rp.permission.code for rp in self.permissions if rp.permission]
        return res

class PermissionModel(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    module = Column(String(64), nullable=False, index=True) # voters, voter_entries, documents, users, settings
    action = Column(String(32), nullable=False) # view, create, edit, delete
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "module": self.module,
            "action": self.action,
            "description": self.description,
        }

class RolePermissionModel(Base):
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    role = relationship("RoleModel", back_populates="permissions")
    permission = relationship("PermissionModel")

    __table_args__ = (
        Index("idx_role_perm_unique", "role_id", "permission_id", unique=True),
    )

class UserRoleModel(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("UserModel", back_populates="user_roles")
    role = relationship("RoleModel", back_populates="user_roles")

    __table_args__ = (
        Index("idx_user_role_unique", "user_id", "role_id", unique=True),
    )

class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(128), nullable=False, index=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("UserModel")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else "System",
            "action": self.action,
            "details": self.details,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
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
    user_roles = relationship("UserRoleModel", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        role_names = [ur.role.role_name for ur in self.user_roles if ur.role] if self.user_roles else [self.role]
        if not role_names:
            role_names = [self.role]
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "username": self.username,
            "role": self.role,
            "roles": role_names,
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
    entries = relationship("VoterEntryModel", back_populates="voter", cascade="all, delete-orphan", order_by="desc(VoterEntryModel.created_at)")
    payments = relationship("PaymentModel", back_populates="voter", order_by="desc(PaymentModel.payment_date)")
    amount_allocations = relationship("VoterAmountAllocationModel", back_populates="voter", cascade="all, delete-orphan", order_by="desc(VoterAmountAllocationModel.allocation_date)")

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
            "entries_count": len(self.entries) if self.entries is not None else 0,
            "latest_mobile": self.entries[0].mobile_number if self.entries and len(self.entries) > 0 else None,
            "total_amount": sum(float(e.amount or 0) for e in self.entries) if self.entries else 0.0,
            "payments_count": len(self.payments) if self.payments is not None else 0,
            "total_paid_amount": sum(float(p.amount or 0) for p in self.payments if p.payment_status == "Paid") if self.payments else 0.0,
            "total_pending_amount": sum(float(p.amount or 0) for p in self.payments if p.payment_status == "Pending") if self.payments else 0.0,
            "allocations_count": len(self.amount_allocations) if self.amount_allocations is not None else 0,
            "total_allocated_amount": sum(float(a.amount or 0) for a in self.amount_allocations if a.status == "ACTIVE") if self.amount_allocations is not None else 0.0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

class VoterEntryModel(Base):
    __tablename__ = "voter_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(64), unique=True, nullable=True, index=True)
    voter_id = Column(Integer, ForeignKey("voter_records.id", ondelete="CASCADE"), nullable=False, index=True)
    mobile_number = Column(String(15), nullable=True, default="", index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    entry_date = Column(Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    payment_method = Column(String(32), default="Cash", nullable=False, index=True) # Cash, UPI, Bank Transfer, Other
    payment_status = Column(String(32), default="Paid", nullable=False, index=True) # Paid, Pending, Failed, Cancelled
    remarks = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    voter = relationship("VoterRecordModel", back_populates="entries")
    creator = relationship("UserModel")
    payments = relationship("PaymentModel", back_populates="voter_entry")

    def to_dict(self):
        txn_id = self.transaction_id or f"TXN-{self.id:06d}"
        voter_doc = self.voter.document if self.voter else None
        return {
            "id": self.id,
            "transaction_id": txn_id,
            "voter_id": self.voter_id,
            "voter_name": self.voter.voter_name if self.voter else "Not Available",
            "epic_no": self.voter.voter_id if self.voter else "Not Available",
            "relation_name": self.voter.relation_name if self.voter else "Not Available",
            "house_no": self.voter.house_no if self.voter else "Not Available",
            "district": getattr(voter_doc, "district", None) or "Not Available",
            "constituency": getattr(voter_doc, "constituency", None) or "Not Available",
            "area": getattr(voter_doc, "area", None) or "Not Available",
            "ward_number": getattr(voter_doc, "ward_number", None) or "Not Available",
            "mobile_number": self.mobile_number,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "entry_date": self.entry_date.isoformat() if self.entry_date else None,
            "payment_method": self.payment_method or "Cash",
            "payment_status": self.payment_status or "Paid",
            "remarks": self.remarks or "",
            "created_by": self.created_by,
            "creator_name": self.creator.full_name if self.creator else "System",
            "creator_username": self.creator.username if self.creator else "system",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

class PaymentModel(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(64), unique=True, nullable=False, index=True)
    receipt_number = Column(String(64), unique=True, nullable=False, index=True)
    voter_id = Column(Integer, ForeignKey("voter_records.id", ondelete="SET NULL"), nullable=True, index=True)
    voter_entry_id = Column(Integer, ForeignKey("voter_entries.id", ondelete="SET NULL"), nullable=True, index=True)
    mobile_number = Column(String(15), nullable=True, default="", index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False, index=True)
    payment_method = Column(String(32), default="Cash", nullable=False, index=True) # Cash, UPI, Bank Transfer, Other
    payment_status = Column(String(32), default="Paid", nullable=False, index=True) # Paid, Pending, Failed, Cancelled, Refunded
    transaction_reference = Column(String(128), nullable=True, index=True)
    remarks = Column(Text, nullable=True)
    voter_name = Column(String(512), nullable=True)
    epic_no = Column(String(128), nullable=True)
    district = Column(String(150), nullable=True)
    constituency = Column(String(150), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    voter = relationship("VoterRecordModel", back_populates="payments")
    voter_entry = relationship("VoterEntryModel", back_populates="payments")
    creator = relationship("UserModel", foreign_keys=[created_by])
    updater = relationship("UserModel", foreign_keys=[updated_by])
    verifier = relationship("UserModel", foreign_keys=[verified_by])
    audit_logs = relationship("PaymentAuditLogModel", back_populates="payment", cascade="all, delete-orphan", order_by="desc(PaymentAuditLogModel.performed_at)")

    def to_dict(self):
        voter_doc = self.voter.document if self.voter else None
        return {
            "id": self.id,
            "transaction_id": self.transaction_id,
            "receipt_number": self.receipt_number,
            "voter_id": self.voter_id,
            "voter_entry_id": self.voter_entry_id,
            "voter_name": (self.voter.voter_name if self.voter else self.voter_name) or "Not Available",
            "epic_no": (self.voter.voter_id if self.voter else self.epic_no) or "Not Available",
            "relation_name": (self.voter.relation_name if self.voter else None) or "Not Available",
            "relation_type": (self.voter.relation_type if self.voter else None) or "Not Available",
            "age": (self.voter.age if self.voter else None) or "Not Available",
            "gender": (self.voter.gender if self.voter else None) or "Not Available",
            "house_no": (self.voter.house_no if self.voter else None) or "Not Available",
            "district": (getattr(voter_doc, "district", None) or self.district) or "Not Available",
            "constituency": (getattr(voter_doc, "constituency", None) or self.constituency) or "Not Available",
            "area": getattr(voter_doc, "area", None) or "Not Available",
            "ward_number": getattr(voter_doc, "ward_number", None) or "Not Available",
            "mobile_number": self.mobile_number,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "payment_date": self.payment_date.isoformat() if self.payment_date else None,
            "payment_method": self.payment_method or "Cash",
            "payment_status": self.payment_status or "Paid",
            "transaction_reference": self.transaction_reference or "",
            "remarks": self.remarks or "",
            "created_by": self.created_by,
            "creator_name": self.creator.full_name if self.creator else "System",
            "creator_username": self.creator.username if self.creator else "system",
            "updated_by": self.updated_by,
            "updater_name": self.updater.full_name if self.updater else None,
            "verified_by": self.verified_by,
            "verifier_name": self.verifier.full_name if self.verifier else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

class PaymentAuditLogModel(Base):
    __tablename__ = "payment_audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(64), nullable=False, index=True) # CREATED, UPDATED, VERIFIED, CANCELLED, REFUNDED, DELETED
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    performed_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    payment = relationship("PaymentModel", back_populates="audit_logs")
    performer = relationship("UserModel", foreign_keys=[performed_by])

    def to_dict(self):
        return {
            "id": self.id,
            "payment_id": self.payment_id,
            "action": self.action,
            "old_values": self.old_values,
            "new_values": self.new_values,
            "reason": self.reason,
            "performed_by": self.performed_by,
            "performer_name": self.performer.full_name if self.performer else "System",
            "performer_username": self.performer.username if self.performer else "system",
            "performed_at": self.performed_at.isoformat() if self.performed_at else None,
        }

class WalletModel(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_type = Column(String(16), nullable=False, default="USER") # "ADMIN" or "USER"
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    available_balance = Column(Numeric(14, 2), default=0.00, nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    status = Column(String(16), default="ACTIVE", nullable=False) # "ACTIVE", "INACTIVE", "SUSPENDED"
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("UserModel")
    transactions = relationship("WalletTransactionModel", back_populates="wallet", cascade="all, delete-orphan", order_by="desc(WalletTransactionModel.created_at)")

    __table_args__ = (
        Index("idx_wallet_owner_unique", "owner_type", "owner_id", unique=True),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "owner_type": self.owner_type,
            "owner_id": self.owner_id,
            "owner_username": self.user.username if self.user else None,
            "owner_full_name": self.user.full_name if self.user else None,
            "available_balance": float(self.available_balance or 0.0),
            "currency": self.currency,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

class WalletTransactionModel(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(64), unique=True, index=True, nullable=False)
    wallet_id = Column(Integer, ForeignKey("wallets.id", ondelete="CASCADE"), index=True, nullable=False)
    transaction_type = Column(String(64), index=True, nullable=False)
    # Types: ADMIN_WALLET_CREDIT, ADMIN_TO_USER_ALLOCATION, USER_WALLET_CREDIT, VOTER_AMOUNT_DEBIT, TRANSACTION_REVERSAL, REFUND
    direction = Column(String(16), nullable=False) # "CREDIT" or "DEBIT"
    amount = Column(Numeric(14, 2), nullable=False)
    balance_before = Column(Numeric(14, 2), nullable=False)
    balance_after = Column(Numeric(14, 2), nullable=False)
    reference_type = Column(String(64), nullable=True) # "FUNDING", "USER_ALLOCATION", "VOTER_ALLOCATION", "REVERSAL"
    reference_id = Column(String(128), nullable=True)
    idempotency_key = Column(String(128), index=True, nullable=True)
    payment_method = Column(String(64), nullable=True) # Cash, Bank Transfer, NetBanking, Cheque, UPI
    remarks = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    wallet = relationship("WalletModel", back_populates="transactions")
    creator = relationship("UserModel", foreign_keys=[created_by])

    def to_dict(self):
        return {
            "id": self.id,
            "transaction_id": self.transaction_id,
            "wallet_id": self.wallet_id,
            "transaction_type": self.transaction_type,
            "direction": self.direction,
            "amount": float(self.amount or 0.0),
            "balance_before": float(self.balance_before or 0.0),
            "balance_after": float(self.balance_after or 0.0),
            "reference_type": self.reference_type,
            "reference_id": self.reference_id,
            "idempotency_key": self.idempotency_key,
            "payment_method": self.payment_method,
            "remarks": self.remarks,
            "created_by": self.created_by,
            "creator_username": self.creator.username if self.creator else "System",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class UserGeographicAssignmentModel(Base):
    __tablename__ = "user_geographic_assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    district = Column(String(150), nullable=False)
    constituency = Column(String(150), nullable=False)
    wards = Column(Text, nullable=False) # JSON list or comma-separated string, e.g. ["1", "2"]
    area = Column(String(200), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(32), default="ACTIVE", nullable=False) # "ACTIVE", "INACTIVE"
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("UserModel", foreign_keys=[user_id])
    assigner = relationship("UserModel", foreign_keys=[assigned_by])

    def to_dict(self):
        import json
        ward_list = []
        if self.wards:
            try:
                raw = self.wards.strip()
                ward_list = json.loads(raw) if raw.startswith("[") else [w.strip() for w in raw.split(",") if w.strip()]
            except Exception:
                ward_list = [w.strip() for w in self.wards.split(",") if w.strip()]
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_username": self.user.username if self.user else None,
            "user_full_name": self.user.full_name if self.user else None,
            "district": self.district,
            "constituency": self.constituency,
            "wards": ward_list,
            "wards_display": ", ".join(str(w) for w in ward_list),
            "area": self.area,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "assigned_by": self.assigned_by,
            "assigner_username": self.assigner.username if self.assigner else "Admin",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

class VoterAmountAllocationModel(Base):
    __tablename__ = "voter_amount_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    allocation_reference = Column(String(64), unique=True, index=True, nullable=False)
    voter_id = Column(Integer, ForeignKey("voter_records.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    wallet_transaction_id = Column(Integer, ForeignKey("wallet_transactions.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    allocation_date = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    status = Column(String(32), default="ACTIVE", nullable=False) # "ACTIVE", "REVERSED"
    remarks = Column(Text, nullable=True)
    reversal_reason = Column(Text, nullable=True)
    reversed_at = Column(DateTime(timezone=True), nullable=True)
    reversed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    voter = relationship("VoterRecordModel", foreign_keys=[voter_id], back_populates="amount_allocations")
    user = relationship("UserModel", foreign_keys=[user_id])
    wallet_transaction = relationship("WalletTransactionModel")
    reverser = relationship("UserModel", foreign_keys=[reversed_by])

    def to_dict(self):
        return {
            "id": self.id,
            "allocation_reference": self.allocation_reference,
            "voter_id": self.voter_id,
            "voter_name": self.voter.voter_name if self.voter else "N/A",
            "voter_epic": self.voter.voter_id if self.voter else "N/A",
            "house_no": self.voter.house_no if self.voter else "N/A",
            "district": (self.voter.document.district if self.voter and self.voter.document else "N/A"),
            "constituency": (self.voter.document.constituency if self.voter and self.voter.document else "N/A"),
            "ward_number": (self.voter.document.ward_number if self.voter and self.voter.document else "N/A"),
            "area": (self.voter.document.area if self.voter and self.voter.document else "N/A"),
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else (self.user.username if self.user else "N/A"),
            "user_username": self.user.username if self.user else "N/A",
            "wallet_transaction_id": self.wallet_transaction_id,
            "transaction_id": self.wallet_transaction.transaction_id if self.wallet_transaction else None,
            "amount": float(self.amount or 0.0),
            "allocation_date": self.allocation_date.isoformat() if self.allocation_date else None,
            "status": self.status,
            "remarks": self.remarks,
            "reversal_reason": self.reversal_reason,
            "reversed_at": self.reversed_at.isoformat() if self.reversed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
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
    """Automatically seed default permissions, system roles, and initial admin user if not present."""
    try:
        from backend.security import hash_password
    except ImportError:
        try:
            from security import hash_password
        except Exception:
            return

    db = SessionLocal()
    try:
        # 1. Seed All Module Permissions
        standard_permissions = [
            # Voters module
            ("voters.view", "voters", "view", "View voter records and search electoral rolls"),
            ("voters.create", "voters", "create", "Create new voter records"),
            ("voters.edit", "voters", "edit", "Edit voter record details"),
            ("voters.delete", "voters", "delete", "Delete voter records"),

            # Voter Entries & Amount module
            ("voter_entries.view", "voter_entries", "view", "View voter mobile and amount entries history"),
            ("voter_entries.create", "voter_entries", "create", "Record new mobile number and amount entries"),
            ("voter_entries.edit", "voter_entries", "edit", "Edit recorded voter entries"),
            ("voter_entries.delete", "voter_entries", "delete", "Delete recorded voter entries"),

            # Documents & Upload module
            ("documents.view", "documents", "view", "View uploaded PDF documents and processing status"),
            ("documents.create", "documents", "create", "Upload voter documents and run extraction"),
            ("documents.download", "documents", "download", "Download uploaded original PDF documents"),
            ("documents.reprocess", "documents", "reprocess", "Reprocess uploaded documents and re-extract voter rolls"),
            ("documents.delete", "documents", "delete", "Delete uploaded documents and cascade exclusive voter records"),

            # Users module
            ("users.view", "users", "view", "View system users and status"),
            ("users.create", "users", "create", "Create new system user accounts"),
            ("users.edit", "users", "edit", "Edit user profiles and credentials"),
            ("users.delete", "users", "delete", "Deactivate or delete user accounts"),

            # Settings & Roles module
            ("settings.view", "settings", "view", "View system settings and roles"),
            ("settings.edit", "settings", "edit", "Manage roles, permissions and system settings"),

            # Payments module
            ("payments.view", "payments", "view", "View Payments Dashboard and transaction records"),
            ("payments.create", "payments", "create", "Record new voter payments"),
            ("payments.edit", "payments", "edit", "Edit payment details"),
            ("payments.verify", "payments", "verify", "Verify pending payments to paid status"),
            ("payments.cancel", "payments", "cancel", "Cancel payment transactions"),
            ("payments.refund", "payments", "refund", "Process payment refunds"),
            ("payments.delete", "payments", "delete", "Delete payment records (authorized only)"),
            ("payments.export", "payments", "export", "Export payment ledger to Excel/CSV"),
            ("payments.print_receipt", "payments", "print_receipt", "Print and download official payment receipts"),

            # Wallet & Voter Allocation module
            ("wallet.view", "wallets", "view", "View Wallets and transaction records"),
            ("wallet.fund", "wallets", "create", "Fund and add money to Admin Wallet"),
            ("wallet.allocate", "wallets", "edit", "Allocate wallet money from Admin to Users"),
            ("wallet.assign_voter", "wallets", "create", "Assign and deduct wallet amount for authorized voters"),
            ("wallet.reverse", "wallets", "delete", "Reverse voter amount allocations and refund wallet"),
            ("geo.view", "geo_assignments", "view", "View geographic constituency and ward assignments"),
            ("geo.manage", "geo_assignments", "edit", "Manage user constituency and ward assignments"),
        ]

        code_to_perm_id = {}
        for code, module, action, desc in standard_permissions:
            perm = db.query(PermissionModel).filter(PermissionModel.code == code).first()
            if not perm:
                perm = PermissionModel(code=code, module=module, action=action, description=desc)
                db.add(perm)
                db.flush()
            code_to_perm_id[code] = perm.id
        db.commit()

        # 2. Seed System Roles
        system_roles_defs = {
            "admin": {
                "desc": "System Administrator with full unrestricted access to all modules and system controls",
                "is_system": True,
                "perms": list(code_to_perm_id.keys()) # All permissions
            },
            "operator": {
                "desc": "Data Operator authorized to search voters, record entries, upload documents, and edit records",
                "is_system": True,
                "perms": [
                    "voters.view", "voters.create", "voters.edit",
                    "voter_entries.view", "voter_entries.create", "voter_entries.edit",
                    "payments.view", "payments.create", "payments.edit", "payments.print_receipt",
                    "wallet.view", "wallet.assign_voter", "geo.view",
                    "documents.view", "documents.create",
                    "settings.view"
                ]
            },
            "viewer": {
                "desc": "Read-only Viewer with view-only permissions across voters, entries and documents",
                "is_system": True,
                "perms": [
                    "voters.view",
                    "voter_entries.view",
                    "payments.view", "payments.print_receipt",
                    "wallet.view", "geo.view",
                    "documents.view",
                    "settings.view"
                ]
            },
            "user": {
                "desc": "Standard User with standard search, entry, payment and upload capabilities",
                "is_system": True,
                "perms": [
                    "voters.view",
                    "voter_entries.view", "voter_entries.create",
                    "payments.view", "payments.create", "payments.print_receipt",
                    "wallet.view", "wallet.assign_voter", "geo.view",
                    "documents.view", "documents.create",
                    "settings.view"
                ]
            }
        }

        role_name_to_role = {}
        for r_name, r_info in system_roles_defs.items():
            role_obj = db.query(RoleModel).filter(RoleModel.role_name.ilike(r_name)).first()
            if not role_obj:
                role_obj = RoleModel(
                    role_name=r_name,
                    description=r_info["desc"],
                    is_system=r_info["is_system"],
                    created_at=utcnow(),
                    updated_at=utcnow()
                )
                db.add(role_obj)
                db.flush()
                print(f"[VMS RBAC] Created system role: '{r_name}'")
            else:
                role_obj.is_system = r_info["is_system"]
                if not role_obj.description:
                    role_obj.description = r_info["desc"]
                db.flush()
            role_name_to_role[r_name.lower()] = role_obj

            # Ensure permissions are assigned to this role
            existing_rp_ids = {
                rp.permission_id for rp in db.query(RolePermissionModel).filter(RolePermissionModel.role_id == role_obj.id).all()
            }
            for perm_code in r_info["perms"]:
                p_id = code_to_perm_id.get(perm_code)
                if p_id and p_id not in existing_rp_ids:
                    db.add(RolePermissionModel(role_id=role_obj.id, permission_id=p_id, created_at=utcnow()))
        db.commit()

        # 3. Check / create initial admin account
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
            db.refresh(admin_user)
            print(f"[VMS Database] Created initial admin user: username='{settings.INITIAL_ADMIN_USERNAME}'")

        # 4. Map all existing users to user_roles table
        admin_role = role_name_to_role.get("admin")
        user_role = role_name_to_role.get("user")
        all_users = db.query(UserModel).all()
        for u in all_users:
            assigned = db.query(UserRoleModel).filter(UserRoleModel.user_id == u.id).first()
            if not assigned:
                target_role = admin_role if u.role.lower() == "admin" else user_role
                if target_role:
                    db.add(UserRoleModel(user_id=u.id, role_id=target_role.id, created_at=utcnow()))
        db.commit()

        # 5. Initial Audit Log
        if db.query(AuditLogModel).count() == 0:
            db.add(AuditLogModel(
                user_id=admin_user.id if admin_user else None,
                action="SYSTEM_INIT_RBAC",
                details="Initial RBAC system tables, permissions, and roles initialized successfully.",
                ip_address="127.0.0.1",
                created_at=utcnow()
            ))
            db.commit()

        # 6. Initial Seed/Migration of Payments from Voter Entries
        if db.query(PaymentModel).count() == 0:
            existing_entries = db.query(VoterEntryModel).all()
            for entry in existing_entries:
                t_id = entry.transaction_id or f"TXN-20261122-{entry.id:04d}"
                r_id = f"RCP-20261122-{entry.id:04d}"
                payment = PaymentModel(
                    transaction_id=t_id,
                    receipt_number=r_id,
                    voter_id=entry.voter_id,
                    voter_entry_id=entry.id,
                    mobile_number=entry.mobile_number,
                    amount=entry.amount,
                    payment_date=entry.entry_date,
                    payment_method=entry.payment_method or "Cash",
                    payment_status=entry.payment_status or "Paid",
                    transaction_reference=f"REF-{entry.id:06d}" if (entry.payment_method or "Cash") != "Cash" else None,
                    remarks=entry.remarks or "Migrated from existing voter entry record",
                    created_by=entry.created_by,
                    verified_by=entry.created_by if (entry.payment_status or "Paid") == "Paid" else None,
                    verified_at=entry.created_at if (entry.payment_status or "Paid") == "Paid" else None,
                    created_at=entry.created_at,
                    updated_at=entry.updated_at
                )
                db.add(payment)
                db.flush()
                db.add(PaymentAuditLogModel(
                    payment_id=payment.id,
                    action="CREATED",
                    new_values=payment.to_dict(),
                    reason="Migrated from existing voter entry",
                    performed_by=entry.created_by,
                    performed_at=entry.created_at
                ))
            db.commit()
            if existing_entries:
                print(f"[VMS Payments] Seeded {len(existing_entries)} initial payments from voter entries.")

        # 7. Ensure Admin Wallet exists
        if admin_user:
            admin_wallet = db.query(WalletModel).filter(
                WalletModel.owner_type == "ADMIN",
                WalletModel.owner_id == admin_user.id
            ).first()
            if not admin_wallet:
                admin_wallet = WalletModel(
                    owner_type="ADMIN",
                    owner_id=admin_user.id,
                    available_balance=0.00,
                    currency="INR",
                    status="ACTIVE",
                    created_at=utcnow(),
                    updated_at=utcnow()
                )
                db.add(admin_wallet)
                db.commit()
                print(f"[VMS Wallet] Initialized master Admin Wallet for user '{admin_user.username}'.")

        print("[VMS RBAC] Seed permissions, roles, and user mappings verified successfully.")

    except Exception as e:
        db.rollback()
        print(f"[VMS Database Warning] Note during RBAC seed check: {e}")
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
