import sys
import uuid
from uuid import uuid4
import json
import os
import re
import csv
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional, List
from io import BytesIO, StringIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter

# Ensure both project root and backend directory are in sys.path
_BASE_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _BASE_DIR.parent
for _p in [str(_PROJECT_ROOT), str(_BASE_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Query,
    BackgroundTasks,
    Depends,
    status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc, text, func, case, and_

try:
    from app.core.config import settings
except ImportError:
    from backend.app.core.config import settings

try:
    from backend.database import (
        init_db, get_db, SessionLocal, DocumentModel, VoterRecordModel,
        UserModel, RoleModel, VoterEntryModel, PermissionModel,
        RolePermissionModel, UserRoleModel, AuditLogModel,
        PaymentModel, PaymentAuditLogModel,
        WalletModel, WalletTransactionModel, UserGeographicAssignmentModel,
        VoterAmountAllocationModel, DistrictModel, ConstituencyModel, WardModel
    )
    from backend.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
    from backend.auth_deps import (
        get_current_user, get_optional_current_user, require_admin, get_user_permissions, require_permission,
        is_super_admin, is_admin, is_admin_or_super, require_super_admin, require_roles
    )
    from backend.processor import process_pdf
    from backend.excel import create_excel
    from backend.seed import seed_database
    from backend.pdf_generator import generate_voters_a4_pdf
    from backend.photo_service import get_voter_photo_path
except ImportError:
    from database import (
        init_db, get_db, SessionLocal, DocumentModel, VoterRecordModel,
        UserModel, RoleModel, VoterEntryModel, PermissionModel,
        RolePermissionModel, UserRoleModel, AuditLogModel,
        PaymentModel, PaymentAuditLogModel,
        WalletModel, WalletTransactionModel, UserGeographicAssignmentModel,
        VoterAmountAllocationModel, DistrictModel, ConstituencyModel, WardModel
    )
    from security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
    from auth_deps import (
        get_current_user, get_optional_current_user, require_admin, get_user_permissions, require_permission,
        is_super_admin, is_admin, is_admin_or_super, require_super_admin, require_roles
    )
    from processor import process_pdf
    from excel import create_excel
    from seed import seed_database
    from pdf_generator import generate_voters_a4_pdf
    from photo_service import get_voter_photo_path

# Initialize database & seed initial admin (only if not already created)
seed_database()

# Centralized storage configuration via settings
STORAGE_BASE_DIR = settings.resolve_path(settings.STORAGE_BASE_DIR)
UPLOAD_DIR = settings.resolve_path(settings.PDF_UPLOAD_DIR)
RESULTS_DIR = STORAGE_BASE_DIR / "results"
TEMP_DIR = settings.resolve_path(settings.STORAGE_TEMP_DIR)
EXPORT_DIR = settings.resolve_path(settings.STORAGE_EXPORT_DIR)

# Legacy directories for seamless backward compatibility
DATA_DIR = _BASE_DIR / "data"
LEGACY_FILES_DIR = DATA_DIR / "files"
LEGACY_RESULTS_DIR = DATA_DIR / "results"

for _d in [STORAGE_BASE_DIR, UPLOAD_DIR, RESULTS_DIR, TEMP_DIR, EXPORT_DIR, DATA_DIR, LEGACY_FILES_DIR, LEGACY_RESULTS_DIR]:
    _d.mkdir(parents=True, exist_ok=True)

def resolve_result_path(doc_id: str) -> Path:
    """Find result JSON in storage/results or fallback to legacy data/results."""
    p = RESULTS_DIR / f"{doc_id}.json"
    if p.exists():
        return p
    legacy_p = LEGACY_RESULTS_DIR / f"{doc_id}.json"
    if legacy_p.exists():
        return legacy_p
    return p

def resolve_pdf_path(stored_path: Optional[str], doc_id: str) -> Optional[Path]:
    """Find PDF file in stored path, storage/uploads, or legacy data/files."""
    if stored_path and Path(stored_path).exists():
        return Path(stored_path)
    p = UPLOAD_DIR / f"{doc_id}.pdf"
    if p.exists():
        return p
    legacy_p = LEGACY_FILES_DIR / f"{doc_id}.pdf"
    if legacy_p.exists():
        return legacy_p
    return None

app = FastAPI(
    title=f"{settings.APP_SHORT_NAME} - {settings.APP_FULL_NAME}",
    description=settings.APP_TAGLINE,
    version=settings.APP_VERSION
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=(
        r"^https?://("
        r"localhost|"
        r"127\.0\.0\.1|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
        r")(:\d+)?$"
    ),
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Pydantic Schemas
# -------------------------------------------------------------
class LoginRequest(BaseModel):
    username_or_email: str
    password: str
    remember_me: Optional[bool] = False

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class CreateUserRequest(BaseModel):
    full_name: str
    email: str
    username: str
    password: str
    role: Optional[str] = "user"
    is_active: Optional[bool] = True

class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UpdateStatusRequest(BaseModel):
    is_active: bool

class UpdateRoleRequest(BaseModel):
    role: str

class VoterRecordUpdate(BaseModel):
    serial_no: Optional[str] = None
    electoral_roll_no: Optional[str] = None
    voter_name: Optional[str] = None
    relation_type: Optional[str] = None
    relation_name: Optional[str] = None
    age: Optional[str] = None
    gender: Optional[str] = None
    house_no: Optional[str] = None
    voter_id: Optional[str] = None
    source_page: Optional[int] = None

class VoterEntryCreate(BaseModel):
    voter_id: int
    mobile_number: Optional[str] = ""
    amount: float
    entry_date: Optional[str] = None
    payment_method: Optional[str] = "Cash"
    payment_status: Optional[str] = "Paid"
    remarks: Optional[str] = None

class VoterEntryUpdate(BaseModel):
    mobile_number: Optional[str] = None
    amount: Optional[float] = None
    entry_date: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    remarks: Optional[str] = None

class PaymentCreateRequest(BaseModel):
    voter_id: int
    voter_entry_id: Optional[int] = None
    mobile_number: Optional[str] = ""
    amount: float
    payment_date: Optional[str] = None
    payment_method: str = "Cash" # Cash, UPI, Bank Transfer, Other
    payment_status: str = "Paid" # Paid, Pending, Failed, Cancelled, Refunded
    transaction_reference: Optional[str] = None
    remarks: Optional[str] = None

class PaymentUpdateRequest(BaseModel):
    mobile_number: Optional[str] = None
    amount: Optional[float] = None
    payment_date: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    transaction_reference: Optional[str] = None
    remarks: Optional[str] = None

class PaymentActionReasonRequest(BaseModel):
    reason: str

def number_to_words_inr(num: float) -> str:
    """Convert number to Indian Rupee words (Crores, Lakhs, Thousands, Hundreds)."""
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def _two_digits(n: int) -> str:
        if n == 0:
            return ""
        if n < 20:
            return ones[n]
        return tens[n // 10] + (" " + ones[n % 10] if n % 10 != 0 else "")

    def _three_digits(n: int) -> str:
        h = n // 100
        rem = n % 100
        res = ""
        if h > 0:
            res += ones[h] + " Hundred"
            if rem > 0:
                res += " and "
        if rem > 0:
            res += _two_digits(rem)
        return res

    integer_part = int(num)
    decimal_part = int(round((num - integer_part) * 100))

    if integer_part == 0 and decimal_part == 0:
        return "Zero Rupees Only"

    crores = integer_part // 10000000
    rem = integer_part % 10000000
    lakhs = rem // 100000
    rem = rem % 100000
    thousands = rem // 1000
    rem = rem % 1000

    parts = []
    if crores > 0:
        parts.append(f"{_two_digits(crores)} Crore")
    if lakhs > 0:
        parts.append(f"{_two_digits(lakhs)} Lakh")
    if thousands > 0:
        parts.append(f"{_two_digits(thousands)} Thousand")
    if rem > 0:
        parts.append(_three_digits(rem))

    words = " ".join(parts).strip()
    result = f"Rupees {words}" if words else "Rupees"
    if decimal_part > 0:
        result += f" and {_two_digits(decimal_part)} Paise"
    result += " Only"
    return result

class RoleCreateRequest(BaseModel):
    role_name: str
    description: Optional[str] = None
    permission_codes: List[str] = []

class RoleUpdateRequest(BaseModel):
    description: Optional[str] = None
    permission_codes: Optional[List[str]] = None

class UserRoleAssignRequest(BaseModel):
    role_name: str

class ExportBody(BaseModel):
    result: Optional[dict[str, Any]] = None

# -------------------------------------------------------------
# Background Task Pipeline
# -------------------------------------------------------------
def run_background_extraction(
    doc_id: str,
    file_path: Path,
    filename: str,
    ollama_url: str,
    model_name: str,
    use_ai: bool
):
    db: Session = SessionLocal()
    try:
        with open(file_path, "rb") as f:
            data = f.read()

        result = process_pdf(data, filename, ollama_url, model_name, use_ai)
        result["id"] = doc_id

        res_path = RESULTS_DIR / f"{doc_id}.json"
        with open(res_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False)

        doc_obj = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
        if doc_obj:
            doc_obj.total_pages = result.get("metadata", {}).get("page_count", 0)

            # Delete previous records if reprocessed
            db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).delete()

            # Duplicate Voter Detection & Permanent 5-Character Unique Key Assignment
            from backend.unique_key import generate_bulk_unique_keys
            records_list = result.get("records", [])

            # Check if any voter in this batch already exists in PostgreSQL
            existing_epics = {}
            for r in records_list:
                f_dict = {f.get("field_name", "").strip(): str(f.get("value", "")).strip() for f in r.get("fields", [])}
                vid = f_dict.get("ఓటరు ఐడి కార్డు నెం.") or f_dict.get("గుర్తింపు కార్డు నెం.")
                if vid and vid != "Not Available":
                    existing_epics[vid] = None

            if existing_epics:
                found_voters = db.query(VoterRecordModel.voter_id, VoterRecordModel.unique_key).filter(
                    VoterRecordModel.voter_id.in_(list(existing_epics.keys())),
                    VoterRecordModel.unique_key.isnot(None),
                    VoterRecordModel.unique_key != ""
                ).all()
                for vid, ukey in found_voters:
                    if vid and ukey:
                        existing_epics[vid] = ukey

            fresh_keys = generate_bulk_unique_keys(db, len(records_list))
            fresh_key_idx = 0

            voter_objs = []
            for r in records_list:
                fields = {f.get("field_name", "").strip(): str(f.get("value", "")).strip() for f in r.get("fields", [])}

                sno = fields.get("గ్రా.పం.ఓ.జా.వ.సం.") or fields.get("వరుస సంఖ్య") or str(r.get("record_id", ""))
                roll = fields.get("అ.ఓ.జా.వ.సం.") or "Not Available"
                name = fields.get("ఓటరు పేరు") or fields.get("పేరు") or "Not Available"

                rel_type = "Not Available"
                rel_name = "Not Available"
                if "తండ్రి పేరు" in fields:
                    rel_type = "తండ్రి"
                    rel_name = fields["తండ్రి పేరు"]
                elif "భర్త పేరు" in fields:
                    rel_type = "భర్త"
                    rel_name = fields["భర్త పేరు"]
                elif "సంబంధం" in fields or "సంబంధిత వ్యక్తి పేరు" in fields:
                    rel_type = fields.get("సంబంధం", "Not Available")
                    rel_name = fields.get("సంబంధిత వ్యక్తి పేరు", "Not Available")

                age = fields.get("వయస్సు", "Not Available")
                gender = fields.get("లింగము", "Not Available")
                house = fields.get("ఇంటి సంఖ్య", "Not Available")
                voter_id = fields.get("ఓటరు ఐడి కార్డు నెం.") or fields.get("గుర్తింపు కార్డు నెం.") or "Not Available"
                source_page = r.get("page", 1)

                # Determine permanent unique key: reuse if confirmed duplicate, else use fresh key
                assigned_key = None
                if voter_id and voter_id != "Not Available" and existing_epics.get(voter_id):
                    assigned_key = existing_epics[voter_id]
                else:
                    assigned_key = fresh_keys[fresh_key_idx]
                    fresh_key_idx += 1

                voter_objs.append(VoterRecordModel(
                    document_id=doc_id,
                    serial_no=sno or "Not Available",
                    electoral_roll_no=roll or "Not Available",
                    voter_name=name or "Not Available",
                    relation_type=rel_type or "Not Available",
                    relation_name=rel_name or "Not Available",
                    age=age or "Not Available",
                    gender=gender or "Not Available",
                    house_no=house or "Not Available",
                    voter_id=voter_id or "Not Available",
                    unique_key=assigned_key,
                    source_page=source_page,
                    ocr_confidence=None,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                ))

            if voter_objs:
                db.bulk_save_objects(voter_objs)

            doc_obj.processing_status = "completed"
            doc_obj.processed_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as exc:
        db.rollback()
        doc_obj = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
        if doc_obj:
            doc_obj.processing_status = "failed"
            doc_obj.processing_error = str(exc)
            db.commit()
    finally:
        db.close()

# -------------------------------------------------------------
# 1. Health & System Configuration Status Endpoints
# -------------------------------------------------------------
@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1;"))
        db_status = f"Connected to PostgreSQL ({settings.DB_NAME})"
    except Exception as e:
        db_status = f"error: {e}"
    return {
        "app": settings.APP_SHORT_NAME,
        "name": settings.APP_FULL_NAME,
        "tagline": settings.APP_TAGLINE,
        "status": "ok",
        "database": db_status,
        "auth_enabled": True,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/api/admin/system/config-status", tags=["Admin System"])
def get_system_config_status(
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only endpoint returning safe configuration status information without exposing secrets."""
    try:
        db.execute(text("SELECT 1;"))
        db_status = "Connected"
    except Exception as e:
        db_status = f"Disconnected: {e}"

    storage_available = UPLOAD_DIR.exists() and os.access(str(UPLOAD_DIR), os.W_OK)

    return {
        "application_name": f"{settings.APP_SHORT_NAME} - {settings.APP_FULL_NAME}",
        "short_name": settings.APP_SHORT_NAME,
        "full_name": settings.APP_FULL_NAME,
        "tagline": settings.APP_TAGLINE,
        "environment": settings.APP_ENV,
        "version": settings.APP_VERSION,
        "database_connection_status": db_status,
        "database_engine": "PostgreSQL 16+ (psycopg 3)",
        "database_name": settings.DB_NAME,
        "database_host": settings.DB_HOST,
        "database_port": settings.DB_PORT,
        "ocr_enabled": settings.OCR_ENABLED,
        "ocr_engine": settings.OCR_ENGINE,
        "ocr_languages": settings.OCR_LANGUAGES,
        "ollama_enabled": settings.OLLAMA_ENABLED,
        "ollama_model": settings.OLLAMA_MODEL if settings.OLLAMA_ENABLED else "Disabled",
        "pdf_max_size_mb": settings.PDF_MAX_SIZE_MB,
        "pdf_auto_process": settings.PDF_AUTO_PROCESS,
        "storage_type": settings.STORAGE_TYPE,
        "storage_available": storage_available,
        "processing_max_workers": settings.PROCESSING_MAX_WORKERS,
        "log_level": settings.LOG_LEVEL,
    }

# -------------------------------------------------------------
# 2. Authentication Endpoints
# -------------------------------------------------------------
@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    identifier = req.username_or_email.strip().lower()
    user = db.query(UserModel).filter(
        (UserModel.email.ilike(identifier)) | (UserModel.username.ilike(identifier))
    ).first()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact an administrator.",
        )

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    access_delta = timedelta(days=7) if req.remember_me else timedelta(hours=8)
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role},
        expires_delta=access_delta
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "username": user.username}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user.to_dict()
    }

@app.post("/api/auth/logout")
def logout():
    return {"status": "ok", "message": "Successfully logged out."}

@app.post("/api/auth/refresh")
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(req.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid token type.")
        user_id = payload.get("sub")
        user = db.query(UserModel).filter(UserModel.id == int(user_id)).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="User account is inactive or not found.")

        new_access = create_access_token(
            data={"sub": str(user.id), "username": user.username, "role": user.role}
        )
        return {
            "access_token": new_access,
            "token_type": "bearer",
            "user": user.to_dict()
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token refresh failed: {e}")

@app.get("/api/auth/me")
def get_me(current_user: UserModel = Depends(get_current_user)):
    return current_user.to_dict()

@app.post("/api/auth/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    current_user.password_hash = hash_password(req.new_password)
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok", "message": "Password changed successfully."}

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email.ilike(req.email.strip())).first()
    if not user:
        return {"status": "ok", "message": "If this email is registered, password reset instructions have been generated."}

    reset_token = create_access_token(
        data={"sub": str(user.id), "purpose": "reset"},
        expires_delta=timedelta(minutes=15)
    )
    return {
        "status": "ok",
        "message": "Password reset token generated.",
        "reset_token": reset_token
    }

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(req.token)
        user_id = payload.get("sub")
        user = db.query(UserModel).filter(UserModel.id == int(user_id)).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        if len(req.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

        user.password_hash = hash_password(req.new_password)
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"status": "ok", "message": "Password has been reset successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid or expired reset token: {e}")

# -------------------------------------------------------------
# 3. Admin User Management Endpoints
# -------------------------------------------------------------
@app.post("/api/admin/users", status_code=status.HTTP_201_CREATED)
def admin_create_user(
    req: CreateUserRequest,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    email = req.email.strip().lower()
    username = req.username.strip().lower()

    if db.query(UserModel).filter(UserModel.email == email).first():
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
    if db.query(UserModel).filter(UserModel.username == username).first():
        raise HTTPException(status_code=400, detail="A user with this username already exists.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    req_role = req.role.lower().strip() if req.role else "user"
    if req_role in ("super_admin", "superadmin"):
        if not is_super_admin(current_admin):
            raise HTTPException(status_code=403, detail="Only Super Admin can create Super Admin accounts.")
        role = "super_admin"
    elif req_role == "admin":
        if not is_super_admin(current_admin):
            raise HTTPException(status_code=403, detail="Admins can only create standard User accounts. Super Admin role is required to create Admin accounts.")
        role = "admin"
    else:
        role = "user"

    new_user = UserModel(
        full_name=req.full_name.strip(),
        email=email,
        username=username,
        password_hash=hash_password(req.password),
        role=role,
        is_active=req.is_active,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user.to_dict()

@app.get("/api/admin/users")
def admin_list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    query: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    q = db.query(UserModel)
    if query:
        search_filter = or_(
            UserModel.full_name.ilike(f"%{query}%"),
            UserModel.email.ilike(f"%{query}%"),
            UserModel.username.ilike(f"%{query}%")
        )
        q = q.filter(search_filter)

    if role and role != "all":
        q = q.filter(UserModel.role == role.lower())

    if status and status != "all":
        is_act = (status.lower() == "active")
        q = q.filter(UserModel.is_active == is_act)

    total = q.count()
    users = q.order_by(desc(UserModel.created_at)).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 1,
        "users": [u.to_dict() for u in users]
    }

@app.get("/api/admin/users/{user_id}")
def admin_get_user(
    user_id: int,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    return u.to_dict()

@app.put("/api/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    req: UpdateUserRequest,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")

    # Privilege hierarchy enforcement
    if is_super_admin(u) and not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Admins cannot modify Super Admin accounts or privileges.")
    if is_admin(u) and not is_super_admin(current_admin) and user_id != current_admin.id:
        raise HTTPException(status_code=403, detail="Admins cannot modify other Administrator accounts.")

    if req.full_name is not None:
        u.full_name = req.full_name.strip()
    if req.email is not None:
        email = req.email.strip().lower()
        conflict = db.query(UserModel).filter(UserModel.email == email, UserModel.id != user_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Email is already in use by another account.")
        u.email = email
    if req.username is not None:
        username = req.username.strip().lower()
        conflict = db.query(UserModel).filter(UserModel.username == username, UserModel.id != user_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Username is already in use by another account.")
        u.username = username
    if req.role is not None:
        target_role = req.role.lower().strip()
        if not is_super_admin(current_admin):
            raise HTTPException(status_code=403, detail="Only Super Admin can change user roles.")
        if is_super_admin(u) and target_role not in ("super_admin", "superadmin"):
            super_count = db.query(UserModel).filter(UserModel.role.in_(["super_admin", "superadmin"]), UserModel.is_active == True).count()
            if super_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot demote the last active Super Administrator.")
        u.role = target_role
    if req.is_active is not None:
        if is_super_admin(u) and not req.is_active:
            super_count = db.query(UserModel).filter(UserModel.role.in_(["super_admin", "superadmin"]), UserModel.is_active == True).count()
            if super_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot deactivate the last active Super Administrator.")
        if user_id == current_admin.id and not req.is_active:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
        u.is_active = req.is_active
    if req.password:
        if len(req.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        u.password_hash = hash_password(req.password)

    u.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(u)
    return u.to_dict()

@app.patch("/api/admin/users/{user_id}/status")
def admin_toggle_user_status(
    user_id: int,
    req: UpdateStatusRequest,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if user_id == current_admin.id and not req.is_active:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")

    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")

    if is_super_admin(u) and not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Admins cannot modify Super Admin accounts.")
    if is_admin(u) and not is_super_admin(current_admin) and user_id != current_admin.id:
        raise HTTPException(status_code=403, detail="Admins cannot deactivate other Administrator accounts.")

    if is_super_admin(u) and not req.is_active:
        super_count = db.query(UserModel).filter(UserModel.role.in_(["super_admin", "superadmin"]), UserModel.is_active == True).count()
        if super_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot deactivate the last active Super Administrator.")

    u.is_active = req.is_active
    u.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok", "user_id": user_id, "is_active": u.is_active}

@app.patch("/api/admin/users/{user_id}/role")
def admin_change_user_role(
    user_id: int,
    req: UpdateRoleRequest,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Only Super Admin can change user roles.")

    role = req.role.lower().strip()
    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")

    if is_super_admin(u) and role not in ("super_admin", "superadmin"):
        super_count = db.query(UserModel).filter(UserModel.role.in_(["super_admin", "superadmin"]), UserModel.is_active == True).count()
        if super_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last active Super Administrator.")

    u.role = role
    u.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "ok", "user_id": user_id, "role": u.role}

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")

    if is_super_admin(u) and not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Admins cannot delete Super Admin accounts.")
    if is_admin(u) and not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Admins cannot delete other Administrator accounts.")

    if is_super_admin(u):
        super_count = db.query(UserModel).filter(UserModel.role.in_(["super_admin", "superadmin"])).count()
        if super_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last active Super Administrator.")

    # Reassign documents to current admin or null
    for d in u.documents:
        d.uploaded_by = current_admin.id

    db.delete(u)
    db.commit()
    return {"status": "deleted", "user_id": user_id}

# -------------------------------------------------------------
# 4. Document Upload & Automatic Extraction (With User Ownership)
# -------------------------------------------------------------
@app.post("/api/documents/upload", status_code=status.HTTP_201_CREATED)
@app.post("/api/documents/process")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    district: Optional[str] = Form(None),
    constituency: Optional[str] = Form(None),
    area: Optional[str] = Form(None),
    ward_number: Optional[str] = Form(None),
    ollama_url: Optional[str] = Query(None),
    model_name: Optional[str] = Query(None),
    use_ai: Optional[bool] = Query(None),
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    # 0. Role & Geographic Scope Authentication Validation
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials are required to upload voter documents."
        )

    if not is_admin_or_super(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Document upload is restricted to Super Admin and Admin only. Standard users cannot upload voter documents."
        )

    # 1. Validate all manual location fields
    clean_district = (district or "").strip()
    clean_constituency = (constituency or "").strip()
    clean_area = (area or "").strip()
    clean_ward = (ward_number or "").strip()

    if not clean_district:
        raise HTTPException(status_code=400, detail="District (జిల్లా) is required.")
    if not clean_constituency:
        raise HTTPException(status_code=400, detail="Constituency (నియోజకవర్గం) is required.")
    if not clean_area:
        raise HTTPException(status_code=400, detail="Area / Village (ప్రాంతం / గ్రామం) is required.")
    if not clean_ward:
        raise HTTPException(status_code=400, detail="Ward Number (వార్డు నంబర్) is required.")

    # Geographic restriction check for Admin role
    if not is_super_admin(current_user):
        import json
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()

        if not admin_assignments:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have any active geographic assignment to upload documents."
            )

        authorized = False
        for a in admin_assignments:
            if clean_constituency.lower() in a.constituency.lower() or a.constituency.lower() in clean_constituency.lower():
                ward_list = a.to_dict().get("wards", [])
                if not ward_list or "ALL" in [w.upper() for w in ward_list]:
                    authorized = True
                    break
                clean_w = re.sub(r'[^0-9a-zA-Z]', '', clean_ward.lower())
                if any(re.sub(r'[^0-9a-zA-Z]', '', str(w).lower()) == clean_w for w in ward_list):
                    authorized = True
                    break

        if not authorized:
            assigned_scope = ", ".join(f"{a.constituency} (Wards: {a.to_dict().get('wards_display', 'All')})" for a in admin_assignments)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You are not authorized to upload documents for constituency '{clean_constituency}' and ward '{clean_ward}'. Authorized scope: {assigned_scope}."
            )

    # 2. Validate PDF file extension and size from settings
    allowed_exts = [e.strip().lower() for e in settings.PDF_ALLOWED_EXTENSIONS.split(",")]
    filename_ext = Path(file.filename or "").suffix.lower()
    if not file.filename or filename_ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Please upload a valid PDF file ({settings.PDF_ALLOWED_EXTENSIONS}).")

    max_bytes = settings.PDF_MAX_SIZE_MB * 1024 * 1024
    doc_id = str(uuid.uuid4())
    pdf_path = UPLOAD_DIR / f"{doc_id}.pdf"

    total_size = 0
    try:
        with open(pdf_path, "wb") as f:
            while True:
                chunk = await file.read(4 * 1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > max_bytes:
                    f.close()
                    if pdf_path.exists():
                        pdf_path.unlink()
                    raise HTTPException(status_code=413, detail="Maximum PDF file size is 300 MB.")
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if pdf_path.exists():
            pdf_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    if total_size == 0:
        if pdf_path.exists():
            pdf_path.unlink()
        raise HTTPException(status_code=400, detail="Uploaded PDF file is empty.")

    user_id = current_user.id if current_user else None

    # 3. Save document & location metadata in database
    doc_entry = DocumentModel(
        id=doc_id,
        original_filename=file.filename,
        stored_file_path=str(pdf_path),
        file_size=total_size,
        total_pages=0,
        processing_status="processing",
        processing_error=None,
        uploaded_at=datetime.now(timezone.utc),
        uploaded_by=user_id,
        district=clean_district,
        constituency=clean_constituency,
        area=clean_area,
        ward_number=clean_ward
    )
    db.add(doc_entry)
    db.commit()
    db.refresh(doc_entry)

    eff_ollama_url = ollama_url or settings.OLLAMA_BASE_URL
    eff_model_name = model_name or settings.OLLAMA_MODEL
    eff_use_ai = use_ai if use_ai is not None else settings.OLLAMA_ENABLED

    background_tasks.add_task(
        run_background_extraction,
        doc_id=doc_id,
        file_path=pdf_path,
        filename=file.filename,
        ollama_url=eff_ollama_url,
        model_name=eff_model_name,
        use_ai=eff_use_ai
    )

    return {
        "id": doc_id,
        "document_id": doc_id,
        "filename": file.filename,
        "file_size": total_size,
        "district": clean_district,
        "constituency": clean_constituency,
        "area": clean_area,
        "ward_number": clean_ward,
        "status": "processing",
        "processing_status": "processing",
        "uploaded_by": user_id,
        "message": "File and location details uploaded successfully. Automatic extraction started."
    }

# -------------------------------------------------------------
# 5. List Documents & Summary (RBAC Enforced)
# -------------------------------------------------------------
@app.get("/api/documents/summary", tags=["Document Management"])
def get_documents_summary(
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Dynamically compute summary KPI metrics for uploaded documents directly from PostgreSQL.
    Enforces RBAC and geographic scope for Admin, rejects standard Users.
    """
    if current_user and current_user.role.lower() in ("user", "operator", "viewer"):
        raise HTTPException(status_code=403, detail="Access denied: Standard users cannot access document management.")

    q = db.query(DocumentModel)
    if current_user and not is_super_admin(current_user):
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not admin_assignments:
            q = q.filter(DocumentModel.uploaded_by == current_user.id)
        else:
            conds = [DocumentModel.uploaded_by == current_user.id]
            for a in admin_assignments:
                if a.constituency:
                    conds.append(DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%"))
            q = q.filter(or_(*conds))

    total_docs = q.count()
    completed_docs = q.filter(DocumentModel.processing_status == "completed").count()
    processing_docs = q.filter(DocumentModel.processing_status.in_(["processing", "uploaded", "pending"])).count()
    failed_docs = q.filter(DocumentModel.processing_status == "failed").count()

    # Total storage used in bytes
    storage_q = db.query(func.coalesce(func.sum(DocumentModel.file_size), 0))
    if current_user and not is_super_admin(current_user):
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not admin_assignments:
            storage_q = storage_q.filter(DocumentModel.uploaded_by == current_user.id)
        else:
            conds = [DocumentModel.uploaded_by == current_user.id]
            for a in admin_assignments:
                if a.constituency:
                    conds.append(DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%"))
            storage_q = storage_q.filter(or_(*conds))
    total_storage = int(storage_q.scalar() or 0)

    # Total extracted voters
    voter_q = db.query(func.count(VoterRecordModel.id))
    if current_user and not is_super_admin(current_user):
        voter_q = voter_q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not admin_assignments:
            voter_q = voter_q.filter(DocumentModel.uploaded_by == current_user.id)
        else:
            conds = [DocumentModel.uploaded_by == current_user.id]
            for a in admin_assignments:
                if a.constituency:
                    conds.append(DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%"))
            voter_q = voter_q.filter(or_(*conds))
    total_voters = int(voter_q.scalar() or 0)

    return {
        "total_documents": total_docs,
        "completed_documents": completed_docs,
        "processing_documents": processing_docs,
        "failed_documents": failed_docs,
        "total_voters": total_voters,
        "total_storage_bytes": total_storage
    }

@app.get("/api/documents", tags=["Document Management"])
def list_documents(
    query: Optional[str] = None,
    status: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    area: Optional[str] = None,
    ward_number: Optional[str] = None,
    uploaded_by: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "uploaded_at",
    order: str = "desc",
    page: Optional[int] = None,
    limit: Optional[int] = None,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    if current_user and current_user.role.lower() in ("user", "operator", "viewer"):
        raise HTTPException(status_code=403, detail="Access denied: Standard users cannot access document management.")

    q = db.query(DocumentModel)

    # RBAC: Scope filtering for Admin
    if current_user and not is_super_admin(current_user):
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not admin_assignments:
            q = q.filter(DocumentModel.uploaded_by == current_user.id)
        else:
            conds = [DocumentModel.uploaded_by == current_user.id]
            for a in admin_assignments:
                if a.constituency:
                    conds.append(DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%"))
            q = q.filter(or_(*conds))
    elif uploaded_by is not None:
        q = q.filter(DocumentModel.uploaded_by == uploaded_by)

    if query:
        search_term = f"%{query.strip()}%"
        q = q.filter(
            or_(
                DocumentModel.id.ilike(search_term),
                DocumentModel.original_filename.ilike(search_term),
                DocumentModel.district.ilike(search_term),
                DocumentModel.constituency.ilike(search_term),
                DocumentModel.area.ilike(search_term),
                DocumentModel.ward_number.ilike(search_term)
            )
        )
    if status and status != "all":
        q = q.filter(DocumentModel.processing_status == status)
    if district and district != "all":
        q = q.filter(DocumentModel.district.ilike(f"%{district.strip()}%"))
    if constituency and constituency != "all":
        q = q.filter(DocumentModel.constituency.ilike(f"%{constituency.strip()}%"))
    if area and area != "all":
        q = q.filter(DocumentModel.area.ilike(f"%{area.strip()}%"))
    if ward_number and ward_number != "all":
        q = q.filter(DocumentModel.ward_number.ilike(f"%{ward_number.strip()}%"))

    # Date Range filtering
    if date_from:
        try:
            d_from = datetime.strptime(date_from.strip(), "%Y-%m-%d")
            q = q.filter(DocumentModel.uploaded_at >= d_from)
        except ValueError:
            pass
    if date_to:
        try:
            d_to = datetime.strptime(date_to.strip(), "%Y-%m-%d") + timedelta(days=1)
            q = q.filter(DocumentModel.uploaded_at < d_to)
        except ValueError:
            pass

    total_filtered = q.count()

    order_col = getattr(DocumentModel, sort_by, DocumentModel.uploaded_at)
    q = q.order_by(desc(order_col) if order.lower() == "desc" else asc(order_col))

    # Apply pagination if requested
    use_pagination = page is not None or limit is not None
    effective_page = page or 1
    effective_limit = limit or 20

    if use_pagination:
        docs = q.offset((effective_page - 1) * effective_limit).limit(effective_limit).all()
    else:
        docs = q.all()

    # Pre-fetch voter counts per document
    doc_ids = [d.id for d in docs]
    voter_counts = {}
    if doc_ids:
        counts = db.query(
            VoterRecordModel.document_id,
            func.count(VoterRecordModel.id)
        ).filter(VoterRecordModel.document_id.in_(doc_ids)).group_by(VoterRecordModel.document_id).all()
        voter_counts = dict(counts)

    out = []
    for d in docs:
        d_dict = d.to_dict()
        d_dict["filename"] = d.original_filename
        d_dict["document_name"] = d.original_filename
        d_dict["file_type"] = Path(d.original_filename).suffix.upper().replace(".", "") or "PDF"
        d_dict["page_count"] = d.total_pages
        d_dict["extracted_voters"] = voter_counts.get(d.id, 0)
        d_dict["status"] = d.processing_status
        d_dict["created_at"] = d_dict["uploaded_at"]
        d_dict["processing_type"] = "Electoral Roll / Text"
        d_dict["uploader_name"] = d.uploader.full_name if d.uploader else (d.uploader.username if d.uploader else "System")
        out.append(d_dict)

    if use_pagination:
        # Also include overall summary metrics
        total_storage_scalar = db.query(func.coalesce(func.sum(DocumentModel.file_size), 0)).scalar() or 0
        total_voters_scalar = db.query(func.count(VoterRecordModel.id)).scalar() or 0
        summary_obj = {
            "total_documents": db.query(DocumentModel).count(),
            "completed_documents": db.query(DocumentModel).filter(DocumentModel.processing_status == "completed").count(),
            "processing_documents": db.query(DocumentModel).filter(DocumentModel.processing_status.in_(["processing", "uploaded", "pending"])).count(),
            "failed_documents": db.query(DocumentModel).filter(DocumentModel.processing_status == "failed").count(),
            "total_voters": int(total_voters_scalar),
            "total_storage_bytes": int(total_storage_scalar)
        }
        return {
            "documents": out,
            "total": total_filtered,
            "page": effective_page,
            "limit": effective_limit,
            "pages": (total_filtered + effective_limit - 1) // effective_limit if effective_limit > 0 else 1,
            "summary": summary_obj
        }
    return out

# -------------------------------------------------------------
# 6. Get Document Details (RBAC Check)
# -------------------------------------------------------------
@app.get("/api/documents/{doc_id}", tags=["Document Management"])
def get_document(
    doc_id: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if current_user and current_user.role.lower() != "admin" and doc.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to view this document.")

    res_path = resolve_result_path(doc_id)
    result_data = {}
    if res_path and res_path.exists():
        try:
            with open(res_path, "r", encoding="utf-8") as f:
                result_data = json.load(f)
        except Exception:
            pass

    voters_count = db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).count()

    info = doc.to_dict()
    info["filename"] = doc.original_filename
    info["document_name"] = doc.original_filename
    info["file_type"] = Path(doc.original_filename).suffix.upper().replace(".", "") or "PDF"
    info["page_count"] = doc.total_pages
    info["status"] = doc.processing_status
    info["created_at"] = info["uploaded_at"]
    info["extracted_voters"] = voters_count
    info["uploader_name"] = doc.uploader.full_name if doc.uploader else (doc.uploader.username if doc.uploader else "System")

    pdf_file = resolve_pdf_path(doc.stored_file_path, doc_id)
    info["file_exists_on_disk"] = bool(pdf_file and pdf_file.exists())

    if result_data:
        result_data["id"] = doc_id
        result_data["district"] = doc.district
        result_data["constituency"] = doc.constituency
        result_data["area"] = doc.area
        result_data["ward_number"] = doc.ward_number
        result_data["metadata"] = {
            **result_data.get("metadata", {}),
            **info
        }
        result_data["extracted_voters"] = voters_count
        return result_data
    else:
        return {
            "id": doc_id,
            "district": doc.district,
            "constituency": doc.constituency,
            "area": doc.area,
            "ward_number": doc.ward_number,
            "metadata": info,
            "extracted_voters": voters_count,
            "pages": [],
            "records": [],
            "table_rows_te": [],
            "table_rows_en": [],
            "paragraphs": [],
            "validation": {"review_notes": [f"Status: {doc.processing_status}"]}
        }

# -------------------------------------------------------------
# 7. Serve / Download Original PDF File
# -------------------------------------------------------------
@app.get("/api/documents/{doc_id}/download", tags=["Document Management"])
@app.get("/api/documents/{doc_id}/file", tags=["Document Management"])
def download_document(
    doc_id: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if current_user and current_user.role.lower() != "admin" and doc.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied to access this file.")

    pdf_file = resolve_pdf_path(doc.stored_file_path, doc_id)
    if not pdf_file or not pdf_file.exists():
        raise HTTPException(status_code=404, detail="Original PDF file not found on disk.")

    return FileResponse(
        str(pdf_file),
        media_type="application/pdf",
        filename=doc.original_filename,
        headers={"Content-Disposition": f'attachment; filename="{doc.original_filename}"'}
    )

# -------------------------------------------------------------
# 8. Document Deletion Preview & Cascade Deletion (Safe Retention)
# -------------------------------------------------------------
@app.get("/api/documents/{doc_id}/deletion-preview", tags=["Document Management"])
def get_document_deletion_preview(
    doc_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compute deletion impact preview:
    - Number of exclusive voters that will be deleted
    - Shared voters belonging to other documents that will be preserved
    - Payment records retained under financial retention policy
    """
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not is_admin_or_super(current_user):
        raise HTTPException(status_code=403, detail="Standard users cannot delete documents.")

    if not is_super_admin(current_user):
        # Admin can delete only if uploaded by them or within their assigned geographic scope
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        assigned_consts = [a.constituency.strip().lower() for a in admin_assignments if a.constituency]
        doc_const = (doc.constituency or "").strip().lower()
        if doc.uploaded_by != current_user.id and not any(doc_const in c or c in doc_const for c in assigned_consts):
            raise HTTPException(status_code=403, detail="You do not have permission to delete this document outside your geographic scope.")

    linked_voter_ids = [r[0] for r in db.query(VoterRecordModel.id).filter(VoterRecordModel.document_id == doc_id).all()]
    total_voters = len(linked_voter_ids)

    # Check shared voters in other documents
    shared_epics = []
    if linked_voter_ids:
        doc_epics = [
            r[0] for r in db.query(VoterRecordModel.voter_id)
            .filter(VoterRecordModel.document_id == doc_id)
            .filter(VoterRecordModel.voter_id != "Not Available")
            .all()
        ]
        if doc_epics:
            other_matches = db.query(VoterRecordModel.voter_id).filter(
                VoterRecordModel.document_id != doc_id,
                VoterRecordModel.voter_id.in_(doc_epics)
            ).distinct().all()
            shared_epics = [r[0] for r in other_matches]

    payments_count = 0
    voter_entries_count = 0
    if linked_voter_ids:
        payments_count = db.query(PaymentModel).filter(PaymentModel.voter_id.in_(linked_voter_ids)).count()
        voter_entries_count = db.query(VoterEntryModel).filter(VoterEntryModel.voter_id.in_(linked_voter_ids)).count()

    exclusive_voters_count = total_voters - len(shared_epics)
    if exclusive_voters_count < 0:
        exclusive_voters_count = total_voters

    return {
        "document_id": doc_id,
        "document_name": doc.original_filename,
        "file_size": doc.file_size,
        "district": doc.district,
        "constituency": doc.constituency,
        "voters_count": total_voters,
        "exclusive_voters_count": exclusive_voters_count,
        "shared_voters_count": len(shared_epics),
        "processing_records_count": doc.total_pages or 0,
        "payments_count": payments_count,
        "voter_entries_count": voter_entries_count,
        "warning": (
            "Deleting this document will permanently delete all voter records extracted exclusively "
            "from this document. This action will also remove associated document processing data. "
            "Financial payment transactions and audit logs are securely retained under compliance retention rules."
        ),
        "can_delete": True
    }

@app.delete("/api/documents/{doc_id}", tags=["Document Management"])
def delete_document(
    doc_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atomic document deletion:
    1. Preserves financial payment records and audit logs via snapshot metadata.
    2. Cascades and deletes exclusive voter records extracted from this document.
    3. Deletes document database record.
    4. Safely cleans physical files on disk after database transaction is committed.
    5. Logs deletion event in the system audit log.
    """
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not is_admin_or_super(current_user):
        raise HTTPException(status_code=403, detail="Standard users cannot delete documents.")

    if not is_super_admin(current_user):
        # Admin can delete only if uploaded by them or within their assigned geographic scope
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        assigned_consts = [a.constituency.strip().lower() for a in admin_assignments if a.constituency]
        doc_const = (doc.constituency or "").strip().lower()
        if doc.uploaded_by != current_user.id and not any(doc_const in c or c in doc_const for c in assigned_consts):
            raise HTTPException(status_code=403, detail="You do not have permission to delete this document outside your geographic scope.")

    doc_voters = db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).all()
    voter_ids = [v.id for v in doc_voters]
    deleted_voters_count = len(voter_ids)
    doc_name = doc.original_filename
    doc_stored_path = doc.stored_file_path

    # Financial Retention: snapshot voter details on payments before voter deletion
    if voter_ids:
        linked_payments = db.query(PaymentModel).filter(PaymentModel.voter_id.in_(voter_ids)).all()
        for p in linked_payments:
            v_rec = next((v for v in doc_voters if v.id == p.voter_id), None)
            if v_rec:
                if not p.voter_name or p.voter_name == "Not Available":
                    p.voter_name = v_rec.voter_name
                if not p.epic_no or p.epic_no == "Not Available":
                    p.epic_no = v_rec.voter_id
                if not p.district or p.district == "Not Available":
                    p.district = doc.district
                if not p.constituency or p.constituency == "Not Available":
                    p.constituency = doc.constituency

                # Check if this voter exists in ANOTHER active document (Case B)
                if v_rec.voter_id and v_rec.voter_id != "Not Available":
                    alt_voter = db.query(VoterRecordModel).filter(
                        VoterRecordModel.document_id != doc_id,
                        VoterRecordModel.voter_id == v_rec.voter_id
                    ).first()
                    if alt_voter:
                        p.voter_id = alt_voter.id
                    else:
                        p.voter_id = None
                else:
                    p.voter_id = None

    try:
        # Delete voter records for this document
        if voter_ids:
            db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).delete(synchronize_session=False)

        # Delete document record
        db.delete(doc)

        # Record Audit Log
        audit = AuditLogModel(
            user_id=current_user.id,
            action="DOCUMENT_DELETED",
            details=json.dumps({
                "document_id": doc_id,
                "document_name": doc_name,
                "deleted_voters_count": deleted_voters_count,
                "deleted_by": current_user.username
            }),
            created_at=datetime.now(timezone.utc)
        )
        db.add(audit)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete document and cascaded voter records from database: {str(exc)}"
        )

    # Physical File Cleanup (after database commit)
    cleaned_files = []
    failed_files = []

    pdf_file = resolve_pdf_path(doc_stored_path, doc_id)
    if pdf_file and pdf_file.exists():
        try:
            pdf_file.unlink()
            cleaned_files.append(str(pdf_file.name))
        except Exception:
            failed_files.append(str(pdf_file.name))

    res_path = resolve_result_path(doc_id)
    if res_path and res_path.exists():
        try:
            res_path.unlink()
            cleaned_files.append(str(res_path.name))
        except Exception:
            failed_files.append(str(res_path.name))

    return {
        "status": "success",
        "message": f"Document '{doc_name}' and {deleted_voters_count} exclusive voter records deleted successfully.",
        "id": doc_id,
        "deleted_voters_count": deleted_voters_count,
        "cleaned_files": cleaned_files,
        "failed_files": failed_files
    }

# -------------------------------------------------------------
# 8b. Reprocess Document
# -------------------------------------------------------------
@app.post("/api/documents/{doc_id}/reprocess", tags=["Document Management"])
def reprocess_document(
    doc_id: str,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger re-processing of an existing uploaded document:
    - Clears old voter extraction records for this document
    - Resets status to 'processing'
    - Dispatches background extraction task
    """
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if current_user.role.lower() != "admin" and doc.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to reprocess this document.")

    pdf_file = resolve_pdf_path(doc.stored_file_path, doc_id)
    if not pdf_file or not pdf_file.exists():
        raise HTTPException(status_code=400, detail="Physical PDF file not found on disk for re-processing.")

    doc.processing_status = "processing"
    doc.processing_error = None
    doc.processed_at = None

    # Delete existing voter records for clean extraction
    db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).delete()
    db.commit()

    background_tasks.add_task(
        run_background_extraction,
        doc_id=doc_id,
        file_path=pdf_file,
        filename=doc.original_filename,
        ollama_url=settings.OLLAMA_BASE_URL,
        model_name=settings.OLLAMA_MODEL,
        use_ai=settings.OLLAMA_ENABLED
    )

    return {
        "status": "processing",
        "message": f"Reprocessing triggered for document '{doc.original_filename}'.",
        "id": doc_id
    }

# -------------------------------------------------------------
# 9. Document Specific Voter Records
# -------------------------------------------------------------
@app.get("/api/documents/{doc_id}/records", tags=["Document Management"])
@app.get("/api/documents/{doc_id}/voters", tags=["Document Management"])
def get_document_records(
    doc_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    query: Optional[str] = None,
    gender: Optional[str] = None,
    source_page: Optional[int] = None,
    sort_by: str = "serial_no",
    order: str = "asc",
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if current_user and current_user.role.lower() != "admin" and doc.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied.")

    q = db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id)

    if query:
        search_filter = or_(
            VoterRecordModel.voter_name.ilike(f"%{query}%"),
            VoterRecordModel.voter_id.ilike(f"%{query}%"),
            VoterRecordModel.house_no.ilike(f"%{query}%"),
            VoterRecordModel.relation_name.ilike(f"%{query}%"),
            VoterRecordModel.serial_no.ilike(f"%{query}%"),
            VoterRecordModel.electoral_roll_no.ilike(f"%{query}%")
        )
        q = q.filter(search_filter)

    if gender and gender != "all":
        q = q.filter(VoterRecordModel.gender.ilike(f"%{gender}%"))

    if source_page:
        q = q.filter(VoterRecordModel.source_page == source_page)

    total_records = q.count()
    order_col = getattr(VoterRecordModel, sort_by, VoterRecordModel.id)
    q = q.order_by(desc(order_col) if order.lower() == "desc" else asc(order_col))

    records = q.offset((page - 1) * limit).limit(limit).all()

    return {
        "document_id": doc_id,
        "document_name": doc.original_filename,
        "total": total_records,
        "page": page,
        "limit": limit,
        "pages": (total_records + limit - 1) // limit if limit > 0 else 1,
        "records": [r.to_dict() for r in records]
    }

# -------------------------------------------------------------
# 10. Global Voter Records API (Paginated, Searchable, RBAC)
# -------------------------------------------------------------
@app.get("/api/voter-records")
@app.get("/api/voters")
def list_voter_records(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    document_id: Optional[str] = None,
    query: Optional[str] = None,
    gender: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    area: Optional[str] = None,
    ward_number: Optional[str] = None,
    search_unique_id: Optional[str] = None,
    source_page: Optional[int] = None,
    sort_by: str = "id",
    order: str = "asc",
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    if current_user and current_user.role.lower() not in ("super_admin", "superadmin", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Access denied: Standard users cannot access global voter records. Please use the Voter Verification screen."
        )

    q = db.query(VoterRecordModel)

    joined_doc = False
    # RBAC & Geographic Scope Enforcement:
    if current_user:
        if is_super_admin(current_user):
            # Super Admin has unrestricted global access
            pass
        elif is_admin(current_user):
            # Admin sees only voter records in their assigned geographic scope
            admin_assignments = db.query(UserGeographicAssignmentModel).filter(
                UserGeographicAssignmentModel.user_id == current_user.id,
                UserGeographicAssignmentModel.status == "ACTIVE"
            ).all()
            if not admin_assignments:
                return {"total": 0, "page": page, "limit": limit, "pages": 1, "records": []}

            # Reject if query attempts to access an unauthorized constituency
            if constituency and constituency.lower() != "all":
                if not any(constituency.strip().lower() in a.constituency.strip().lower() or a.constituency.strip().lower() in constituency.strip().lower() for a in admin_assignments):
                    raise HTTPException(status_code=403, detail=f"Access denied: Constituency '{constituency}' is outside your authorized geographic scope.")

            if not joined_doc:
                q = q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
                joined_doc = True
            conds = []
            for a in admin_assignments:
                if a.constituency:
                    conds.append(DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%"))
            q = q.filter(or_(*conds))
        else:
            # Standard User sees ONLY assigned voters
            user_assignments = db.query(UserGeographicAssignmentModel).filter(
                UserGeographicAssignmentModel.user_id == current_user.id,
                UserGeographicAssignmentModel.status == "ACTIVE"
            ).all()
            if not user_assignments:
                return {"total": 0, "page": page, "limit": limit, "pages": 1, "records": []}

            # Reject if query attempts to access an unauthorized constituency
            if constituency and constituency.lower() != "all":
                if not any(constituency.strip().lower() in a.constituency.strip().lower() or a.constituency.strip().lower() in constituency.strip().lower() for a in user_assignments):
                    raise HTTPException(status_code=403, detail=f"Access denied: Constituency '{constituency}' is outside your assigned geographic scope.")

            if not joined_doc:
                q = q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
                joined_doc = True

            conds = []
            for a in user_assignments:
                if a.constituency:
                    c_filter = DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%")
                    ward_list = a.to_dict().get("wards", [])
                    if ward_list and "ALL" not in [w.upper() for w in ward_list]:
                        w_conds = [DocumentModel.ward_number.ilike(f"%{w.strip()}%") for w in ward_list if w.strip()]
                        if w_conds:
                            c_filter = and_(c_filter, or_(*w_conds))
                    conds.append(c_filter)
            q = q.filter(or_(*conds))

    if (district and district != "all") or (constituency and constituency != "all") or (area and area != "all") or (ward_number and ward_number != "all"):
        if not joined_doc:
            q = q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
            joined_doc = True

    if district and district != "all":
        q = q.filter(DocumentModel.district.ilike(f"%{district}%"))
    if constituency and constituency != "all":
        q = q.filter(DocumentModel.constituency.ilike(f"%{constituency}%"))
    if area and area != "all":
        q = q.filter(DocumentModel.area.ilike(f"%{area}%"))
    if ward_number and ward_number != "all":
        q = q.filter(DocumentModel.ward_number.ilike(f"%{ward_number}%"))

    if document_id:
        q = q.filter(VoterRecordModel.document_id == document_id)

    if search_unique_id and search_unique_id.strip():
        q = q.filter(VoterRecordModel.unique_key.ilike(f"%{search_unique_id.strip()}%"))

    if query:
        search_filter = or_(
            VoterRecordModel.voter_name.ilike(f"%{query}%"),
            VoterRecordModel.voter_id.ilike(f"%{query}%"),
            VoterRecordModel.unique_key.ilike(f"%{query}%"),
            VoterRecordModel.house_no.ilike(f"%{query}%"),
            VoterRecordModel.relation_name.ilike(f"%{query}%"),
            VoterRecordModel.serial_no.ilike(f"%{query}%"),
            VoterRecordModel.electoral_roll_no.ilike(f"%{query}%")
        )
        q = q.filter(search_filter)

    if gender and gender != "all":
        q = q.filter(VoterRecordModel.gender.ilike(f"%{gender}%"))

    if source_page:
        q = q.filter(VoterRecordModel.source_page == source_page)

    total_records = q.count()
    order_col = getattr(VoterRecordModel, sort_by, VoterRecordModel.id)
    q = q.order_by(desc(order_col) if order.lower() == "desc" else asc(order_col))

    records = q.offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total_records,
        "page": page,
        "limit": limit,
        "pages": (total_records + limit - 1) // limit if limit > 0 else 1,
        "records": [r.to_dict() for r in records]
    }

# -------------------------------------------------------------
# 11. Individual Voter Record Operations
# -------------------------------------------------------------
@app.get("/api/voter-records/{record_id}")
def get_voter_record(record_id: int, db: Session = Depends(get_db)):
    rec = db.query(VoterRecordModel).filter(VoterRecordModel.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Voter record not found.")
    return rec.to_dict()

@app.put("/api/voter-records/{record_id}")
def update_voter_record(record_id: int, updates: VoterRecordUpdate, db: Session = Depends(get_db)):
    rec = db.query(VoterRecordModel).filter(VoterRecordModel.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Voter record not found.")

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(rec, key, value)

    rec.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rec)
    return rec.to_dict()

@app.delete("/api/voter-records/{record_id}")
def delete_voter_record(record_id: int, db: Session = Depends(get_db)):
    rec = db.query(VoterRecordModel).filter(VoterRecordModel.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Voter record not found.")
    db.delete(rec)
    db.commit()
    return {"status": "deleted", "id": record_id}

# -------------------------------------------------------------
# 12. Document Export (Excel, CSV)
# -------------------------------------------------------------
@app.get("/api/documents/{doc_id}/export")
def export_document_data(
    doc_id: str,
    format: str = Query("excel", pattern="^(excel|csv)$"),
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if current_user and current_user.role.lower() != "admin" and doc.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied to export this document.")

    records = db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).order_by(asc(VoterRecordModel.id)).all()

    if format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "గ్రా.పం.ఓ.జా.వ.సం. (Serial No.)",
            "అ.ఓ.జా.వ.సం. (Electoral Roll No.)",
            "ఓటరు పేరు (Voter Name)",
            "సంబంధం (Father/Husband)",
            "సంబంధిత వ్యక్తి పేరు (Relation Name)",
            "వయస్సు (Age)",
            "లింగము (Gender)",
            "ఇంటి సంఖ్య (House No.)",
            "ఓటరు ఐడి కార్డు నెం. (Voter ID)",
            "మూల PDF పుట (Source PDF Page)"
        ])
        for r in records:
            writer.writerow([
                r.serial_no,
                r.electoral_roll_no,
                r.voter_name,
                r.relation_type,
                r.relation_name,
                r.age,
                r.gender,
                r.house_no,
                r.voter_id,
                r.source_page
            ])
        csv_data = output.getvalue().encode("utf-8-sig")
        return StreamingResponse(
            BytesIO(csv_data),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{doc.original_filename}_records.csv"'}
        )

    structured_records = []
    for r in records:
        structured_records.append({
            "record_id": r.id,
            "page": r.source_page,
            "title": f"ఓటరు రికార్డు {r.serial_no} (పుట {r.source_page})",
            "fields": [
                {"field_name": "గ్రా.పం.ఓ.జా.వ.సం.", "value": r.serial_no},
                {"field_name": "అ.ఓ.జా.వ.సం.", "value": r.electoral_roll_no},
                {"field_name": "ఓటరు పేరు", "value": r.voter_name},
                {"field_name": "సంబంధం", "value": r.relation_type},
                {"field_name": "సంబంధిత వ్యక్తి పేరు", "value": r.relation_name},
                {"field_name": "వయస్సు", "value": r.age},
                {"field_name": "లింగము", "value": r.gender},
                {"field_name": "ఇంటి సంఖ్య", "value": r.house_no},
                {"field_name": "ఓటరు ఐడి కార్డు నెం.", "value": r.voter_id},
                {"field_name": "మూల PDF పుట", "value": str(r.source_page)}
            ]
        })

    doc_data = {
        "metadata": {
            "filename": doc.original_filename,
            "page_count": doc.total_pages,
            "records_count": len(records),
            "district": doc.district,
            "constituency": doc.constituency,
            "area": doc.area,
            "ward_number": doc.ward_number
        },
        "records": structured_records,
        "pages": [],
        "table_rows_te": [],
        "table_rows_en": [],
        "paragraphs": [],
        "validation": {}
    }

    excel_bytes = create_excel(doc_data)
    safe_name = re.sub(r'[^A-Za-z0-9_-]', '_', doc.original_filename.replace('.pdf', ''))
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_Voter_List.xlsx"'}
    )

@app.post("/api/documents/export")
def export_custom_body(body: ExportBody):
    try:
        data = body.result or {}
        return StreamingResponse(
            BytesIO(create_excel(data)),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="telugu_voter_data.xlsx"'}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

# -------------------------------------------------------------
# 13. Content Inspection Endpoints (Text, Tables, OCR)
# -------------------------------------------------------------
# 14. Voter Search and Amount Entry Management
# -------------------------------------------------------------

@app.get("/api/voters/search", tags=["Voter Search & Entries"])
def search_voters(
    q: Optional[str] = Query(None, description="Search by EPIC Voter ID, Name, House No, Area, or Mobile"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    area: Optional[str] = None,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Search voter records with support for partial name, EPIC voter ID, house no, area, or mobile number.
    Returns paginated voter results filtered strictly by caller's geographic scope.
    """
    if current_user and current_user.role.lower() not in ("super_admin", "superadmin", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Access denied: Standard users cannot access voter lookup. Please use the Voter Verification screen."
        )

    query = db.query(VoterRecordModel).join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)

    # Geographic Scope Enforcement
    if current_user:
        if is_super_admin(current_user):
            pass
        elif is_admin(current_user):
            admin_assignments = db.query(UserGeographicAssignmentModel).filter(
                UserGeographicAssignmentModel.user_id == current_user.id,
                UserGeographicAssignmentModel.status == "ACTIVE"
            ).all()
            if not admin_assignments:
                return {"voters": [], "total": 0, "page": page, "limit": limit, "pages": 1}
            if constituency and constituency.lower() != "all":
                if not any(constituency.strip().lower() in a.constituency.strip().lower() or a.constituency.strip().lower() in constituency.strip().lower() for a in admin_assignments):
                    raise HTTPException(status_code=403, detail=f"Access denied: Constituency '{constituency}' is outside your authorized scope.")
            conds = [DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%") for a in admin_assignments if a.constituency]
            query = query.filter(or_(*conds))
        else:
            user_assignments = db.query(UserGeographicAssignmentModel).filter(
                UserGeographicAssignmentModel.user_id == current_user.id,
                UserGeographicAssignmentModel.status == "ACTIVE"
            ).all()
            if not user_assignments:
                return {"voters": [], "total": 0, "page": page, "limit": limit, "pages": 1}
            if constituency and constituency.lower() != "all":
                if not any(constituency.strip().lower() in a.constituency.strip().lower() or a.constituency.strip().lower() in constituency.strip().lower() for a in user_assignments):
                    raise HTTPException(status_code=403, detail=f"Access denied: Constituency '{constituency}' is outside your assigned scope.")
            conds = []
            for a in user_assignments:
                if a.constituency:
                    c_filter = DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%")
                    ward_list = a.to_dict().get("wards", [])
                    if ward_list and "ALL" not in [w.upper() for w in ward_list]:
                        w_conds = [DocumentModel.ward_number.ilike(f"%{w.strip()}%") for w in ward_list if w.strip()]
                        if w_conds:
                            c_filter = and_(c_filter, or_(*w_conds))
                    conds.append(c_filter)
            query = query.filter(or_(*conds))

    if q and q.strip():
        term = q.strip()
        clean_digits = re.sub(r"\D", "", term)
        search_conditions = [
            VoterRecordModel.voter_id.ilike(f"%{term}%"),
            VoterRecordModel.unique_key.ilike(f"%{term}%"),
            VoterRecordModel.voter_name.ilike(f"%{term}%"),
            VoterRecordModel.relation_name.ilike(f"%{term}%"),
            VoterRecordModel.house_no.ilike(f"%{term}%"),
            VoterRecordModel.serial_no.ilike(f"%{term}%"),
            DocumentModel.area.ilike(f"%{term}%"),
            DocumentModel.constituency.ilike(f"%{term}%"),
            DocumentModel.district.ilike(f"%{term}%"),
        ]
        if len(clean_digits) >= 4:
            search_conditions.append(
                VoterRecordModel.entries.any(VoterEntryModel.mobile_number.ilike(f"%{clean_digits}%"))
            )
        query = query.filter(or_(*search_conditions))

    if district and district.lower() != "all":
        query = query.filter(DocumentModel.district.ilike(f"%{district}%"))
    if constituency and constituency.lower() != "all":
        query = query.filter(DocumentModel.constituency.ilike(f"%{constituency}%"))
    if area and area.lower() != "all":
        query = query.filter(DocumentModel.area.ilike(f"%{area}%"))

    total = query.count()
    records = query.order_by(VoterRecordModel.id.asc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "voters": [r.to_dict() for r in records],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 1
    }

# -------------------------------------------------------------
# 14. Voter Search, Entries, and A4 PDF Generation (27 per page)
# -------------------------------------------------------------

class SelectedVotersPdfRequest(BaseModel):
    voter_ids: List[Any] = Field(..., description="List of voter record IDs, EPIC numbers, or Unique Keys")

class GenerateVoterListPdfRequest(BaseModel):
    district: Optional[str] = None
    constituency: Optional[str] = None
    ward_number: Optional[str] = None
    area: Optional[str] = None
    document_id: Optional[str] = None
    query: Optional[str] = None
    search_unique_id: Optional[str] = None
    gender: Optional[str] = None

def _check_voter_geographic_scope(voter: VoterRecordModel, current_user: Optional[UserModel], db: Session):
    """
    Enforces strict RBAC geographic scoping:
    - Super Admin: global access
    - Admin: voter's document constituency must match admin's assigned constituencies
    - User: voter's document constituency and ward must match user's assigned scope
    Raises HTTP 403 Forbidden on violation.
    """
    if not current_user or is_super_admin(current_user):
        return

    doc = voter.document if hasattr(voter, "document") and voter.document else db.query(DocumentModel).filter(DocumentModel.id == voter.document_id).first()
    voter_constituency = (doc.constituency if doc else "") or ""
    voter_ward = (doc.ward_number if doc else "") or ""

    if is_admin(current_user):
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not admin_assignments:
            raise HTTPException(status_code=403, detail="Access denied: No active geographic assignments found for Admin.")
        allowed = any(
            a.constituency and (
                a.constituency.strip().lower() in voter_constituency.strip().lower() or
                voter_constituency.strip().lower() in a.constituency.strip().lower()
            )
            for a in admin_assignments
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="Access denied: Voter is outside your authorized geographic scope.")
    else:
        # Standard User / Operator / Viewer
        user_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not user_assignments:
            raise HTTPException(status_code=403, detail="Access denied: No active geographic assignments found for User.")
        allowed = False
        for a in user_assignments:
            if not a.constituency:
                continue
            c_match = (
                a.constituency.strip().lower() in voter_constituency.strip().lower() or
                voter_constituency.strip().lower() in a.constituency.strip().lower()
            )
            if c_match:
                ward_list = a.to_dict().get("wards", [])
                if not ward_list or "ALL" in [w.upper() for w in ward_list]:
                    allowed = True
                    break
                if any(w.strip().lower() in voter_ward.strip().lower() or voter_ward.strip().lower() in w.strip().lower() for w in ward_list if w.strip()):
                    allowed = True
                    break
        if not allowed:
            raise HTTPException(status_code=403, detail="Access denied: Voter is outside your assigned geographic scope.")

@app.get("/api/voters/{voter_id}/pdf", tags=["Voter PDF Generation"])
def generate_individual_voter_pdf(
    voter_id: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate an A4 PDF containing an individual voter record with genuine photo,
    details, and permanent 5-character Unique Key.
    Enforces RBAC geographic scope.
    """
    voter = None
    if voter_id.isdigit():
        voter = db.query(VoterRecordModel).filter(VoterRecordModel.id == int(voter_id)).first()
    if not voter:
        voter = db.query(VoterRecordModel).filter(VoterRecordModel.unique_key == voter_id.upper()).first()
    if not voter:
        voter = db.query(VoterRecordModel).filter(VoterRecordModel.voter_id == voter_id).first()

    if not voter:
        raise HTTPException(status_code=404, detail="Voter record not found.")

    _check_voter_geographic_scope(voter, current_user, db)

    pdf_bytes = generate_voters_a4_pdf([voter])
    uk = voter.unique_key or "voter"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="voter_{uk}.pdf"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.post("/api/voters/pdf/selected", tags=["Voter PDF Generation"])
def generate_selected_voters_pdf(
    body: SelectedVotersPdfRequest,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate an A4 PDF containing selected voter records (27 voters per page, 3 cols x 9 rows).
    Enforces RBAC: returns 403 if any selected voter is outside caller's geographic scope.
    """
    if current_user and current_user.role.lower() not in ("super_admin", "superadmin", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Access denied: Standard users cannot generate bulk voter PDFs. Please use the Voter Verification screen."
        )

    if not body.voter_ids:
        raise HTTPException(status_code=400, detail="No voter IDs provided.")

    numeric_ids = [int(i) for i in body.voter_ids if str(i).isdigit()]
    string_ids = [str(i) for i in body.voter_ids if not str(i).isdigit()]

    q = db.query(VoterRecordModel)
    conds = []
    if numeric_ids:
        conds.append(VoterRecordModel.id.in_(numeric_ids))
    if string_ids:
        conds.append(VoterRecordModel.voter_id.in_(string_ids))
        conds.append(VoterRecordModel.unique_key.in_([s.upper() for s in string_ids]))

    if not conds:
        raise HTTPException(status_code=400, detail="Invalid voter IDs provided.")

    voters = q.filter(or_(*conds)).order_by(VoterRecordModel.id.asc()).all()

    if not voters:
        raise HTTPException(status_code=404, detail="No matching voter records found.")

    # Scope validation for each selected voter
    for voter in voters:
        _check_voter_geographic_scope(voter, current_user, db)

    pdf_bytes = generate_voters_a4_pdf(voters)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="voter_list_selected.pdf"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.post("/api/voters/pdf/generate", tags=["Voter PDF Generation"])
@app.get("/api/voters/pdf/generate", tags=["Voter PDF Generation"])
def generate_filtered_voter_list_pdf(
    body: Optional[GenerateVoterListPdfRequest] = None,
    district: Optional[str] = Query(None),
    constituency: Optional[str] = Query(None),
    ward_number: Optional[str] = Query(None),
    area: Optional[str] = Query(None),
    document_id: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    search_unique_id: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate complete or filtered Voter List A4 PDF (27 voters per page, 3 cols x 9 rows).
    Accepts filter parameters in JSON body or query parameters.
    Enforces RBAC geographic scope.
    """
    if current_user and current_user.role.lower() not in ("super_admin", "superadmin", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Access denied: Standard users cannot generate bulk voter PDFs. Please use the Voter Verification screen."
        )

    eff_district = (body.district if body and body.district is not None else district)
    eff_constituency = (body.constituency if body and body.constituency is not None else constituency)
    eff_ward = (body.ward_number if body and body.ward_number is not None else ward_number)
    eff_area = (body.area if body and body.area is not None else area)
    eff_document_id = (body.document_id if body and body.document_id is not None else document_id)
    eff_query = (body.query if body and body.query is not None else query)
    eff_search_unique_id = (body.search_unique_id if body and body.search_unique_id is not None else search_unique_id)
    eff_gender = (body.gender if body and body.gender is not None else gender)

    q = db.query(VoterRecordModel)
    joined_doc = False

    # RBAC Geographic Scope Enforcement
    if current_user:
        if is_super_admin(current_user):
            pass
        elif is_admin(current_user):
            admin_assignments = db.query(UserGeographicAssignmentModel).filter(
                UserGeographicAssignmentModel.user_id == current_user.id,
                UserGeographicAssignmentModel.status == "ACTIVE"
            ).all()
            if not admin_assignments:
                raise HTTPException(status_code=403, detail="Access denied: No active geographic assignments found for Admin.")

            if eff_constituency and eff_constituency.lower() != "all":
                if not any(eff_constituency.strip().lower() in a.constituency.strip().lower() or a.constituency.strip().lower() in eff_constituency.strip().lower() for a in admin_assignments):
                    raise HTTPException(status_code=403, detail=f"Access denied: Constituency '{eff_constituency}' is outside your authorized geographic scope.")

            if not joined_doc:
                q = q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
                joined_doc = True
            conds = [DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%") for a in admin_assignments if a.constituency]
            q = q.filter(or_(*conds))
        else:
            # Standard User
            user_assignments = db.query(UserGeographicAssignmentModel).filter(
                UserGeographicAssignmentModel.user_id == current_user.id,
                UserGeographicAssignmentModel.status == "ACTIVE"
            ).all()
            if not user_assignments:
                raise HTTPException(status_code=403, detail="Access denied: No active geographic assignments found for User.")

            if eff_constituency and eff_constituency.lower() != "all":
                if not any(eff_constituency.strip().lower() in a.constituency.strip().lower() or a.constituency.strip().lower() in eff_constituency.strip().lower() for a in user_assignments):
                    raise HTTPException(status_code=403, detail=f"Access denied: Constituency '{eff_constituency}' is outside your assigned geographic scope.")

            if not joined_doc:
                q = q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
                joined_doc = True

            conds = []
            for a in user_assignments:
                if a.constituency:
                    c_filter = DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%")
                    ward_list = a.to_dict().get("wards", [])
                    if ward_list and "ALL" not in [w.upper() for w in ward_list]:
                        w_conds = [DocumentModel.ward_number.ilike(f"%{w.strip()}%") for w in ward_list if w.strip()]
                        if w_conds:
                            c_filter = and_(c_filter, or_(*w_conds))
                    conds.append(c_filter)
            q = q.filter(or_(*conds))

    if (eff_district and eff_district != "all") or (eff_constituency and eff_constituency != "all") or (eff_area and eff_area != "all") or (eff_ward and eff_ward != "all"):
        if not joined_doc:
            q = q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
            joined_doc = True

    if eff_district and eff_district != "all":
        q = q.filter(DocumentModel.district.ilike(f"%{eff_district}%"))
    if eff_constituency and eff_constituency != "all":
        q = q.filter(DocumentModel.constituency.ilike(f"%{eff_constituency}%"))
    if eff_area and eff_area != "all":
        q = q.filter(DocumentModel.area.ilike(f"%{eff_area}%"))
    if eff_ward and eff_ward != "all":
        q = q.filter(DocumentModel.ward_number.ilike(f"%{eff_ward}%"))

    if eff_document_id:
        q = q.filter(VoterRecordModel.document_id == eff_document_id)

    if eff_search_unique_id and eff_search_unique_id.strip():
        q = q.filter(VoterRecordModel.unique_key.ilike(f"%{eff_search_unique_id.strip()}%"))

    if eff_query:
        search_filter = or_(
            VoterRecordModel.voter_name.ilike(f"%{eff_query}%"),
            VoterRecordModel.voter_id.ilike(f"%{eff_query}%"),
            VoterRecordModel.unique_key.ilike(f"%{eff_query}%"),
            VoterRecordModel.house_no.ilike(f"%{eff_query}%"),
            VoterRecordModel.relation_name.ilike(f"%{eff_query}%"),
            VoterRecordModel.serial_no.ilike(f"%{eff_query}%"),
            VoterRecordModel.electoral_roll_no.ilike(f"%{eff_query}%")
        )
        q = q.filter(search_filter)

    if eff_gender and eff_gender != "all":
        q = q.filter(VoterRecordModel.gender.ilike(f"%{eff_gender}%"))

    voters = q.order_by(asc(VoterRecordModel.id)).all()
    pdf_bytes = generate_voters_a4_pdf(voters)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="voter_list.pdf"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

# -------------------------------------------------------------
# 14b. Single-Screen Voter Verification API (User Role)
# -------------------------------------------------------------
@app.get("/api/voters/verify/{unique_code}", tags=["Voter Verification"])
def verify_voter_code(
    unique_code: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verify voter by exact 5-character alphanumeric unique code.
    Requires JWT authentication.
    Enforces RBAC geographic scope.
    Returns only the matching voter's details.
    """
    code = (unique_code or "").strip().upper()
    if len(code) != 5 or not code.isalnum():
        raise HTTPException(
            status_code=400,
            detail="Invalid Voter Code format. Code must be exactly 5 alphanumeric characters."
        )

    voter = db.query(VoterRecordModel).filter(VoterRecordModel.unique_key == code).first()
    if not voter:
        raise HTTPException(status_code=404, detail="Invalid Voter Code")

    # Enforce geographic scope restrictions
    _check_voter_geographic_scope(voter, current_user, db)

    doc = voter.document if hasattr(voter, "document") and voter.document else db.query(DocumentModel).filter(DocumentModel.id == voter.document_id).first()

    photo_path = get_voter_photo_path(
        unique_key=voter.unique_key,
        voter_id=voter.voter_id,
        document_id=voter.document_id,
        source_page=voter.source_page
    )

    photo_base64 = None
    if photo_path and os.path.exists(photo_path):
        try:
            import base64
            with open(photo_path, "rb") as pf:
                b64 = base64.b64encode(pf.read()).decode("utf-8")
                photo_base64 = f"data:image/jpeg;base64,{b64}"
        except Exception:
            photo_base64 = None

    return {
        "status": "success",
        "unique_code": voter.unique_key,
        "unique_key": voter.unique_key,
        "voter_name": voter.voter_name,
        "epic_number": voter.voter_id,
        "voter_id": voter.voter_id,
        "relation_type": voter.relation_type,
        "relation_name": voter.relation_name,
        "father_or_husband_name": voter.relation_name,
        "age": voter.age,
        "gender": voter.gender,
        "house_number": voter.house_no,
        "house_no": voter.house_no,
        "district": doc.district if doc else None,
        "constituency": doc.constituency if doc else None,
        "ward": doc.ward_number if doc else None,
        "ward_number": doc.ward_number if doc else None,
        "part_number": voter.electoral_roll_no or (str(voter.source_page) if voter.source_page else None),
        "electoral_roll_no": voter.electoral_roll_no,
        "serial_no": voter.serial_no,
        "area": doc.area if doc else None,
        "has_photo": bool(photo_path and os.path.exists(photo_path)),
        "photo_url": f"/api/voters/{voter.unique_key}/photo" if photo_path else None,
        "photo_base64": photo_base64
    }

@app.get("/api/voters/{unique_code}/photo", tags=["Voter Verification"])
def get_voter_photo_endpoint(
    unique_code: str,
    db: Session = Depends(get_db)
):
    """Serve voter photo by unique key or EPIC ID."""
    code = (unique_code or "").strip().upper()
    voter = db.query(VoterRecordModel).filter(
        or_(
            VoterRecordModel.unique_key == code,
            VoterRecordModel.voter_id == unique_code.strip()
        )
    ).first()

    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found.")

    photo_path = get_voter_photo_path(
        unique_key=voter.unique_key,
        voter_id=voter.voter_id,
        document_id=voter.document_id,
        source_page=voter.source_page
    )

    if not photo_path or not os.path.exists(photo_path):
        raise HTTPException(status_code=404, detail="Photo not available.")

    return FileResponse(photo_path, media_type="image/jpeg")

@app.get("/api/voters/{voter_id}", tags=["Voter Search & Entries"])
def get_voter_details(voter_id: str, db: Session = Depends(get_db)):
    """
    Fetch complete voter details and previous entries by database record ID, unique key, or EPIC voter ID.
    """
    voter = None
    if voter_id.isdigit():
        voter = db.query(VoterRecordModel).filter(VoterRecordModel.id == int(voter_id)).first()
    if not voter:
        voter = db.query(VoterRecordModel).filter(VoterRecordModel.unique_key == voter_id.upper()).first()
    if not voter:
        voter = db.query(VoterRecordModel).filter(VoterRecordModel.voter_id == voter_id).first()

    if not voter:
        raise HTTPException(status_code=404, detail="Voter record not found.")

    voter_data = voter.to_dict()
    voter_data["entries"] = [e.to_dict() for e in voter.entries]
    return voter_data

@app.get("/api/voters/{voter_id}/entries", tags=["Voter Search & Entries"])
def get_voter_entries(voter_id: str, db: Session = Depends(get_db)):
    """
    Fetch previous entries for a specific voter.
    """
    voter = None
    if voter_id.isdigit():
        voter = db.query(VoterRecordModel).filter(VoterRecordModel.id == int(voter_id)).first()
    if not voter:
        voter = db.query(VoterRecordModel).filter(VoterRecordModel.unique_key == voter_id.upper()).first()
    if not voter:
        voter = db.query(VoterRecordModel).filter(VoterRecordModel.voter_id == voter_id).first()

    if not voter:
        raise HTTPException(status_code=404, detail="Voter record not found.")

    entries = (
        db.query(VoterEntryModel)
        .filter(VoterEntryModel.voter_id == voter.id)
        .order_by(desc(VoterEntryModel.created_at))
        .all()
    )
    return {
        "voter_id": voter.id,
        "voter_name": voter.voter_name,
        "epic_no": voter.voter_id,
        "total_entries": len(entries),
        "total_amount": sum(float(e.amount or 0) for e in entries),
        "entries": [e.to_dict() for e in entries]
    }

@app.post("/api/voter-entries", status_code=status.HTTP_201_CREATED, tags=["Voter Search & Entries"])
def create_voter_entry(
    req: VoterEntryCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save mobile number and amount entry for the selected voter.
    """
    voter = db.query(VoterRecordModel).filter(VoterRecordModel.id == req.voter_id).first()
    if not voter:
        raise HTTPException(status_code=404, detail="Selected voter does not exist.")

    # Validate mobile number if provided (optional)
    clean_mobile = ""
    if req.mobile_number:
        clean_mobile = re.sub(r"\D", "", req.mobile_number)
        if len(clean_mobile) > 10 and clean_mobile.startswith("91"):
            clean_mobile = clean_mobile[2:]
        if clean_mobile and len(clean_mobile) != 10:
            raise HTTPException(status_code=400, detail="Mobile number must be a valid 10-digit number.")

    # Validate amount
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be a positive number greater than 0.")

    # Parse entry date
    if req.entry_date:
        try:
            entry_d = datetime.strptime(req.entry_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Entry date must be in YYYY-MM-DD format.")
    else:
        entry_d = datetime.now(timezone.utc).date()

    # Prevent duplicate submission within last 5 seconds for the same voter, mobile, amount
    five_sec_ago = datetime.now(timezone.utc) - timedelta(seconds=5)
    recent_dup = db.query(VoterEntryModel).filter(
        VoterEntryModel.voter_id == req.voter_id,
        VoterEntryModel.mobile_number == clean_mobile,
        VoterEntryModel.amount == req.amount,
        VoterEntryModel.created_at >= five_sec_ago
    ).first()
    if recent_dup:
        raise HTTPException(status_code=409, detail="Duplicate entry detected. Please wait a moment before resubmitting.")

    new_entry = VoterEntryModel(
        voter_id=voter.id,
        mobile_number=clean_mobile,
        amount=req.amount,
        entry_date=entry_d,
        remarks=req.remarks.strip() if req.remarks else None,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    # Synchronize disbursement into Payments ledger
    today_str = datetime.now().strftime("%Y%m%d")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    now_utc = datetime.now(timezone.utc)
    payment = PaymentModel(
        transaction_id=f"TXN-{today_str}-{unique_suffix}",
        receipt_number=f"RCP-{today_str}-{unique_suffix}",
        voter_id=voter.id,
        voter_entry_id=new_entry.id,
        mobile_number=clean_mobile,
        amount=req.amount,
        payment_date=entry_d,
        payment_method="Cash",
        payment_status="Paid",
        remarks=req.remarks.strip() if req.remarks else None,
        voter_name=voter.voter_name,
        epic_no=voter.voter_id,
        district=getattr(voter.document, "district", "") if voter.document else "",
        constituency=getattr(voter.document, "constituency", "") if voter.document else "",
        created_by=current_user.id,
        verified_by=current_user.id,
        verified_at=now_utc,
        created_at=now_utc,
        updated_at=now_utc
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    audit = PaymentAuditLogModel(
        payment_id=payment.id,
        action="CREATED",
        performed_by=current_user.id,
        reason=f"Disbursement entry recorded via Voter Details & Entries for voter {voter.voter_id}.",
        new_values={
            "transaction_id": payment.transaction_id,
            "voter_id": payment.voter_id,
            "voter_entry_id": new_entry.id,
            "amount": float(payment.amount),
            "payment_status": "Paid",
            "payment_method": "Cash"
        }
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "message": "Voter entry saved successfully.",
        "entry": new_entry.to_dict()
    }

@app.put("/api/voter-entries/{entry_id}", tags=["Voter Search & Entries"])
def update_voter_entry(
    entry_id: int,
    req: VoterEntryUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing voter entry. Admin can edit any entry; regular users can only edit their own.
    """
    entry = db.query(VoterEntryModel).filter(VoterEntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")

    if current_user.role.lower() != "admin" and entry.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this entry.")

    if req.mobile_number is not None:
        if req.mobile_number.strip() == "":
            entry.mobile_number = ""
        else:
            clean_mobile = re.sub(r"\D", "", req.mobile_number)
            if len(clean_mobile) > 10 and clean_mobile.startswith("91"):
                clean_mobile = clean_mobile[2:]
            if clean_mobile and len(clean_mobile) != 10:
                raise HTTPException(status_code=400, detail="Mobile number must be a valid 10-digit number.")
            entry.mobile_number = clean_mobile

    if req.amount is not None:
        if req.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be a positive number greater than 0.")
        entry.amount = req.amount

    if req.entry_date is not None:
        try:
            entry.entry_date = datetime.strptime(req.entry_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Entry date must be in YYYY-MM-DD format.")

    if req.remarks is not None:
        entry.remarks = req.remarks.strip() if req.remarks else None

    entry.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(entry)

    # Sync update to linked Payment
    linked_payment = db.query(PaymentModel).filter(PaymentModel.voter_entry_id == entry.id).first()
    if linked_payment:
        old_val = {
            "amount": float(linked_payment.amount),
            "mobile_number": linked_payment.mobile_number,
            "payment_date": str(linked_payment.payment_date)
        }
        linked_payment.amount = entry.amount
        linked_payment.mobile_number = entry.mobile_number
        linked_payment.payment_date = entry.entry_date
        linked_payment.remarks = entry.remarks
        linked_payment.updated_by = current_user.id
        linked_payment.updated_at = datetime.now(timezone.utc)
        db.commit()

        audit = PaymentAuditLogModel(
            payment_id=linked_payment.id,
            action="UPDATED",
            performed_by=current_user.id,
            reason="Synchronized update from Voter Details & Entries modification.",
            old_values=old_val,
            new_values={
                "amount": float(linked_payment.amount),
                "mobile_number": linked_payment.mobile_number,
                "payment_date": str(linked_payment.payment_date)
            }
        )
        db.add(audit)
        db.commit()

    return {
        "status": "success",
        "message": "Entry updated successfully.",
        "entry": entry.to_dict()
    }

@app.delete("/api/voter-entries/{entry_id}", tags=["Voter Search & Entries"])
def delete_voter_entry(
    entry_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a voter entry. Admin can delete any entry; regular users can only delete their own.
    """
    entry = db.query(VoterEntryModel).filter(VoterEntryModel.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found.")

    if current_user.role.lower() != "admin" and entry.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this entry.")

    # Remove linked payment if exists
    linked_payment = db.query(PaymentModel).filter(PaymentModel.voter_entry_id == entry.id).first()
    if linked_payment:
        db.delete(linked_payment)

    db.delete(entry)
    db.commit()

    return {
        "status": "success",
        "message": "Entry deleted successfully.",
        "id": entry_id
    }

# -------------------------------------------------------------
# 15. Payments Dashboard & Transaction Management APIs
# -------------------------------------------------------------

@app.get("/api/payments/dashboard/summary", tags=["Payments Dashboard"])
@app.get("/api/payments/summary", tags=["Payments Dashboard"])
def get_payments_summary(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Compute real-time summary KPI cards dynamically from PostgreSQL `payments` table:
    1. Total Transactions
    2. Total Amount Recorded
    3. Total Paid Amount
    4. Total Pending Amount
    5. Total Failed Transactions (and failed amount)
    6. Today's Collection (with yesterday comparison)
    7. This Month's Collection (with last month comparison)
    """
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    start_of_this_month = date(today.year, today.month, 1)

    # Calculate last month's date bounds
    if today.month == 1:
        start_of_last_month = date(today.year - 1, 12, 1)
        end_of_last_month = date(today.year - 1, 12, 31)
    else:
        start_of_last_month = date(today.year, today.month - 1, 1)
        import calendar
        _, last_day = calendar.monthrange(today.year, today.month - 1)
        end_of_last_month = date(today.year, today.month - 1, last_day)

    total_amount_val = db.query(func.coalesce(func.sum(PaymentModel.amount), 0)).scalar()
    total_transactions_val = db.query(func.count(PaymentModel.id)).scalar()

    paid_amount_val = db.query(
        func.coalesce(func.sum(PaymentModel.amount), 0)
    ).filter(
        func.lower(PaymentModel.payment_status) == "paid"
    ).scalar()

    pending_amount_val = db.query(
        func.coalesce(func.sum(PaymentModel.amount), 0)
    ).filter(
        func.lower(PaymentModel.payment_status) == "pending"
    ).scalar()

    failed_query = db.query(
        func.count(PaymentModel.id),
        func.coalesce(func.sum(PaymentModel.amount), 0)
    ).filter(
        func.lower(PaymentModel.payment_status) == "failed"
    ).first()
    failed_count = failed_query[0] if failed_query else 0
    failed_amount = float(failed_query[1] or 0.0) if failed_query else 0.0

    refunded_amount_val = db.query(
        func.coalesce(func.sum(PaymentModel.amount), 0)
    ).filter(
        func.lower(PaymentModel.payment_status) == "refunded"
    ).scalar()

    cancelled_amount_val = db.query(
        func.coalesce(func.sum(PaymentModel.amount), 0)
    ).filter(
        func.lower(PaymentModel.payment_status) == "cancelled"
    ).scalar()

    # Today vs Yesterday Collections
    today_collection_val = db.query(
        func.coalesce(func.sum(PaymentModel.amount), 0)
    ).filter(
        func.lower(PaymentModel.payment_status) == "paid",
        PaymentModel.payment_date == today
    ).scalar()

    yesterday_collection_val = db.query(
        func.coalesce(func.sum(PaymentModel.amount), 0)
    ).filter(
        func.lower(PaymentModel.payment_status) == "paid",
        PaymentModel.payment_date == yesterday
    ).scalar()

    # This Month vs Last Month Collections
    this_month_collection_val = db.query(
        func.coalesce(func.sum(PaymentModel.amount), 0)
    ).filter(
        func.lower(PaymentModel.payment_status) == "paid",
        PaymentModel.payment_date >= start_of_this_month,
        PaymentModel.payment_date <= today
    ).scalar()

    last_month_collection_val = db.query(
        func.coalesce(func.sum(PaymentModel.amount), 0)
    ).filter(
        func.lower(PaymentModel.payment_status) == "paid",
        PaymentModel.payment_date >= start_of_last_month,
        PaymentModel.payment_date <= end_of_last_month
    ).scalar()

    total_amt = float(total_amount_val or 0.0)
    paid_amt = float(paid_amount_val or 0.0)
    pending_amt = float(pending_amount_val or 0.0)
    today_col = float(today_collection_val or 0.0)
    yesterday_col = float(yesterday_collection_val or 0.0)
    this_month_col = float(this_month_collection_val or 0.0)
    last_month_col = float(last_month_collection_val or 0.0)

    # Percentage calculations
    paid_pct = round((paid_amt / total_amt * 100), 1) if total_amt > 0 else 0.0
    pending_pct = round((pending_amt / total_amt * 100), 1) if total_amt > 0 else 0.0

    today_growth = 0.0
    if yesterday_col > 0:
        today_growth = round(((today_col - yesterday_col) / yesterday_col * 100), 1)
    elif today_col > 0:
        today_growth = 100.0

    month_growth = 0.0
    if last_month_col > 0:
        month_growth = round(((this_month_col - last_month_col) / last_month_col * 100), 1)
    elif this_month_col > 0:
        month_growth = 100.0

    return {
        "total_transactions": int(total_transactions_val or 0),
        "total_amount": total_amt,
        "total_amount_recorded": total_amt,
        "total_payments": int(total_transactions_val or 0),
        "paid_amount": paid_amt,
        "pending_amount": pending_amt,
        "failed_transactions": int(failed_count or 0),
        "failed_amount": failed_amount,
        "refunded_amount": float(refunded_amount_val or 0.0),
        "cancelled_amount": float(cancelled_amount_val or 0.0),
        "today_collection": today_col,
        "yesterday_collection": yesterday_col,
        "this_month_collection": this_month_col,
        "last_month_collection": last_month_col,
        "paid_percentage": paid_pct,
        "pending_percentage": pending_pct,
        "today_growth_pct": today_growth,
        "month_growth_pct": month_growth,
    }

@app.get("/api/payments/dashboard/daily-collection", tags=["Payments Dashboard"])
def get_daily_collection_chart(
    days: int = Query(30, ge=7, le=90),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Returns daily collection series for charting."""
    today = datetime.now(timezone.utc).date()
    start_d = today - timedelta(days=days - 1)
    end_d = today

    if from_date:
        try:
            start_d = datetime.strptime(from_date, "%Y-%m-%d").date()
        except ValueError:
            pass
    if to_date:
        try:
            end_d = datetime.strptime(to_date, "%Y-%m-%d").date()
        except ValueError:
            pass

    records = (
        db.query(
            PaymentModel.payment_date,
            func.coalesce(func.sum(PaymentModel.amount), 0).label("total_amount"),
            func.coalesce(func.sum(case((func.lower(PaymentModel.payment_status) == "paid", PaymentModel.amount), else_=0)), 0).label("paid_amount"),
            func.coalesce(func.sum(case((func.lower(PaymentModel.payment_status) == "pending", PaymentModel.amount), else_=0)), 0).label("pending_amount"),
            func.count(PaymentModel.id).label("count")
        )
        .filter(PaymentModel.payment_date >= start_d, PaymentModel.payment_date <= end_d)
        .group_by(PaymentModel.payment_date)
        .order_by(PaymentModel.payment_date.asc())
        .all()
    )

    result = []
    # Build complete date map
    rec_map = {
        r[0]: {
            "date": r[0].isoformat(),
            "total_amount": float(r[1] or 0.0),
            "paid_amount": float(r[2] or 0.0),
            "pending_amount": float(r[3] or 0.0),
            "count": int(r[4] or 0)
        }
        for r in records
    }

    curr = start_d
    while curr <= end_d:
        if curr in rec_map:
            result.append(rec_map[curr])
        else:
            result.append({
                "date": curr.isoformat(),
                "total_amount": 0.0,
                "paid_amount": 0.0,
                "pending_amount": 0.0,
                "count": 0
            })
        curr += timedelta(days=1)

    return result

@app.get("/api/payments/dashboard/monthly-collection", tags=["Payments Dashboard"])
def get_monthly_collection_chart(
    months: int = Query(12, ge=3, le=24),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Returns monthly collection breakdown for charting."""
    today = datetime.now(timezone.utc).date()
    start_d = date(today.year - 1, today.month, 1)

    m_col = func.date_trunc("month", PaymentModel.payment_date).label("month_d")
    records = (
        db.query(
            m_col,
            func.coalesce(func.sum(PaymentModel.amount), 0).label("total_amount"),
            func.coalesce(func.sum(case((func.lower(PaymentModel.payment_status) == "paid", PaymentModel.amount), else_=0)), 0).label("paid_amount"),
            func.coalesce(func.sum(case((func.lower(PaymentModel.payment_status) == "pending", PaymentModel.amount), else_=0)), 0).label("pending_amount"),
            func.count(PaymentModel.id).label("count")
        )
        .filter(PaymentModel.payment_date >= start_d)
        .group_by(m_col)
        .order_by(m_col.asc())
        .all()
    )

    return [
        {
            "month": r[0].strftime("%Y-%m") if hasattr(r[0], "strftime") else str(r[0])[:7],
            "total_amount": float(r[1] or 0.0),
            "paid_amount": float(r[2] or 0.0),
            "pending_amount": float(r[3] or 0.0),
            "count": int(r[4] or 0)
        }
        for r in records
    ]

@app.get("/api/payments/dashboard/status-distribution", tags=["Payments Dashboard"])
def get_status_distribution(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Returns distribution of transactions across payment statuses."""
    total_count = db.query(func.count(PaymentModel.id)).scalar() or 0
    records = (
        db.query(
            PaymentModel.payment_status,
            func.count(PaymentModel.id).label("count"),
            func.coalesce(func.sum(PaymentModel.amount), 0).label("total_amount")
        )
        .group_by(PaymentModel.payment_status)
        .all()
    )

    return [
        {
            "status": r[0],
            "count": int(r[1] or 0),
            "total_amount": float(r[2] or 0.0),
            "percentage": round(int(r[1]) / total_count * 100, 1) if total_count > 0 else 0.0
        }
        for r in records
    ]

@app.get("/api/payments/dashboard/method-distribution", tags=["Payments Dashboard"])
def get_method_distribution(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Returns distribution of transactions across payment methods."""
    total_count = db.query(func.count(PaymentModel.id)).scalar() or 0
    records = (
        db.query(
            PaymentModel.payment_method,
            func.count(PaymentModel.id).label("count"),
            func.coalesce(func.sum(PaymentModel.amount), 0).label("total_amount")
        )
        .group_by(PaymentModel.payment_method)
        .all()
    )

    return [
        {
            "method": r[0],
            "count": int(r[1] or 0),
            "total_amount": float(r[2] or 0.0),
            "percentage": round(int(r[1]) / total_count * 100, 1) if total_count > 0 else 0.0
        }
        for r in records
    ]

@app.get("/api/payments/dashboard/location-collection", tags=["Payments Dashboard"])
def get_location_collection(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Returns location-wise (district and constituency) payment metrics."""
    district_records = (
        db.query(
            func.coalesce(DocumentModel.district, "Unknown District").label("district"),
            func.count(PaymentModel.id).label("count"),
            func.coalesce(func.sum(PaymentModel.amount), 0).label("total_amount"),
            func.coalesce(func.sum(case((func.lower(PaymentModel.payment_status) == "paid", PaymentModel.amount), else_=0)), 0).label("paid_amount")
        )
        .join(VoterRecordModel, PaymentModel.voter_id == VoterRecordModel.id)
        .outerjoin(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
        .group_by(DocumentModel.district)
        .order_by(desc("total_amount"))
        .limit(10)
        .all()
    )

    constituency_records = (
        db.query(
            func.coalesce(DocumentModel.constituency, "Unknown Constituency").label("constituency"),
            func.count(PaymentModel.id).label("count"),
            func.coalesce(func.sum(PaymentModel.amount), 0).label("total_amount"),
            func.coalesce(func.sum(case((func.lower(PaymentModel.payment_status) == "paid", PaymentModel.amount), else_=0)), 0).label("paid_amount")
        )
        .join(VoterRecordModel, PaymentModel.voter_id == VoterRecordModel.id)
        .outerjoin(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
        .group_by(DocumentModel.constituency)
        .order_by(desc("total_amount"))
        .limit(10)
        .all()
    )

    return {
        "districts": [
            {
                "district": r[0],
                "count": int(r[1] or 0),
                "total_amount": float(r[2] or 0.0),
                "paid_amount": float(r[3] or 0.0)
            }
            for r in district_records
        ],
        "constituencies": [
            {
                "constituency": r[0],
                "count": int(r[1] or 0),
                "total_amount": float(r[2] or 0.0),
                "paid_amount": float(r[3] or 0.0)
            }
            for r in constituency_records
        ]
    }

def _build_payments_query(
    db: Session,
    q: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    area: Optional[str] = None,
    ward: Optional[str] = None,
    payment_status: Optional[str] = None,
    payment_method: Optional[str] = None,
    created_by: Optional[int] = None
):
    """Helper to build filtered query on PaymentModel joined with VoterRecordModel and DocumentModel."""
    query = (
        db.query(PaymentModel)
        .join(VoterRecordModel, PaymentModel.voter_id == VoterRecordModel.id)
        .outerjoin(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
    )

    if q and q.strip():
        term = q.strip()
        query = query.filter(
            or_(
                PaymentModel.transaction_id.ilike(f"%{term}%"),
                PaymentModel.receipt_number.ilike(f"%{term}%"),
                PaymentModel.mobile_number.ilike(f"%{term}%"),
                PaymentModel.transaction_reference.ilike(f"%{term}%"),
                VoterRecordModel.voter_name.ilike(f"%{term}%"),
                VoterRecordModel.voter_id.ilike(f"%{term}%"),
                VoterRecordModel.house_no.ilike(f"%{term}%"),
                DocumentModel.area.ilike(f"%{term}%")
            )
        )

    if from_date:
        try:
            fd = datetime.strptime(from_date, "%Y-%m-%d").date()
            query = query.filter(PaymentModel.payment_date >= fd)
        except ValueError:
            pass

    if to_date:
        try:
            td = datetime.strptime(to_date, "%Y-%m-%d").date()
            query = query.filter(PaymentModel.payment_date <= td)
        except ValueError:
            pass

    if district and district.lower() != "all":
        query = query.filter(DocumentModel.district.ilike(f"%{district}%"))
    if constituency and constituency.lower() != "all":
        query = query.filter(DocumentModel.constituency.ilike(f"%{constituency}%"))
    if area and area.lower() != "all":
        query = query.filter(DocumentModel.area.ilike(f"%{area}%"))
    if ward and ward.lower() != "all":
        query = query.filter(DocumentModel.ward_number.ilike(f"%{ward}%"))

    if payment_status and payment_status.lower() != "all":
        query = query.filter(func.lower(PaymentModel.payment_status) == payment_status.lower())

    if payment_method and payment_method.lower() != "all":
        query = query.filter(func.lower(PaymentModel.payment_method) == payment_method.lower())

    if created_by:
        query = query.filter(PaymentModel.created_by == created_by)

    return query

@app.get("/api/payments", tags=["Payments Dashboard"])
def list_payments(
    q: Optional[str] = Query(None, description="Search voter name, EPIC ID, mobile, or transaction ID"),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    area: Optional[str] = None,
    ward: Optional[str] = None,
    payment_status: Optional[str] = None,
    payment_method: Optional[str] = None,
    created_by: Optional[int] = None,
    sort_by: str = "id",
    order: str = "desc",
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Search and filter payments with pagination, column sorting, and dynamic sub-aggregations.
    """
    query = _build_payments_query(
        db=db,
        q=q,
        from_date=from_date,
        to_date=to_date,
        district=district,
        constituency=constituency,
        area=area,
        ward=ward,
        payment_status=payment_status,
        payment_method=payment_method,
        created_by=created_by
    )

    total = query.count()

    # Sub-aggregations for the filtered dataset
    filtered_total = db.query(func.coalesce(func.sum(PaymentModel.amount), 0)).filter(PaymentModel.id.in_(query.with_entities(PaymentModel.id))).scalar() or 0.0
    filtered_paid = db.query(func.coalesce(func.sum(PaymentModel.amount), 0)).filter(
        PaymentModel.id.in_(query.with_entities(PaymentModel.id)),
        func.lower(PaymentModel.payment_status) == "paid"
    ).scalar() or 0.0
    filtered_pending = db.query(func.coalesce(func.sum(PaymentModel.amount), 0)).filter(
        PaymentModel.id.in_(query.with_entities(PaymentModel.id)),
        func.lower(PaymentModel.payment_status) == "pending"
    ).scalar() or 0.0

    order_col = getattr(PaymentModel, sort_by, PaymentModel.id)
    query = query.order_by(desc(order_col) if order.lower() == "desc" else asc(order_col))

    payments = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "payments": [p.to_dict() for p in payments],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 1,
        "filtered_summary": {
            "total_amount": float(filtered_total),
            "paid_amount": float(filtered_paid),
            "pending_amount": float(filtered_pending),
            "count": total
        }
    }

@app.post("/api/payments", status_code=status.HTTP_201_CREATED, tags=["Payments Dashboard"])
def create_payment(
    req: PaymentCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record a new payment transaction against a selected voter with full validations,
    unique receipt number, transaction ID, and initial audit log.
    """
    voter = db.query(VoterRecordModel).filter(VoterRecordModel.id == req.voter_id).first()
    if not voter:
        raise HTTPException(status_code=404, detail="Selected voter does not exist in the database.")

    clean_mobile = ""
    if req.mobile_number:
        clean_mobile = re.sub(r"\D", "", req.mobile_number)
        if len(clean_mobile) > 10 and clean_mobile.startswith("91"):
            clean_mobile = clean_mobile[2:]
        if clean_mobile and len(clean_mobile) != 10:
            raise HTTPException(status_code=400, detail="Mobile number must be a valid 10-digit number.")

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be a positive number greater than zero.")

    p_date = None
    if req.payment_date:
        try:
            p_date = datetime.strptime(req.payment_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Payment date must be in YYYY-MM-DD format.")
    else:
        p_date = datetime.now(timezone.utc).date()

    method = (req.payment_method or "Cash").strip()
    status_val = (req.payment_status or "Paid").strip()

    # Validate digital transaction reference
    ref_val = req.transaction_reference.strip() if req.transaction_reference else None
    if method in ["UPI", "Bank Transfer"] and status_val == "Paid" and not ref_val:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction reference is required for digital payments via {method}."
        )

    # Check for duplicate digital reference
    if ref_val:
        existing_ref = db.query(PaymentModel).filter(PaymentModel.transaction_reference == ref_val).first()
        if existing_ref:
            raise HTTPException(
                status_code=400,
                detail=f"Transaction reference '{ref_val}' has already been recorded for payment {existing_ref.transaction_id}."
            )

    today_str = datetime.now().strftime("%Y%m%d")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    txn_id = f"TXN-{today_str}-{unique_suffix}"
    rcp_no = f"RCP-{today_str}-{unique_suffix}"

    now_utc = datetime.now(timezone.utc)
    verified_by_id = current_user.id if status_val.lower() == "paid" else None
    verified_at_dt = now_utc if status_val.lower() == "paid" else None

    payment = PaymentModel(
        transaction_id=txn_id,
        receipt_number=rcp_no,
        voter_id=voter.id,
        voter_entry_id=req.voter_entry_id,
        mobile_number=clean_mobile,
        amount=req.amount,
        payment_date=p_date,
        payment_method=method,
        payment_status=status_val,
        transaction_reference=ref_val,
        remarks=req.remarks.strip() if req.remarks else None,
        voter_name=voter.voter_name,
        epic_no=voter.voter_id,
        district=getattr(voter.document, "district", "") if voter.document else "",
        constituency=getattr(voter.document, "constituency", "") if voter.document else "",
        created_by=current_user.id,
        verified_by=verified_by_id,
        verified_at=verified_at_dt,
        created_at=now_utc,
        updated_at=now_utc
    )
    db.add(payment)
    db.flush()

    # Record Audit Log
    db.add(PaymentAuditLogModel(
        payment_id=payment.id,
        action="CREATED",
        new_values=payment.to_dict(),
        reason="Payment registered into system",
        performed_by=current_user.id,
        performed_at=now_utc
    ))

    db.commit()
    db.refresh(payment)

    return {
        "status": "success",
        "message": f"Payment {payment.transaction_id} recorded successfully.",
        "payment": payment.to_dict()
    }

@app.get("/api/payments/voters/search", tags=["Payments Dashboard"])
def search_voters_for_payments(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Search voters by EPIC number, name, house number, area, or mobile number
    and return voter details with financial summaries.
    """
    term = q.strip()
    query = (
        db.query(VoterRecordModel)
        .outerjoin(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
        .outerjoin(VoterEntryModel, VoterRecordModel.id == VoterEntryModel.voter_id)
        .filter(
            or_(
                VoterRecordModel.voter_id.ilike(f"%{term}%"),
                VoterRecordModel.voter_name.ilike(f"%{term}%"),
                VoterRecordModel.house_no.ilike(f"%{term}%"),
                DocumentModel.area.ilike(f"%{term}%"),
                VoterEntryModel.mobile_number.ilike(f"%{term}%")
            )
        )
        .distinct()
    )

    if is_super_admin(current_user):
        pass
    elif is_admin(current_user):
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not admin_assignments:
            return []
        conds = [DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%") for a in admin_assignments if a.constituency]
        query = query.filter(or_(*conds))
    else:
        user_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not user_assignments:
            return []
        conds = []
        for a in user_assignments:
            if a.constituency:
                c_filter = DocumentModel.constituency.ilike(f"%{a.constituency.strip()}%")
                ward_list = a.to_dict().get("wards", [])
                if ward_list and "ALL" not in [w.upper() for w in ward_list]:
                    w_conds = [DocumentModel.ward_number.ilike(f"%{w.strip()}%") for w in ward_list if w.strip()]
                    if w_conds:
                        c_filter = and_(c_filter, or_(*w_conds))
                conds.append(c_filter)
        query = query.filter(or_(*conds))

    voters = query.limit(limit).all()
    return [v.to_dict() for v in voters]

@app.get("/api/payments/voters/{voter_id}/history", tags=["Payments Dashboard"])
def get_voter_payments_history(
    voter_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Returns complete payment history and ledger totals for a selected voter."""
    voter = db.query(VoterRecordModel).filter(VoterRecordModel.id == voter_id).first()
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found.")

    payments = (
        db.query(PaymentModel)
        .filter(PaymentModel.voter_id == voter_id)
        .order_by(PaymentModel.payment_date.desc(), PaymentModel.id.desc())
        .all()
    )

    entries = (
        db.query(VoterEntryModel)
        .filter(VoterEntryModel.voter_id == voter_id)
        .order_by(VoterEntryModel.entry_date.desc())
        .all()
    )

    total_paid = sum(float(p.amount or 0) for p in payments if p.payment_status.lower() == "paid")
    total_pending = sum(float(p.amount or 0) for p in payments if p.payment_status.lower() == "pending")
    total_refunded = sum(float(p.amount or 0) for p in payments if p.payment_status.lower() == "refunded")
    total_entered = sum(float(e.amount or 0) for e in entries)

    return {
        "voter": voter.to_dict(),
        "summary": {
            "total_paid": total_paid,
            "total_pending": total_pending,
            "total_refunded": total_refunded,
            "total_entered_amount": total_entered,
            "payments_count": len(payments),
            "entries_count": len(entries)
        },
        "payments": [p.to_dict() for p in payments],
        "entries": [e.to_dict() for e in entries]
    }

@app.get("/api/payments/reports", tags=["Payments Dashboard"])
def get_payments_reports(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Calculates multi-dimensional financial reports."""
    query = _build_payments_query(
        db=db,
        from_date=from_date,
        to_date=to_date,
        district=district,
        constituency=constituency
    )

    total_amount = db.query(func.coalesce(func.sum(PaymentModel.amount), 0)).filter(PaymentModel.id.in_(query.with_entities(PaymentModel.id))).scalar() or 0.0
    paid_amount = db.query(func.coalesce(func.sum(PaymentModel.amount), 0)).filter(
        PaymentModel.id.in_(query.with_entities(PaymentModel.id)),
        func.lower(PaymentModel.payment_status) == "paid"
    ).scalar() or 0.0
    pending_amount = db.query(func.coalesce(func.sum(PaymentModel.amount), 0)).filter(
        PaymentModel.id.in_(query.with_entities(PaymentModel.id)),
        func.lower(PaymentModel.payment_status) == "pending"
    ).scalar() or 0.0
    total_count = query.count()

    # Breakdown by method
    method_data = (
        db.query(
            PaymentModel.payment_method,
            func.count(PaymentModel.id),
            func.coalesce(func.sum(PaymentModel.amount), 0)
        )
        .filter(PaymentModel.id.in_(query.with_entities(PaymentModel.id)))
        .group_by(PaymentModel.payment_method)
        .all()
    )

    # Breakdown by status
    status_data = (
        db.query(
            PaymentModel.payment_status,
            func.count(PaymentModel.id),
            func.coalesce(func.sum(PaymentModel.amount), 0)
        )
        .filter(PaymentModel.id.in_(query.with_entities(PaymentModel.id)))
        .group_by(PaymentModel.payment_status)
        .all()
    )

    return {
        "report_generated_at": datetime.now(timezone.utc).isoformat(),
        "filters": {
            "from_date": from_date,
            "to_date": to_date,
            "district": district,
            "constituency": constituency
        },
        "summary": {
            "total_count": total_count,
            "total_amount": float(total_amount),
            "paid_amount": float(paid_amount),
            "pending_amount": float(pending_amount),
            "paid_percentage": round(float(paid_amount) / float(total_amount) * 100, 1) if float(total_amount) > 0 else 0.0
        },
        "by_method": [
            {"method": r[0], "count": int(r[1]), "amount": float(r[2])} for r in method_data
        ],
        "by_status": [
            {"status": r[0], "count": int(r[1]), "amount": float(r[2])} for r in status_data
        ]
    }

@app.get("/api/payments/export", tags=["Payments Dashboard"])
def export_payments(
    format: str = Query("csv", pattern="^(csv|excel|xlsx)$"),
    q: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    area: Optional[str] = None,
    ward: Optional[str] = None,
    payment_status: Optional[str] = None,
    payment_method: Optional[str] = None,
    created_by: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Export filtered payment transactions to CSV or formatted Excel (.xlsx)."""
    query = _build_payments_query(
        db=db,
        q=q,
        from_date=from_date,
        to_date=to_date,
        district=district,
        constituency=constituency,
        area=area,
        ward=ward,
        payment_status=payment_status,
        payment_method=payment_method,
        created_by=created_by
    ).order_by(PaymentModel.payment_date.desc(), PaymentModel.id.desc())

    payments = query.all()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if format.lower() == "csv":
        output = StringIO()
        # Write UTF-8 BOM so Excel opens Telugu scripts properly
        output.write('\ufeff')
        writer = csv.writer(output)

        writer.writerow([
            "S.No.",
            "Transaction ID",
            "Receipt Number",
            "Voter ID / EPIC",
            "Voter Name (ఓటరు పేరు)",
            "Relative Name (సంబంధీకుని పేరు)",
            "Mobile Number",
            "District (జిల్లా)",
            "Constituency (నియోజకవర్గం)",
            "Area / Village (గ్రామం/ప్రాంతం)",
            "House No",
            "Amount (₹)",
            "Payment Date",
            "Payment Method",
            "Payment Status",
            "Transaction Reference",
            "Remarks",
            "Created By",
            "Verified By"
        ])

        for idx, p in enumerate(payments, start=1):
            d = p.to_dict()
            writer.writerow([
                idx,
                d["transaction_id"],
                d["receipt_number"],
                d["epic_no"],
                d["voter_name"],
                d["relation_name"],
                d["mobile_number"],
                d["district"],
                d["constituency"],
                d["area"],
                d["house_no"],
                f"{d['amount']:.2f}",
                d["payment_date"],
                d["payment_method"],
                d["payment_status"],
                d["transaction_reference"],
                d["remarks"],
                d["creator_name"],
                d["verifier_name"] or "N/A"
            ])

        output.seek(0)
        filename = f"vms_payments_{timestamp}.csv"
        return StreamingResponse(
            iter([output.getvalue().encode("utf-8-sig")]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    else:
        # Excel (.xlsx) generation using openpyxl
        wb = Workbook()
        ws = wb.active
        ws.title = "VMS Payments Ledger"

        # Styles
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Dark Blue
        border_thin = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )
        currency_format = '₹#,##0.00'

        headers = [
            "S.No.",
            "Transaction ID",
            "Receipt No",
            "Voter ID / EPIC",
            "Voter Name",
            "Relative Name",
            "Mobile Number",
            "District",
            "Constituency",
            "Area / Village",
            "House No",
            "Amount (INR)",
            "Payment Date",
            "Payment Method",
            "Payment Status",
            "Transaction Reference",
            "Remarks",
            "Recorded By",
            "Verified By"
        ]

        ws.append(headers)
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")

        total_amount = 0.0
        for idx, p in enumerate(payments, start=1):
            d = p.to_dict()
            amt = float(d["amount"] or 0.0)
            total_amount += amt

            row_data = [
                idx,
                d["transaction_id"],
                d["receipt_number"],
                d["epic_no"],
                d["voter_name"],
                d["relation_name"],
                d["mobile_number"],
                d["district"],
                d["constituency"],
                d["area"],
                d["house_no"],
                amt,
                d["payment_date"],
                d["payment_method"],
                d["payment_status"],
                d["transaction_reference"],
                d["remarks"],
                d["creator_name"],
                d["verifier_name"] or "N/A"
            ]
            ws.append(row_data)

            # Style row
            row_idx = idx + 1
            for col_idx in range(1, len(headers) + 1):
                c = ws.cell(row=row_idx, column=col_idx)
                c.border = border_thin
                if col_idx == 12:
                    c.number_format = currency_format

        # Total Summary Row
        summary_row = ws.max_row + 1
        ws.cell(row=summary_row, column=11, value="TOTAL:")
        ws.cell(row=summary_row, column=11).font = Font(name="Calibri", size=11, bold=True)
        total_cell = ws.cell(row=summary_row, column=12, value=total_amount)
        total_cell.font = Font(name="Calibri", size=11, bold=True)
        total_cell.number_format = currency_format

        # Auto adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        file_stream = BytesIO()
        wb.save(file_stream)
        file_stream.seek(0)

        filename = f"vms_payments_{timestamp}.xlsx"
        return StreamingResponse(
            file_stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

@app.get("/api/payments/{payment_id}", tags=["Payments Dashboard"])
def get_payment_detail(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Retrieve full payment details with audit trail."""
    payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    res = payment.to_dict()
    res["audit_logs"] = [log.to_dict() for log in payment.audit_logs]
    return res

@app.put("/api/payments/{payment_id}", tags=["Payments Dashboard"])
def update_payment(
    payment_id: int,
    req: PaymentUpdateRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update payment record with audit logging."""
    payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    if payment.payment_status in ["Cancelled", "Refunded"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit payment {payment.transaction_id} because it has already been {payment.payment_status}."
        )

    old_state = payment.to_dict()
    changes = []

    if req.mobile_number is not None:
        if req.mobile_number.strip() == "":
            if payment.mobile_number != "":
                changes.append(f"mobile: {payment.mobile_number} -> (cleared)")
                payment.mobile_number = ""
        else:
            clean_mobile = re.sub(r"\D", "", req.mobile_number)
            if len(clean_mobile) > 10 and clean_mobile.startswith("91"):
                clean_mobile = clean_mobile[2:]
            if clean_mobile and len(clean_mobile) != 10:
                raise HTTPException(status_code=400, detail="Mobile number must be a valid 10-digit number.")
            if payment.mobile_number != clean_mobile:
                changes.append(f"mobile: {payment.mobile_number} -> {clean_mobile}")
                payment.mobile_number = clean_mobile

    if req.amount is not None:
        if req.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than zero.")
        if float(payment.amount) != float(req.amount):
            changes.append(f"amount: {payment.amount} -> {req.amount}")
            payment.amount = req.amount

    if req.payment_date is not None:
        try:
            d_val = datetime.strptime(req.payment_date, "%Y-%m-%d").date()
            if payment.payment_date != d_val:
                changes.append(f"date: {payment.payment_date} -> {d_val}")
                payment.payment_date = d_val
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    if req.payment_method is not None:
        if payment.payment_method != req.payment_method:
            changes.append(f"method: {payment.payment_method} -> {req.payment_method}")
            payment.payment_method = req.payment_method

    if req.transaction_reference is not None:
        new_ref = req.transaction_reference.strip() if req.transaction_reference else None
        if payment.transaction_reference != new_ref:
            changes.append(f"reference: {payment.transaction_reference} -> {new_ref}")
            payment.transaction_reference = new_ref

    if req.remarks is not None:
        payment.remarks = req.remarks.strip() if req.remarks else None

    payment.updated_by = current_user.id
    payment.updated_at = datetime.now(timezone.utc)

    db.add(PaymentAuditLogModel(
        payment_id=payment.id,
        action="UPDATED",
        old_values=old_state,
        new_values=payment.to_dict(),
        reason=f"Edited fields: {', '.join(changes)}" if changes else "Updated remarks",
        performed_by=current_user.id,
        performed_at=payment.updated_at
    ))

    db.commit()
    db.refresh(payment)

    return {
        "status": "success",
        "message": "Payment updated successfully.",
        "payment": payment.to_dict()
    }

@app.post("/api/payments/{payment_id}/verify", tags=["Payments Dashboard"])
def verify_payment(
    payment_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Transition payment from Pending to Paid with verification audit trail."""
    payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    if payment.payment_status.lower() == "paid":
        raise HTTPException(status_code=400, detail="Payment is already marked as Paid.")

    if payment.payment_status in ["Cancelled", "Refunded"]:
        raise HTTPException(status_code=400, detail=f"Cannot verify a {payment.payment_status} payment.")

    old_state = payment.to_dict()
    now_utc = datetime.now(timezone.utc)

    payment.payment_status = "Paid"
    payment.verified_by = current_user.id
    payment.verified_at = now_utc
    payment.updated_by = current_user.id
    payment.updated_at = now_utc

    db.add(PaymentAuditLogModel(
        payment_id=payment.id,
        action="VERIFIED",
        old_values=old_state,
        new_values=payment.to_dict(),
        reason=f"Payment verified and confirmed as Paid by @{current_user.username}",
        performed_by=current_user.id,
        performed_at=now_utc
    ))

    db.commit()
    db.refresh(payment)

    return {
        "status": "success",
        "message": f"Payment {payment.transaction_id} verified as Paid.",
        "payment": payment.to_dict()
    }

@app.post("/api/payments/{payment_id}/cancel", tags=["Payments Dashboard"])
def cancel_payment(
    payment_id: int,
    req: PaymentActionReasonRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel payment with mandatory reason."""
    payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    if payment.payment_status == "Cancelled":
        raise HTTPException(status_code=400, detail="Payment is already Cancelled.")

    if payment.payment_status == "Refunded":
        raise HTTPException(status_code=400, detail="Cannot cancel a refunded payment.")

    if not req.reason or len(req.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="A valid cancellation reason is required.")

    old_state = payment.to_dict()
    now_utc = datetime.now(timezone.utc)

    payment.payment_status = "Cancelled"
    payment.updated_by = current_user.id
    payment.updated_at = now_utc

    db.add(PaymentAuditLogModel(
        payment_id=payment.id,
        action="CANCELLED",
        old_values=old_state,
        new_values=payment.to_dict(),
        reason=req.reason.strip(),
        performed_by=current_user.id,
        performed_at=now_utc
    ))

    db.commit()
    db.refresh(payment)

    return {
        "status": "success",
        "message": f"Payment {payment.transaction_id} marked as Cancelled.",
        "payment": payment.to_dict()
    }

@app.post("/api/payments/{payment_id}/refund", tags=["Payments Dashboard"])
def refund_payment(
    payment_id: int,
    req: PaymentActionReasonRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Refund payment with mandatory reason. Only Paid transactions can be refunded."""
    payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    if payment.payment_status.lower() != "paid":
        raise HTTPException(status_code=400, detail="Only verified 'Paid' transactions can be refunded.")

    if not req.reason or len(req.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="A valid refund reason is required.")

    old_state = payment.to_dict()
    now_utc = datetime.now(timezone.utc)

    payment.payment_status = "Refunded"
    payment.updated_by = current_user.id
    payment.updated_at = now_utc

    db.add(PaymentAuditLogModel(
        payment_id=payment.id,
        action="REFUNDED",
        old_values=old_state,
        new_values=payment.to_dict(),
        reason=req.reason.strip(),
        performed_by=current_user.id,
        performed_at=now_utc
    ))

    db.commit()
    db.refresh(payment)

    return {
        "status": "success",
        "message": f"Payment {payment.transaction_id} refunded successfully.",
        "payment": payment.to_dict()
    }

@app.delete("/api/payments/{payment_id}", tags=["Payments Dashboard"])
def delete_payment(
    payment_id: int,
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Permanently delete payment record (Administrator only, audited)."""
    payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    db.add(AuditLogModel(
        user_id=current_user.id,
        action="DELETE_PAYMENT",
        details=f"Deleted payment ID {payment.id} (Txn: {payment.transaction_id}, Amount: ₹{payment.amount}, Voter: {payment.voter.voter_name if payment.voter else 'N/A'})",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))

    db.delete(payment)
    db.commit()

    return {
        "status": "success",
        "message": f"Payment record {payment_id} deleted successfully.",
        "id": payment_id
    }

@app.get("/api/payments/{payment_id}/receipt", tags=["Payments Dashboard"])
def get_payment_receipt(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Generate complete official receipt data for printing and PDF generation.
    Does not mark Pending or Failed as Paid.
    """
    payment = db.query(PaymentModel).filter(PaymentModel.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    voter = payment.voter
    doc = voter.document if voter else None

    # Determine Receipt Type and Watermark
    status_lower = payment.payment_status.lower()
    if status_lower == "paid":
        receipt_title = "OFFICIAL PAYMENT RECEIPT"
        watermark = "PAID"
        is_paid = True
    elif status_lower == "pending":
        receipt_title = "PAYMENT ACKNOWLEDGEMENT (PENDING VERIFICATION)"
        watermark = "PENDING"
        is_paid = False
    elif status_lower == "cancelled":
        receipt_title = "VOID PAYMENT VOUCHER (CANCELLED)"
        watermark = "VOID"
        is_paid = False
    elif status_lower == "refunded":
        receipt_title = "OFFICIAL REFUND VOUCHER"
        watermark = "REFUNDED"
        is_paid = False
    else:
        receipt_title = "TRANSACTION ACKNOWLEDGEMENT"
        watermark = payment.payment_status.upper()
        is_paid = False

    amount_val = float(payment.amount or 0.0)
    words = number_to_words_inr(amount_val)

    return {
        "receipt_number": payment.receipt_number,
        "transaction_id": payment.transaction_id,
        "receipt_title": receipt_title,
        "watermark": watermark,
        "is_paid": is_paid,
        "payment_status": payment.payment_status,
        "payment_date": payment.payment_date.isoformat(),
        "issued_at": datetime.now(timezone.utc).strftime("%d-%b-%Y %I:%M %p"),
        "amount": amount_val,
        "amount_formatted": f"₹{amount_val:,.2f}",
        "amount_in_words": words,
        "payment_method": payment.payment_method,
        "transaction_reference": payment.transaction_reference or "N/A",
        "remarks": payment.remarks or "",
        "voter": {
            "id": voter.id if voter else None,
            "voter_name": voter.voter_name if voter else "Not Available",
            "epic_no": voter.voter_id if voter else "Not Available",
            "relation_name": voter.relation_name if voter else "Not Available",
            "relation_type": voter.relation_type if voter else "Not Available",
            "age": voter.age if voter else "Not Available",
            "gender": voter.gender if voter else "Not Available",
            "house_no": voter.house_no if voter else "Not Available",
            "serial_no": voter.serial_no if voter else "Not Available",
            "mobile_number": payment.mobile_number,
            "district": getattr(doc, "district", None) or "Not Available",
            "constituency": getattr(doc, "constituency", None) or "Not Available",
            "area": getattr(doc, "area", None) or "Not Available",
            "ward_number": getattr(doc, "ward_number", None) or "Not Available",
        },
        "creator": {
            "name": payment.creator.full_name if payment.creator else "System",
            "username": payment.creator.username if payment.creator else "system",
        },
        "verifier": {
            "name": payment.verifier.full_name if payment.verifier else None,
            "username": payment.verifier.username if payment.verifier else None,
            "verified_at": payment.verified_at.strftime("%d-%b-%Y %I:%M %p") if payment.verified_at else None,
        },
        "organization": {
            "name": "VMS – Voter Management System",
            "telugu_name": "ఓటర్ మేనేజ్‌మెంట్ సిస్టమ్",
            "tagline": "Smart Voter Data Extraction & Management System",
            "jurisdiction": "Electoral Roll Management & Voter Services",
        },
        "disclaimer": "This is an official computer-generated receipt from the Voter Management System (VMS). Valid without physical signature when verified."
    }

# -------------------------------------------------------------
# 16. Complete RBAC APIs (Roles, Permissions, User Mapping, Audit)
# -------------------------------------------------------------

@app.get("/api/admin/roles", tags=["RBAC Module"])
@app.get("/api/rbac/roles", tags=["RBAC Module"])
def list_rbac_roles(
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all system and custom roles with their assigned permissions and user counts."""
    roles = db.query(RoleModel).order_by(RoleModel.id.asc()).all()
    return [r.to_dict(include_permissions=True) for r in roles]

@app.post("/api/rbac/roles", status_code=status.HTTP_201_CREATED, tags=["RBAC Module"])
def create_rbac_role(
    req: RoleCreateRequest,
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new custom role with specified permissions. Administrator only."""
    clean_name = req.role_name.strip().lower()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Role name is required.")

    existing = db.query(RoleModel).filter(RoleModel.role_name.ilike(clean_name)).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Role with name '{clean_name}' already exists.")

    new_role = RoleModel(
        role_name=clean_name,
        description=req.description.strip() if req.description else None,
        is_system=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_role)
    db.flush()

    if req.permission_codes:
        perms = db.query(PermissionModel).filter(PermissionModel.code.in_(req.permission_codes)).all()
        for p in perms:
            db.add(RolePermissionModel(role_id=new_role.id, permission_id=p.id, created_at=datetime.now(timezone.utc)))

    db.add(AuditLogModel(
        user_id=current_user.id,
        action="CREATE_ROLE",
        details=f"Created custom role '{clean_name}' with {len(req.permission_codes)} permission(s).",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()
    db.refresh(new_role)

    return {
        "status": "success",
        "message": f"Role '{clean_name}' created successfully.",
        "role": new_role.to_dict(include_permissions=True)
    }

@app.get("/api/rbac/roles/{role_id}", tags=["RBAC Module"])
def get_rbac_role(role_id: int, current_user: UserModel = Depends(require_admin), db: Session = Depends(get_db)):
    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")
    return role.to_dict(include_permissions=True)

@app.put("/api/rbac/roles/{role_id}", tags=["RBAC Module"])
def update_rbac_role(
    role_id: int,
    req: RoleUpdateRequest,
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update role description and assigned permissions. Cannot downgrade Administrator role."""
    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")

    if role.role_name.lower() == "admin":
        if req.permission_codes is not None and len(req.permission_codes) < db.query(PermissionModel).count():
            raise HTTPException(status_code=400, detail="Administrator system role permissions cannot be removed.")

    if req.description is not None:
        role.description = req.description.strip() if req.description else None

    if req.permission_codes is not None:
        db.query(RolePermissionModel).filter(RolePermissionModel.role_id == role.id).delete()
        perms = db.query(PermissionModel).filter(PermissionModel.code.in_(req.permission_codes)).all()
        for p in perms:
            db.add(RolePermissionModel(role_id=role.id, permission_id=p.id, created_at=datetime.now(timezone.utc)))

    role.updated_at = datetime.now(timezone.utc)

    db.add(AuditLogModel(
        user_id=current_user.id,
        action="UPDATE_ROLE_PERMISSIONS",
        details=f"Updated role '{role.role_name}' permissions.",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()
    db.refresh(role)

    return {
        "status": "success",
        "message": f"Role '{role.role_name}' updated successfully.",
        "role": role.to_dict(include_permissions=True)
    }

@app.delete("/api/rbac/roles/{role_id}", tags=["RBAC Module"])
def delete_rbac_role(
    role_id: int,
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a custom role. System roles cannot be deleted."""
    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")

    if role.is_system or role.role_name.lower() in ["admin", "operator", "viewer", "user"]:
        raise HTTPException(status_code=400, detail=f"System role '{role.role_name}' cannot be deleted.")

    assigned_count = len(role.user_roles) if role.user_roles else 0
    if assigned_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role '{role.role_name}'. It is assigned to {assigned_count} user(s).")

    role_name = role.role_name
    db.delete(role)

    db.add(AuditLogModel(
        user_id=current_user.id,
        action="DELETE_ROLE",
        details=f"Deleted custom role '{role_name}'.",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()

    return {
        "status": "success",
        "message": f"Role '{role_name}' deleted successfully.",
        "id": role_id
    }

@app.get("/api/rbac/permissions", tags=["RBAC Module"])
def list_rbac_permissions(db: Session = Depends(get_db)):
    """List all available permissions grouped by module."""
    perms = db.query(PermissionModel).order_by(PermissionModel.module.asc(), PermissionModel.action.asc()).all()
    grouped = {}
    for p in perms:
        if p.module not in grouped:
            grouped[p.module] = []
        grouped[p.module].append(p.to_dict())
    return {
        "permissions": [p.to_dict() for p in perms],
        "grouped": grouped
    }

@app.get("/api/rbac/users", tags=["RBAC Module"])
def list_rbac_users(
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all users with their assigned roles and effective permissions."""
    users = db.query(UserModel).order_by(UserModel.id.asc()).all()
    result = []
    for u in users:
        u_dict = u.to_dict()
        u_dict["effective_permissions"] = list(get_user_permissions(u, db))
        result.append(u_dict)
    return result

@app.post("/api/rbac/users/{user_id}/roles", tags=["RBAC Module"])
def assign_user_role(
    user_id: int,
    req: UserRoleAssignRequest,
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Assign or change a user's role. Administrator only."""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    target_role = db.query(RoleModel).filter(RoleModel.role_name.ilike(req.role_name.strip())).first()
    if not target_role:
        raise HTTPException(status_code=404, detail=f"Role '{req.role_name}' does not exist.")

    if user.role.lower() == "admin" and target_role.role_name.lower() != "admin":
        admin_count = db.query(UserModel).filter(UserModel.role == "admin", UserModel.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot downgrade the only active Administrator account.")

    old_role = user.role
    user.role = target_role.role_name.lower()
    user.updated_at = datetime.now(timezone.utc)

    db.query(UserRoleModel).filter(UserRoleModel.user_id == user.id).delete()
    db.add(UserRoleModel(user_id=user.id, role_id=target_role.id, created_at=datetime.now(timezone.utc)))

    db.add(AuditLogModel(
        user_id=current_user.id,
        action="ASSIGN_USER_ROLE",
        details=f"Changed user '{user.username}' role from '{old_role}' to '{target_role.role_name}'.",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": f"User '{user.username}' assigned to role '{target_role.role_name}'.",
        "user": user.to_dict()
    }

@app.get("/api/rbac/my-permissions", tags=["RBAC Module"])
def get_my_permissions(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return effective permissions and roles for current user to control frontend UI actions."""
    perms = get_user_permissions(current_user, db)
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "is_admin": is_admin_or_super(current_user),
        "permissions": sorted(list(perms))
    }

@app.get("/api/rbac/audit-logs", tags=["RBAC Module"])
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Return recent audit logs for role and permission changes."""
    logs = db.query(AuditLogModel).order_by(desc(AuditLogModel.created_at)).limit(limit).all()
    return [l.to_dict() for l in logs]

# =====================================================================
# 13. WALLET MANAGEMENT & CONSTITUENCY/WARD VOTER ALLOCATION
# =====================================================================

class FundAdminWalletRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Funding amount must be greater than zero")
    transaction_date: Optional[datetime] = None
    payment_method: str = "Bank Transfer"
    transaction_reference: Optional[str] = None
    funding_source: Optional[str] = "Manual Entry"
    verification_status: Optional[str] = "Verified"
    remarks: Optional[str] = None

class AllocateUserWalletRequest(BaseModel):
    user_id: int
    amount: float = Field(..., gt=0, description="Allocation amount must be greater than zero")
    allocation_date: Optional[datetime] = None
    remarks: Optional[str] = None
    idempotency_key: Optional[str] = None

class CreateGeographicAssignmentRequest(BaseModel):
    user_id: int
    district: str
    constituency: str
    wards: List[str] = Field(default_factory=list)
    area: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str = "ACTIVE"

class UpdateGeographicAssignmentRequest(BaseModel):
    district: Optional[str] = None
    constituency: Optional[str] = None
    wards: Optional[List[str]] = None
    area: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None

class CreateDistrictRequest(BaseModel):
    name: str
    code: Optional[str] = None
    state: Optional[str] = "Andhra Pradesh"

class UpdateDistrictRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    state: Optional[str] = None

class CreateConstituencyRequest(BaseModel):
    name: str
    code: Optional[str] = None
    district_id: Optional[int] = None
    district_name: str

class UpdateConstituencyRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    district_id: Optional[int] = None
    district_name: Optional[str] = None

class CreateWardRequest(BaseModel):
    ward_number: str
    constituency_id: Optional[int] = None
    constituency_name: str
    area_name: Optional[str] = None
    description: Optional[str] = None

class UpdateWardRequest(BaseModel):
    ward_number: Optional[str] = None
    constituency_id: Optional[int] = None
    constituency_name: Optional[str] = None
    area_name: Optional[str] = None
    description: Optional[str] = None

class AssignVoterAmountRequest(BaseModel):
    voter_id: int
    amount: float = Field(..., gt=0, description="Amount to assign must be greater than zero")
    assignment_date: Optional[datetime] = None
    remarks: Optional[str] = None
    idempotency_key: Optional[str] = None

class ReverseAllocationRequest(BaseModel):
    reason: str = Field(..., min_length=3, description="A valid reason is required for reversal")

def get_or_create_admin_wallet(db: Session, admin_id: int) -> WalletModel:
    w = db.query(WalletModel).filter(WalletModel.owner_type == "ADMIN", WalletModel.owner_id == admin_id).first()
    if not w:
        w = WalletModel(
            owner_type="ADMIN",
            owner_id=admin_id,
            available_balance=Decimal("0.00"),
            currency="INR",
            status="ACTIVE",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(w)
        db.commit()
        db.refresh(w)
    return w

def get_or_create_user_wallet(db: Session, user_id: int) -> WalletModel:
    w = db.query(WalletModel).filter(WalletModel.owner_type == "USER", WalletModel.owner_id == user_id).first()
    if not w:
        w = WalletModel(
            owner_type="USER",
            owner_id=user_id,
            available_balance=Decimal("0.00"),
            currency="INR",
            status="ACTIVE",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(w)
        db.commit()
        db.refresh(w)
    return w

# --- Admin Wallet Endpoints ---

@app.get("/api/admin/wallet", tags=["Wallet Management"])
def get_admin_wallet(
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    wallet = get_or_create_admin_wallet(db, current_admin.id)
    
    total_added = db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
        WalletTransactionModel.wallet_id == wallet.id,
        WalletTransactionModel.transaction_type == "ADMIN_WALLET_CREDIT",
        WalletTransactionModel.direction == "CREDIT"
    ).scalar()

    total_allocated = db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
        WalletTransactionModel.wallet_id == wallet.id,
        WalletTransactionModel.transaction_type == "ADMIN_TO_USER_ALLOCATION",
        WalletTransactionModel.direction == "DEBIT"
    ).scalar()

    total_spent_by_users = db.query(func.coalesce(func.sum(VoterAmountAllocationModel.amount), 0)).filter(
        VoterAmountAllocationModel.status == "ACTIVE"
    ).scalar()

    total_refunds = db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
        WalletTransactionModel.transaction_type.in_(["TRANSACTION_REVERSAL", "REFUND"])
    ).scalar()

    recent_txs = db.query(WalletTransactionModel).filter(
        WalletTransactionModel.wallet_id == wallet.id
    ).order_by(desc(WalletTransactionModel.created_at)).limit(10).all()

    return {
        "wallet": wallet.to_dict(),
        "available_balance": float(wallet.available_balance or 0.0),
        "total_amount_added": float(total_added or 0.0),
        "total_allocated_to_users": float(total_allocated or 0.0),
        "total_spent_by_users": float(total_spent_by_users or 0.0),
        "total_refunds": float(total_refunds or 0.0),
        "recent_transactions": [tx.to_dict() for tx in recent_txs]
    }

@app.post("/api/admin/wallet/fund", tags=["Wallet Management"])
def fund_admin_wallet(
    req: FundAdminWalletRequest,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Funding amount must be greater than zero.")

    get_or_create_admin_wallet(db, current_admin.id)
    wallet = db.query(WalletModel).filter(
        WalletModel.owner_type == "ADMIN",
        WalletModel.owner_id == current_admin.id
    ).with_for_update().first()

    balance_before = wallet.available_balance
    wallet.available_balance += Decimal(str(req.amount))
    balance_after = wallet.available_balance
    wallet.updated_at = datetime.now(timezone.utc)

    tx_id = f"WTXN-FUND-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    tx = WalletTransactionModel(
        transaction_id=tx_id,
        wallet_id=wallet.id,
        transaction_type="ADMIN_WALLET_CREDIT",
        direction="CREDIT",
        amount=Decimal(str(req.amount)),
        balance_before=balance_before,
        balance_after=balance_after,
        reference_type="FUNDING",
        reference_id=req.transaction_reference or tx_id,
        payment_method=req.payment_method,
        remarks=req.remarks or f"Funded via {req.payment_method}. Source: {req.funding_source}, Status: {req.verification_status}",
        created_by=current_admin.id,
        created_at=req.transaction_date or datetime.now(timezone.utc)
    )
    db.add(tx)

    db.add(AuditLogModel(
        user_id=current_admin.id,
        action="ADMIN_WALLET_FUNDED",
        details=f"Admin added ₹{req.amount:,.2f} to wallet via {req.payment_method} (Ref: {req.transaction_reference or tx_id}). Balance: ₹{balance_after:,.2f}",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()
    db.refresh(wallet)

    return {
        "status": "ok",
        "message": f"Successfully added ₹{req.amount:,.2f} to Admin Wallet.",
        "wallet": wallet.to_dict(),
        "transaction": tx.to_dict()
    }

@app.get("/api/admin/wallet/transactions", tags=["Wallet Management"])
def get_admin_wallet_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    direction: Optional[str] = None,
    transaction_type: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    wallet = get_or_create_admin_wallet(db, current_admin.id)
    q = db.query(WalletTransactionModel).filter(WalletTransactionModel.wallet_id == wallet.id)

    if direction:
        q = q.filter(WalletTransactionModel.direction == direction.upper())
    if transaction_type:
        q = q.filter(WalletTransactionModel.transaction_type == transaction_type)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(
            WalletTransactionModel.transaction_id.ilike(term),
            WalletTransactionModel.reference_id.ilike(term),
            WalletTransactionModel.remarks.ilike(term)
        ))
    if from_date:
        try:
            fd = datetime.fromisoformat(from_date)
            q = q.filter(WalletTransactionModel.created_at >= fd)
        except Exception:
            pass
    if to_date:
        try:
            td = datetime.fromisoformat(to_date)
            q = q.filter(WalletTransactionModel.created_at <= td)
        except Exception:
            pass

    total = q.count()
    items = q.order_by(desc(WalletTransactionModel.created_at)).offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [tx.to_dict() for tx in items],
        "total": total,
        "page": page,
        "limit": limit
    }

# --- User Wallet Allocation Endpoints (Admin -> User) ---

@app.get("/api/admin/wallet/users", tags=["Wallet Management"])
def list_user_wallets(
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(UserModel).order_by(UserModel.username).all()
    res = []
    for u in users:
        w = db.query(WalletModel).filter(WalletModel.owner_type == "USER", WalletModel.owner_id == u.id).first()
        assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == u.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        constituencies = sorted(list(set(a.constituency for a in assignments if a.constituency)))
        wards_set = set()
        for a in assignments:
            for w_val in a.to_dict()["wards"]:
                wards_set.add(str(w_val))
        wards = sorted(list(wards_set))

        total_allocated = 0.0
        total_spent = 0.0
        if w:
            total_allocated = float(db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
                WalletTransactionModel.wallet_id == w.id,
                WalletTransactionModel.transaction_type == "USER_WALLET_CREDIT"
            ).scalar() or 0.0)
            total_spent = float(db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
                WalletTransactionModel.wallet_id == w.id,
                WalletTransactionModel.transaction_type == "VOTER_AMOUNT_DEBIT"
            ).scalar() or 0.0)

        res.append({
            "user_id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "assigned_constituency": ", ".join(constituencies) if constituencies else "None Assigned",
            "assigned_wards": ", ".join(wards) if wards else "All / None",
            "has_geographic_assignment": len(assignments) > 0,
            "available_balance": float(w.available_balance if w else 0.0),
            "total_allocated": total_allocated,
            "total_spent": total_spent,
            "status": "Active" if (w and w.status == "ACTIVE" and u.is_active) else "Inactive"
        })
    return res

@app.post("/api/admin/wallet/allocate", tags=["Wallet Management"])
def allocate_amount_to_user(
    req: AllocateUserWalletRequest,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Allocation amount must be greater than zero.")

    if req.idempotency_key:
        existing_tx = db.query(WalletTransactionModel).filter(
            WalletTransactionModel.idempotency_key == req.idempotency_key
        ).first()
        if existing_tx:
            admin_wallet = get_or_create_admin_wallet(db, current_admin.id)
            user_wallet = get_or_create_user_wallet(db, req.user_id)
            return {
                "status": "ok",
                "message": "Allocation already processed (idempotency key matched).",
                "admin_balance": float(admin_wallet.available_balance),
                "user_balance": float(user_wallet.available_balance),
                "transaction_id": existing_tx.transaction_id
            }

    target_user = db.query(UserModel).filter(UserModel.id == req.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found.")
    if not target_user.is_active:
        raise HTTPException(status_code=400, detail="Cannot allocate funds to an inactive user account.")

    get_or_create_admin_wallet(db, current_admin.id)
    get_or_create_user_wallet(db, target_user.id)

    admin_wallet = db.query(WalletModel).filter(
        WalletModel.owner_type == "ADMIN",
        WalletModel.owner_id == current_admin.id
    ).with_for_update().first()

    user_wallet = db.query(WalletModel).filter(
        WalletModel.owner_type == "USER",
        WalletModel.owner_id == target_user.id
    ).with_for_update().first()

    alloc_amount = Decimal(str(req.amount))
    if admin_wallet.available_balance < alloc_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient Admin Wallet balance. Available: ₹{admin_wallet.available_balance:,.2f}, Requested: ₹{req.amount:,.2f}."
        )

    admin_before = admin_wallet.available_balance
    admin_wallet.available_balance -= alloc_amount
    admin_after = admin_wallet.available_balance
    admin_wallet.updated_at = datetime.now(timezone.utc)

    user_before = user_wallet.available_balance
    user_wallet.available_balance += alloc_amount
    user_after = user_wallet.available_balance
    user_wallet.updated_at = datetime.now(timezone.utc)

    date_now = req.allocation_date or datetime.now(timezone.utc)
    admin_tx_id = f"WTXN-ALOC-OUT-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    user_tx_id = f"WTXN-ALOC-IN-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"

    admin_tx = WalletTransactionModel(
        transaction_id=admin_tx_id,
        wallet_id=admin_wallet.id,
        transaction_type="ADMIN_TO_USER_ALLOCATION",
        direction="DEBIT",
        amount=alloc_amount,
        balance_before=admin_before,
        balance_after=admin_after,
        reference_type="USER_ALLOCATION",
        reference_id=str(target_user.id),
        remarks=req.remarks or f"Allocated ₹{req.amount:,.2f} to user @{target_user.username}",
        idempotency_key=req.idempotency_key,
        created_by=current_admin.id,
        created_at=date_now
    )
    user_tx = WalletTransactionModel(
        transaction_id=user_tx_id,
        wallet_id=user_wallet.id,
        transaction_type="USER_WALLET_CREDIT",
        direction="CREDIT",
        amount=alloc_amount,
        balance_before=user_before,
        balance_after=user_after,
        reference_type="ADMIN_ALLOCATION",
        reference_id=str(admin_wallet.id),
        remarks=req.remarks or f"Received ₹{req.amount:,.2f} allocation from Admin",
        idempotency_key=req.idempotency_key,
        created_by=current_admin.id,
        created_at=date_now
    )
    db.add(admin_tx)
    db.add(user_tx)

    db.add(AuditLogModel(
        user_id=current_admin.id,
        action="USER_WALLET_ALLOCATED",
        details=f"Admin allocated ₹{req.amount:,.2f} to user @{target_user.username}. Admin balance: ₹{admin_after:,.2f}, User balance: ₹{user_after:,.2f}",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()

    return {
        "status": "ok",
        "message": f"Successfully allocated ₹{req.amount:,.2f} to @{target_user.username}.",
        "admin_balance": float(admin_after),
        "user_balance": float(user_after),
        "admin_transaction_id": admin_tx_id,
        "user_transaction_id": user_tx_id
    }

@app.get("/api/admin/wallet/users/{user_id}/transactions", tags=["Wallet Management"])
def get_user_wallet_transactions_admin(
    user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    wallet = get_or_create_user_wallet(db, user_id)
    q = db.query(WalletTransactionModel).filter(WalletTransactionModel.wallet_id == wallet.id)
    total = q.count()
    items = q.order_by(desc(WalletTransactionModel.created_at)).offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [tx.to_dict() for tx in items],
        "total": total,
        "page": page,
        "limit": limit
    }

# --- Geographic Assignment Endpoints ---

@app.get("/api/admin/user-assignments", tags=["Geographic Assignment"])
def list_user_geographic_assignments(
    user_id: Optional[int] = None,
    constituency: Optional[str] = None,
    status: Optional[str] = None,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    q = db.query(UserGeographicAssignmentModel)
    if not is_super_admin(current_admin):
        # Admin sees only assignments created by them or within their assigned constituencies
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_admin.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        admin_constituencies = [a.constituency for a in admin_assignments if a.constituency]
        if not admin_constituencies:
            q = q.filter(UserGeographicAssignmentModel.assigned_by == current_admin.id)
        else:
            conds = [UserGeographicAssignmentModel.assigned_by == current_admin.id]
            for c in admin_constituencies:
                conds.append(UserGeographicAssignmentModel.constituency.ilike(f"%{c.strip()}%"))
            q = q.filter(or_(*conds))

    if user_id:
        q = q.filter(UserGeographicAssignmentModel.user_id == user_id)
    if constituency:
        q = q.filter(UserGeographicAssignmentModel.constituency.ilike(f"%{constituency}%"))
    if status:
        q = q.filter(UserGeographicAssignmentModel.status == status.upper())
    assignments = q.order_by(desc(UserGeographicAssignmentModel.created_at)).all()
    return [a.to_dict() for a in assignments]

@app.post("/api/admin/user-assignments", tags=["Geographic Assignment"])
def create_user_geographic_assignment(
    req: CreateGeographicAssignmentRequest,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    import json
    u = db.query(UserModel).filter(UserModel.id == req.user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")

    # Privilege and scope validation
    if not is_super_admin(current_admin):
        # Admin cannot assign other Admins or Super Admins
        if u.role in ("admin", "super_admin", "superadmin"):
            raise HTTPException(status_code=403, detail="Admins can only assign geographic access to standard Users.")

        # Admin can ONLY assign within their authorized geographic scope
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_admin.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not admin_assignments:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You do not have any active geographic assignment to delegate to users."
            )

        authorized = False
        for a in admin_assignments:
            # Constituency match check
            if req.constituency.strip().lower() in a.constituency.strip().lower() or a.constituency.strip().lower() in req.constituency.strip().lower():
                ward_list = a.to_dict().get("wards", [])
                if not ward_list or "ALL" in [w.upper() for w in ward_list]:
                    authorized = True
                    break
                clean_admin_wards = [re.sub(r'[^0-9a-zA-Z]', '', str(w).lower()) for w in ward_list]
                clean_user_wards = [re.sub(r'[^0-9a-zA-Z]', '', str(w).lower()) for w in req.wards]
                if all(w in clean_admin_wards for w in clean_user_wards):
                    authorized = True
                    break

        if not authorized:
            allowed_scope = ", ".join(f"{a.constituency} (Wards: {a.to_dict().get('wards_display', 'All')})" for a in admin_assignments)
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You can only assign users within your authorized geographic scope: {allowed_scope}."
            )

    wards_json = json.dumps(req.wards)
    assignment = UserGeographicAssignmentModel(
        user_id=req.user_id,
        district=req.district.strip(),
        constituency=req.constituency.strip(),
        wards=wards_json,
        area=req.area.strip() if req.area else None,
        start_date=req.start_date,
        end_date=req.end_date,
        status=req.status.upper(),
        assigned_by=current_admin.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(assignment)
    db.add(AuditLogModel(
        user_id=current_admin.id,
        action="GEO_ASSIGNMENT_CREATED",
        details=f"Assigned user @{u.username} to Constituency '{req.constituency}', Wards: {', '.join(req.wards) if req.wards else 'All'}",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()
    db.refresh(assignment)
    return assignment.to_dict()

@app.put("/api/admin/user-assignments/{assignment_id}", tags=["Geographic Assignment"])
def update_user_geographic_assignment(
    assignment_id: int,
    req: UpdateGeographicAssignmentRequest,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    import json
    a = db.query(UserGeographicAssignmentModel).filter(UserGeographicAssignmentModel.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Geographic assignment not found.")

    if not is_super_admin(current_admin):
        # Admin can only update assignments they created or for users in their scope
        if a.assigned_by != current_admin.id:
            raise HTTPException(status_code=403, detail="Admins cannot modify assignments created by other administrators.")

    if req.district is not None:
        a.district = req.district.strip()
    if req.constituency is not None:
        a.constituency = req.constituency.strip()
    if req.wards is not None:
        a.wards = json.dumps(req.wards)
    if req.area is not None:
        a.area = req.area.strip() if req.area else None
    if req.start_date is not None:
        a.start_date = req.start_date
    if req.end_date is not None:
        a.end_date = req.end_date
    if req.status is not None:
        a.status = req.status.upper()

    a.updated_at = datetime.now(timezone.utc)
    db.add(AuditLogModel(
        user_id=current_admin.id,
        action="GEO_ASSIGNMENT_UPDATED",
        details=f"Updated geographic assignment #{a.id} for user #{a.user_id}",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()
    db.refresh(a)
    return a.to_dict()

@app.delete("/api/admin/user-assignments/{assignment_id}", tags=["Geographic Assignment"])
def delete_user_geographic_assignment(
    assignment_id: int,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    a = db.query(UserGeographicAssignmentModel).filter(UserGeographicAssignmentModel.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Geographic assignment not found.")

    if not is_super_admin(current_admin) and a.assigned_by != current_admin.id:
        raise HTTPException(status_code=403, detail="Admins cannot delete assignments created by other administrators.")

    user_name = a.user.username if a.user else str(a.user_id)
    db.delete(a)
    db.add(AuditLogModel(
        user_id=current_admin.id,
        action="GEO_ASSIGNMENT_REVOKED",
        details=f"Revoked geographic assignment #{assignment_id} for user @{user_name}",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()
    return {"status": "ok", "message": "Assignment revoked successfully."}

# --- Constituency & Ward Master Management (Super Admin ONLY for mutations) ---

@app.get("/api/admin/districts", tags=["Master Geographic Management"])
def list_districts(
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    districts = db.query(DistrictModel).order_by(DistrictModel.name.asc()).all()
    return [d.to_dict() for d in districts]

@app.post("/api/admin/districts", tags=["Master Geographic Management"], status_code=status.HTTP_201_CREATED)
def create_district(
    req: CreateDistrictRequest,
    current_super: UserModel = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    name = req.name.strip()
    if db.query(DistrictModel).filter(DistrictModel.name.ilike(name)).first():
        raise HTTPException(status_code=400, detail=f"District '{name}' already exists.")
    d = DistrictModel(name=name, code=req.code.strip() if req.code else None, state=req.state or "Andhra Pradesh")
    db.add(d)
    db.commit()
    db.refresh(d)
    return d.to_dict()

@app.put("/api/admin/districts/{district_id}", tags=["Master Geographic Management"])
def update_district(
    district_id: int,
    req: UpdateDistrictRequest,
    current_super: UserModel = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    d = db.query(DistrictModel).filter(DistrictModel.id == district_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="District not found.")
    if req.name is not None:
        d.name = req.name.strip()
    if req.code is not None:
        d.code = req.code.strip() if req.code else None
    if req.state is not None:
        d.state = req.state.strip()
    d.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(d)
    return d.to_dict()

@app.delete("/api/admin/districts/{district_id}", tags=["Master Geographic Management"])
def delete_district(
    district_id: int,
    current_super: UserModel = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    d = db.query(DistrictModel).filter(DistrictModel.id == district_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="District not found.")
    db.delete(d)
    db.commit()
    return {"status": "ok", "message": f"District #{district_id} deleted successfully."}

@app.get("/api/admin/constituencies", tags=["Master Geographic Management"])
def list_constituencies(
    district_id: Optional[int] = None,
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    q = db.query(ConstituencyModel)
    if district_id:
        q = q.filter(ConstituencyModel.district_id == district_id)
    if not is_super_admin(current_user):
        # Admin sees only their assigned constituencies
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        admin_constituencies = [a.constituency for a in admin_assignments if a.constituency]
        if not admin_constituencies:
            return []
        conds = [ConstituencyModel.name.ilike(f"%{c.strip()}%") for c in admin_constituencies]
        q = q.filter(or_(*conds))
    constituencies = q.order_by(ConstituencyModel.name.asc()).all()
    return [c.to_dict() for c in constituencies]

@app.post("/api/admin/constituencies", tags=["Master Geographic Management"], status_code=status.HTTP_201_CREATED)
def create_constituency(
    req: CreateConstituencyRequest,
    current_super: UserModel = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    name = req.name.strip()
    dist_name = req.district_name.strip()
    c = ConstituencyModel(
        name=name,
        code=req.code.strip() if req.code else None,
        district_id=req.district_id,
        district_name=dist_name
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c.to_dict()

@app.put("/api/admin/constituencies/{constituency_id}", tags=["Master Geographic Management"])
def update_constituency(
    constituency_id: int,
    req: UpdateConstituencyRequest,
    current_super: UserModel = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    c = db.query(ConstituencyModel).filter(ConstituencyModel.id == constituency_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Constituency not found.")
    if req.name is not None:
        c.name = req.name.strip()
    if req.code is not None:
        c.code = req.code.strip() if req.code else None
    if req.district_id is not None:
        c.district_id = req.district_id
    if req.district_name is not None:
        c.district_name = req.district_name.strip()
    c.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return c.to_dict()

@app.delete("/api/admin/constituencies/{constituency_id}", tags=["Master Geographic Management"])
def delete_constituency(
    constituency_id: int,
    current_super: UserModel = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    c = db.query(ConstituencyModel).filter(ConstituencyModel.id == constituency_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Constituency not found.")
    db.delete(c)
    db.commit()
    return {"status": "ok", "message": f"Constituency #{constituency_id} deleted successfully."}

@app.get("/api/admin/wards", tags=["Master Geographic Management"])
def list_wards(
    constituency_id: Optional[int] = None,
    current_user: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    q = db.query(WardModel)
    if constituency_id:
        q = q.filter(WardModel.constituency_id == constituency_id)
    if not is_super_admin(current_user):
        admin_assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        admin_constituencies = [a.constituency for a in admin_assignments if a.constituency]
        if not admin_constituencies:
            return []
        conds = [WardModel.constituency_name.ilike(f"%{c.strip()}%") for c in admin_constituencies]
        q = q.filter(or_(*conds))
    wards = q.order_by(WardModel.ward_number.asc()).all()
    return [w.to_dict() for w in wards]

@app.post("/api/admin/wards", tags=["Master Geographic Management"], status_code=status.HTTP_201_CREATED)
def create_ward(
    req: CreateWardRequest,
    current_super: UserModel = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    w = WardModel(
        ward_number=req.ward_number.strip(),
        constituency_id=req.constituency_id,
        constituency_name=req.constituency_name.strip(),
        area_name=req.area_name.strip() if req.area_name else None,
        description=req.description.strip() if req.description else None
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return w.to_dict()

@app.put("/api/admin/wards/{ward_id}", tags=["Master Geographic Management"])
def update_ward(
    ward_id: int,
    req: UpdateWardRequest,
    current_super: UserModel = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    w = db.query(WardModel).filter(WardModel.id == ward_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Ward not found.")
    if req.ward_number is not None:
        w.ward_number = req.ward_number.strip()
    if req.constituency_id is not None:
        w.constituency_id = req.constituency_id
    if req.constituency_name is not None:
        w.constituency_name = req.constituency_name.strip()
    if req.area_name is not None:
        w.area_name = req.area_name.strip() if req.area_name else None
    if req.description is not None:
        w.description = req.description.strip() if req.description else None
    w.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(w)
    return w.to_dict()

@app.delete("/api/admin/wards/{ward_id}", tags=["Master Geographic Management"])
def delete_ward(
    ward_id: int,
    current_super: UserModel = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    w = db.query(WardModel).filter(WardModel.id == ward_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Ward not found.")
    db.delete(w)
    db.commit()
    return {"status": "ok", "message": f"Ward #{ward_id} deleted successfully."}

@app.get("/api/admin/locations", tags=["Geographic Assignment"])
def get_available_locations(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return distinct districts, constituencies, and wards filtered by user's role and scope."""
    if is_super_admin(current_user):
        dist_names = [d.name for d in db.query(DistrictModel).order_by(DistrictModel.name).all()]
        const_names = [c.name for c in db.query(ConstituencyModel).order_by(ConstituencyModel.name).all()]
        ward_nums = [w.ward_number for w in db.query(WardModel).order_by(WardModel.ward_number).all()]
        if not dist_names:
            dist_names = [r[0] for r in db.query(DocumentModel.district).filter(DocumentModel.district.isnot(None), DocumentModel.district != "").distinct().all()]
        if not const_names:
            const_names = [r[0] for r in db.query(DocumentModel.constituency).filter(DocumentModel.constituency.isnot(None), DocumentModel.constituency != "").distinct().all()]
        if not ward_nums:
            ward_nums = [r[0] for r in db.query(DocumentModel.ward_number).filter(DocumentModel.ward_number.isnot(None), DocumentModel.ward_number != "").distinct().all()]
        return {
            "districts": sorted(list(set(dist_names))),
            "constituencies": sorted(list(set(const_names))),
            "wards": sorted(list(set(ward_nums)))
        }
    else:
        # Admin or User sees only their assigned geographic scope
        assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        districts = set()
        constituencies = set()
        wards = set()
        for a in assignments:
            if a.district:
                districts.add(a.district)
            if a.constituency:
                constituencies.add(a.constituency)
            ward_list = a.to_dict().get("wards", [])
            for w in ward_list:
                if w and str(w).upper() != "ALL":
                    wards.add(str(w))
        return {
            "districts": sorted(list(districts)),
            "constituencies": sorted(list(constituencies)),
            "wards": sorted(list(wards))
        }

# --- User Wallet Endpoints (Current User) ---

def normalize_ward_value(val: Optional[str]) -> str:
    if not val:
        return ""
    val_clean = str(val).strip().lower()
    return re.sub(r'[^0-9a-zA-Z]', '', val_clean)

@app.get("/api/user/wallet", tags=["User Wallet"])
def get_current_user_wallet(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    is_admin = is_admin_or_super(current_user)
    if is_admin:
        wallet = get_or_create_admin_wallet(db, current_user.id)
        total_allocated = float(db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
            WalletTransactionModel.wallet_id == wallet.id,
            WalletTransactionModel.transaction_type == "ADMIN_WALLET_CREDIT",
            WalletTransactionModel.direction == "CREDIT"
        ).scalar() or 0.0)
    else:
        wallet = get_or_create_user_wallet(db, current_user.id)
        total_allocated = float(db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
            WalletTransactionModel.wallet_id == wallet.id,
            WalletTransactionModel.transaction_type == "USER_WALLET_CREDIT",
            WalletTransactionModel.direction == "CREDIT"
        ).scalar() or 0.0)

    total_spent = float(db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
        WalletTransactionModel.wallet_id == wallet.id,
        WalletTransactionModel.transaction_type == "VOTER_AMOUNT_DEBIT"
    ).scalar() or 0.0)

    total_refunded = float(db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
        WalletTransactionModel.wallet_id == wallet.id,
        WalletTransactionModel.transaction_type == "TRANSACTION_REVERSAL"
    ).scalar() or 0.0)

    recent_txs = db.query(WalletTransactionModel).filter(
        WalletTransactionModel.wallet_id == wallet.id
    ).order_by(desc(WalletTransactionModel.created_at)).limit(10).all()

    assignments = []
    if not is_admin:
        assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()

    return {
        "wallet": wallet.to_dict(),
        "available_balance": float(wallet.available_balance or 0.0),
        "total_amount_allocated": total_allocated,
        "total_amount_spent": total_spent,
        "total_amount_refunded": total_refunded,
        "recent_transactions": [tx.to_dict() for tx in recent_txs],
        "geographic_assignments": [a.to_dict() for a in assignments],
        "is_admin": is_admin
    }

@app.get("/api/user/wallet/transactions", tags=["User Wallet"])
def get_current_user_wallet_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    direction: Optional[str] = None,
    transaction_type: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if is_admin_or_super(current_user):
        wallet = get_or_create_admin_wallet(db, current_user.id)
    else:
        wallet = get_or_create_user_wallet(db, current_user.id)

    q = db.query(WalletTransactionModel).filter(WalletTransactionModel.wallet_id == wallet.id)
    if direction:
        q = q.filter(WalletTransactionModel.direction == direction.upper())
    if transaction_type:
        q = q.filter(WalletTransactionModel.transaction_type == transaction_type)
    total = q.count()
    items = q.order_by(desc(WalletTransactionModel.created_at)).offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [tx.to_dict() for tx in items],
        "total": total,
        "page": page,
        "limit": limit
    }

# --- Restricted Voter Access & Amount Assignment Endpoints ---

@app.get("/api/user/assigned-voters", tags=["Voter Allocation"])
def get_user_assigned_voters(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    ward: Optional[str] = None,
    gender: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(VoterRecordModel).outerjoin(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)

    # Geographic Access Enforcement
    if current_user.role.lower() != "admin":
        assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not assignments:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "message": "No active geographic assignment found. Please contact Administrator to assign Constituency and Wards."
            }

        permitted_constituencies = [a.constituency.strip().lower() for a in assignments if a.constituency]
        permitted_wards_norm = []
        for a in assignments:
            for w in a.to_dict()["wards"]:
                if w:
                    w_n = normalize_ward_value(w)
                    if w_n:
                        permitted_wards_norm.append(w_n)

        q = q.filter(func.lower(DocumentModel.constituency).in_(permitted_constituencies))
        if permitted_wards_norm:
            ward_clauses = []
            for pw in permitted_wards_norm:
                ward_clauses.append(DocumentModel.ward_number.ilike(f"%{pw}%"))
            q = q.filter(or_(*ward_clauses))

        if ward:
            q = q.filter(DocumentModel.ward_number.ilike(f"%{ward.strip()}%"))
    else:
        if district:
            q = q.filter(DocumentModel.district.ilike(f"%{district.strip()}%"))
        if constituency:
            q = q.filter(DocumentModel.constituency.ilike(f"%{constituency.strip()}%"))
        if ward:
            q = q.filter(DocumentModel.ward_number.ilike(f"%{ward.strip()}%"))

    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(
            VoterRecordModel.voter_name.ilike(term),
            VoterRecordModel.voter_id.ilike(term),
            VoterRecordModel.house_no.ilike(term)
        ))
    if gender:
        q = q.filter(VoterRecordModel.gender.ilike(gender))

    total = q.count()
    voters = q.order_by(VoterRecordModel.id).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [v.to_dict() for v in voters],
        "total": total,
        "page": page,
        "limit": limit
    }

@app.get("/api/user/assigned-voters/{voter_id}", tags=["Voter Allocation"])
def get_user_assigned_voter_details(
    voter_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    voter = db.query(VoterRecordModel).filter(VoterRecordModel.id == voter_id).first()
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found.")

    if current_user.role.lower() != "admin":
        assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not assignments:
            raise HTTPException(status_code=403, detail="Access denied: No active geographic assignment.")

        permitted_constituencies = [a.constituency.strip().lower() for a in assignments if a.constituency]
        permitted_wards_norm = []
        for a in assignments:
            for w in a.to_dict()["wards"]:
                if w:
                    w_n = normalize_ward_value(w)
                    if w_n:
                        permitted_wards_norm.append(w_n)

        v_const = (voter.document.constituency or "").strip().lower() if voter.document else ""
        v_ward_norm = normalize_ward_value(voter.document.ward_number if voter.document else "")

        if v_const not in permitted_constituencies:
            raise HTTPException(status_code=403, detail="Access denied: Voter is outside your assigned constituency.")
        if permitted_wards_norm and v_ward_norm not in permitted_wards_norm:
            raise HTTPException(status_code=403, detail="Access denied: Voter is outside your assigned wards.")

    return voter.to_dict()

@app.post("/api/user/voter-allocations", tags=["Voter Allocation"])
def assign_voter_amount(
    req: AssignVoterAmountRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero.")

    is_admin = is_admin_or_super(current_user)

    # Idempotency check
    if req.idempotency_key:
        existing = db.query(VoterAmountAllocationModel).filter(
            VoterAmountAllocationModel.allocation_reference == req.idempotency_key
        ).first()
        if existing:
            active_wallet = get_or_create_admin_wallet(db, current_user.id) if is_admin else get_or_create_user_wallet(db, current_user.id)
            return {
                "status": "ok",
                "message": "Allocation already processed.",
                "allocation": existing.to_dict(),
                "updated_balance": float(active_wallet.available_balance)
            }

    voter = db.query(VoterRecordModel).filter(VoterRecordModel.id == req.voter_id).first()
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found.")

    # Geographic Scope Verification for non-admin
    if not is_admin:
        assignments = db.query(UserGeographicAssignmentModel).filter(
            UserGeographicAssignmentModel.user_id == current_user.id,
            UserGeographicAssignmentModel.status == "ACTIVE"
        ).all()
        if not assignments:
            raise HTTPException(status_code=403, detail="No active geographic assignment for your account.")

        permitted_constituencies = [a.constituency.strip().lower() for a in assignments if a.constituency]
        permitted_wards_norm = []
        for a in assignments:
            for w in a.to_dict()["wards"]:
                if w:
                    w_n = normalize_ward_value(w)
                    if w_n:
                        permitted_wards_norm.append(w_n)

        v_const = (voter.document.constituency or "").strip().lower() if voter.document else ""
        v_ward_norm = normalize_ward_value(voter.document.ward_number if voter.document else "")

        if v_const not in permitted_constituencies:
            raise HTTPException(status_code=403, detail="Voter is outside your assigned constituency.")
        if permitted_wards_norm and v_ward_norm not in permitted_wards_norm:
            raise HTTPException(status_code=403, detail="Voter is outside your assigned wards.")

    # Atomic Wallet Lock: Support Admin master treasury as well as User wallets
    assign_amount = Decimal(str(req.amount))
    wallet = None

    if is_admin:
        get_or_create_admin_wallet(db, current_user.id)
        admin_w = db.query(WalletModel).filter(
            WalletModel.owner_type == "ADMIN",
            WalletModel.owner_id == current_user.id
        ).with_for_update().first()

        user_w = db.query(WalletModel).filter(
            WalletModel.owner_type == "USER",
            WalletModel.owner_id == current_user.id
        ).with_for_update().first()

        if admin_w and admin_w.available_balance >= assign_amount:
            wallet = admin_w
        elif user_w and user_w.available_balance >= assign_amount:
            wallet = user_w
        else:
            avail = admin_w.available_balance if admin_w else (user_w.available_balance if user_w else Decimal("0.00"))
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient wallet balance. Available: ₹{avail:,.2f}, Requested: ₹{req.amount:,.2f}."
            )
    else:
        get_or_create_user_wallet(db, current_user.id)
        wallet = db.query(WalletModel).filter(
            WalletModel.owner_type == "USER",
            WalletModel.owner_id == current_user.id
        ).with_for_update().first()

        if not wallet or wallet.available_balance < assign_amount:
            avail = wallet.available_balance if wallet else Decimal("0.00")
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient wallet balance. Available: ₹{avail:,.2f}, Requested: ₹{req.amount:,.2f}."
            )

    before_bal = wallet.available_balance
    wallet.available_balance -= assign_amount
    after_bal = wallet.available_balance
    wallet.updated_at = datetime.now(timezone.utc)

    val_ref = req.idempotency_key or f"VAL-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    tx_id = f"WTXN-VOTER-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"

    tx = WalletTransactionModel(
        transaction_id=tx_id,
        wallet_id=wallet.id,
        transaction_type="VOTER_AMOUNT_DEBIT",
        direction="DEBIT",
        amount=assign_amount,
        balance_before=before_bal,
        balance_after=after_bal,
        reference_type="VOTER_ALLOCATION",
        reference_id=str(voter.id),
        idempotency_key=req.idempotency_key,
        remarks=req.remarks or f"Assigned ₹{req.amount:,.2f} to voter {voter.voter_name} (EPIC: {voter.voter_id})",
        created_by=current_user.id,
        created_at=req.assignment_date or datetime.now(timezone.utc)
    )
    db.add(tx)
    db.flush()

    alloc = VoterAmountAllocationModel(
        allocation_reference=val_ref,
        voter_id=voter.id,
        user_id=current_user.id,
        wallet_transaction_id=tx.id,
        amount=assign_amount,
        allocation_date=req.assignment_date or datetime.now(timezone.utc),
        status="ACTIVE",
        remarks=req.remarks,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc)
    )
    db.add(alloc)

    db.add(AuditLogModel(
        user_id=current_user.id,
        action="VOTER_AMOUNT_ASSIGNED",
        details=f"User @{current_user.username} ({wallet.owner_type} wallet) assigned ₹{req.amount:,.2f} to voter {voter.voter_name} ({voter.voter_id}). Balance: ₹{after_bal:,.2f}",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()
    db.refresh(alloc)

    return {
        "status": "ok",
        "message": f"Successfully assigned ₹{req.amount:,.2f} to voter {voter.voter_name}.",
        "allocation": alloc.to_dict(),
        "updated_balance": float(after_bal),
        "transaction_id": tx_id
    }

@app.get("/api/user/voter-allocations", tags=["Voter Allocation"])
def list_user_voter_allocations(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    ward: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(VoterAmountAllocationModel).join(VoterRecordModel, VoterAmountAllocationModel.voter_id == VoterRecordModel.id)
    if current_user.role.lower() != "admin":
        q = q.filter(VoterAmountAllocationModel.user_id == current_user.id)

    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(
            VoterAmountAllocationModel.allocation_reference.ilike(term),
            VoterRecordModel.voter_name.ilike(term),
            VoterRecordModel.voter_id.ilike(term)
        ))

    if ward:
        q = q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id).filter(
            DocumentModel.ward_number.ilike(f"%{ward}%")
        )

    if from_date:
        try:
            fd = datetime.fromisoformat(from_date)
            q = q.filter(VoterAmountAllocationModel.allocation_date >= fd)
        except Exception:
            pass

    if to_date:
        try:
            td = datetime.fromisoformat(to_date)
            q = q.filter(VoterAmountAllocationModel.allocation_date <= td)
        except Exception:
            pass

    total = q.count()
    items = q.order_by(desc(VoterAmountAllocationModel.allocation_date)).offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [a.to_dict() for a in items],
        "total": total,
        "page": page,
        "limit": limit
    }

@app.get("/api/user/voter-allocations/{allocation_id}", tags=["Voter Allocation"])
def get_voter_allocation_details(
    allocation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alloc = db.query(VoterAmountAllocationModel).filter(VoterAmountAllocationModel.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation record not found.")
    if current_user.role.lower() != "admin" and alloc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: You do not own this allocation record.")
    return alloc.to_dict()

@app.post("/api/user/voter-allocations/{allocation_id}/reverse", tags=["Voter Allocation"])
def reverse_voter_allocation(
    allocation_id: int,
    req: ReverseAllocationRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alloc = db.query(VoterAmountAllocationModel).filter(VoterAmountAllocationModel.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation record not found.")

    if current_user.role.lower() != "admin" and alloc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to reverse this allocation.")

    if alloc.status == "REVERSED":
        raise HTTPException(status_code=400, detail="This allocation has already been reversed.")

    # Find the wallet that was debited from the original transaction
    orig_tx = db.query(WalletTransactionModel).filter(
        WalletTransactionModel.id == alloc.wallet_transaction_id
    ).first()

    wallet = None
    if orig_tx and orig_tx.wallet_id:
        wallet = db.query(WalletModel).filter(WalletModel.id == orig_tx.wallet_id).with_for_update().first()

    if not wallet:
        # Fallback to user's wallet
        alloc_user = db.query(UserModel).filter(UserModel.id == alloc.user_id).first()
        is_alloc_admin = alloc_user and is_admin_or_super(alloc_user)
        if is_alloc_admin:
            wallet = db.query(WalletModel).filter(
                WalletModel.owner_type == "ADMIN",
                WalletModel.owner_id == alloc.user_id
            ).with_for_update().first()
        else:
            wallet = db.query(WalletModel).filter(
                WalletModel.owner_type == "USER",
                WalletModel.owner_id == alloc.user_id
            ).with_for_update().first()

    if not wallet:
        raise HTTPException(status_code=404, detail="Associated wallet not found for restoration.")

    before_bal = wallet.available_balance
    wallet.available_balance += alloc.amount
    after_bal = wallet.available_balance
    wallet.updated_at = datetime.now(timezone.utc)

    rev_tx_id = f"WTXN-REV-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    rev_tx = WalletTransactionModel(
        transaction_id=rev_tx_id,
        wallet_id=wallet.id,
        transaction_type="TRANSACTION_REVERSAL",
        direction="CREDIT",
        amount=alloc.amount,
        balance_before=before_bal,
        balance_after=after_bal,
        reference_type="REVERSAL",
        reference_id=alloc.allocation_reference,
        remarks=f"Reversal of {alloc.allocation_reference}: {req.reason.strip()}",
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc)
    )
    db.add(rev_tx)

    alloc.status = "REVERSED"
    alloc.reversal_reason = req.reason.strip()
    alloc.reversed_at = datetime.now(timezone.utc)
    alloc.reversed_by = current_user.id

    db.add(AuditLogModel(
        user_id=current_user.id,
        action="VOTER_ALLOCATION_REVERSED",
        details=f"Reversed allocation {alloc.allocation_reference} (₹{alloc.amount:,.2f}) for voter ID {alloc.voter_id}. Reason: {req.reason.strip()}. Wallet balance restored to ₹{after_bal:,.2f}",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc)
    ))
    db.commit()

    return {
        "status": "ok",
        "message": "Allocation reversed successfully and wallet balance restored.",
        "updated_balance": float(after_bal),
        "transaction_id": rev_tx_id
    }

# --- Admin Reports & Global Summaries ---

@app.get("/api/admin/voter-allocations", tags=["Admin Reports"])
def admin_list_all_voter_allocations(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    user_id: Optional[int] = None,
    constituency: Optional[str] = None,
    ward: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    q = db.query(VoterAmountAllocationModel).join(VoterRecordModel, VoterAmountAllocationModel.voter_id == VoterRecordModel.id)
    if user_id:
        q = q.filter(VoterAmountAllocationModel.user_id == user_id)
    if status:
        q = q.filter(VoterAmountAllocationModel.status == status.upper())
    if constituency or ward:
        q = q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
        if constituency:
            q = q.filter(DocumentModel.constituency.ilike(f"%{constituency}%"))
        if ward:
            q = q.filter(DocumentModel.ward_number.ilike(f"%{ward}%"))

    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(
            VoterAmountAllocationModel.allocation_reference.ilike(term),
            VoterRecordModel.voter_name.ilike(term),
            VoterRecordModel.voter_id.ilike(term)
        ))

    total = q.count()
    items = q.order_by(desc(VoterAmountAllocationModel.allocation_date)).offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [a.to_dict() for a in items],
        "total": total,
        "page": page,
        "limit": limit
    }

@app.get("/api/admin/wallet/summary", tags=["Admin Reports"])
def get_admin_wallet_global_summary(
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    admin_wallet = get_or_create_admin_wallet(db, current_admin.id)
    
    total_funded = float(db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
        WalletTransactionModel.wallet_id == admin_wallet.id,
        WalletTransactionModel.transaction_type == "ADMIN_WALLET_CREDIT"
    ).scalar() or 0.0)

    total_allocated_to_users = float(db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
        WalletTransactionModel.wallet_id == admin_wallet.id,
        WalletTransactionModel.transaction_type == "ADMIN_TO_USER_ALLOCATION"
    ).scalar() or 0.0)

    total_user_wallets_balance = float(db.query(func.coalesce(func.sum(WalletModel.available_balance), 0)).filter(
        WalletModel.owner_type == "USER"
    ).scalar() or 0.0)

    total_spent_on_voters = float(db.query(func.coalesce(func.sum(VoterAmountAllocationModel.amount), 0)).filter(
        VoterAmountAllocationModel.status == "ACTIVE"
    ).scalar() or 0.0)

    total_refunds = float(db.query(func.coalesce(func.sum(WalletTransactionModel.amount), 0)).filter(
        WalletTransactionModel.transaction_type.in_(["TRANSACTION_REVERSAL", "REFUND"])
    ).scalar() or 0.0)

    active_user_wallets_count = db.query(WalletModel).filter(
        WalletModel.owner_type == "USER",
        WalletModel.status == "ACTIVE"
    ).count()

    total_allocations_count = db.query(VoterAmountAllocationModel).filter(
        VoterAmountAllocationModel.status == "ACTIVE"
    ).count()

    return {
        "admin_available_balance": float(admin_wallet.available_balance),
        "total_amount_funded": total_funded,
        "total_allocated_to_users": total_allocated_to_users,
        "total_user_wallets_balance": total_user_wallets_balance,
        "total_spent_on_voters": total_spent_on_voters,
        "total_refunds": total_refunds,
        "active_user_wallets_count": active_user_wallets_count,
        "total_allocations_count": total_allocations_count
    }
