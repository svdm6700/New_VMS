import sys
import uuid
import json
import os
import re
import csv
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional, List
from io import BytesIO, StringIO

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
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc, text

try:
    from app.core.config import settings
except ImportError:
    from backend.app.core.config import settings

try:
    from backend.database import init_db, get_db, SessionLocal, DocumentModel, VoterRecordModel, UserModel, RoleModel
    from backend.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
    from backend.auth_deps import get_current_user, get_optional_current_user, require_admin
    from backend.processor import process_pdf
    from backend.excel import create_excel
    from backend.seed import seed_database
except ImportError:
    from database import init_db, get_db, SessionLocal, DocumentModel, VoterRecordModel, UserModel, RoleModel
    from security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
    from auth_deps import get_current_user, get_optional_current_user, require_admin
    from processor import process_pdf
    from excel import create_excel
    from seed import seed_database

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
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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

            voter_objs = []
            for r in result.get("records", []):
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

    role = req.role.lower() if req.role in ["admin", "user"] else "user"

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
    if req.role is not None and req.role in ["admin", "user"]:
        # Prevent demoting self if sole admin
        if user_id == current_admin.id and req.role != "admin":
            admin_count = db.query(UserModel).filter(UserModel.role == "admin").count()
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot demote the sole administrator.")
        u.role = req.role
    if req.is_active is not None:
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
    role = req.role.lower()
    if role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'.")

    if user_id == current_admin.id and role != "admin":
        admin_count = db.query(UserModel).filter(UserModel.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the sole administrator.")

    u = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")

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
# 5. List Documents (RBAC Enforced)
# -------------------------------------------------------------
@app.get("/api/documents")
def list_documents(
    query: Optional[str] = None,
    status: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    area: Optional[str] = None,
    ward_number: Optional[str] = None,
    sort_by: str = "uploaded_at",
    order: str = "desc",
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(DocumentModel)

    # RBAC: If standard user, filter by their documents only
    if current_user and current_user.role.lower() != "admin":
        q = q.filter(DocumentModel.uploaded_by == current_user.id)

    if query:
        q = q.filter(
            or_(
                DocumentModel.original_filename.ilike(f"%{query}%"),
                DocumentModel.district.ilike(f"%{query}%"),
                DocumentModel.constituency.ilike(f"%{query}%"),
                DocumentModel.area.ilike(f"%{query}%"),
                DocumentModel.ward_number.ilike(f"%{query}%")
            )
        )
    if status and status != "all":
        q = q.filter(DocumentModel.processing_status == status)
    if district and district != "all":
        q = q.filter(DocumentModel.district.ilike(f"%{district}%"))
    if constituency and constituency != "all":
        q = q.filter(DocumentModel.constituency.ilike(f"%{constituency}%"))
    if area and area != "all":
        q = q.filter(DocumentModel.area.ilike(f"%{area}%"))
    if ward_number and ward_number != "all":
        q = q.filter(DocumentModel.ward_number.ilike(f"%{ward_number}%"))

    order_col = getattr(DocumentModel, sort_by, DocumentModel.uploaded_at)
    q = q.order_by(desc(order_col) if order.lower() == "desc" else asc(order_col))

    docs = q.all()
    out = []
    for d in docs:
        d_dict = d.to_dict()
        d_dict["filename"] = d.original_filename
        d_dict["page_count"] = d.total_pages
        d_dict["status"] = d.processing_status
        d_dict["created_at"] = d_dict["uploaded_at"]
        d_dict["processing_type"] = "Electoral Roll / Text"
        out.append(d_dict)
    return out

# -------------------------------------------------------------
# 6. Get Document Details (RBAC Check)
# -------------------------------------------------------------
@app.get("/api/documents/{doc_id}")
def get_document(
    doc_id: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Access check: Standard users can only view their own documents
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

    info = doc.to_dict()
    info["filename"] = doc.original_filename
    info["page_count"] = doc.total_pages
    info["status"] = doc.processing_status
    info["created_at"] = info["uploaded_at"]

    if result_data:
        result_data["id"] = doc_id
        result_data["district"] = doc.district
        result_data["constituency"] = doc.constituency
        result_data["area"] = doc.area
        result_data["ward_number"] = doc.ward_number
        result_data["metadata"] = {
            **result_data.get("metadata", {}),
            "filename": doc.original_filename,
            "page_count": doc.total_pages,
            "processing_status": doc.processing_status,
            "uploaded_by": doc.uploaded_by,
            "district": doc.district,
            "constituency": doc.constituency,
            "area": doc.area,
            "ward_number": doc.ward_number
        }
        return result_data
    else:
        return {
            "id": doc_id,
            "district": doc.district,
            "constituency": doc.constituency,
            "area": doc.area,
            "ward_number": doc.ward_number,
            "metadata": info,
            "pages": [],
            "records": [],
            "table_rows_te": [],
            "table_rows_en": [],
            "paragraphs": [],
            "validation": {"review_notes": [f"Status: {doc.processing_status}"]}
        }

# -------------------------------------------------------------
# 7. Serve Original PDF File
# -------------------------------------------------------------
@app.get("/api/documents/{doc_id}/file")
def get_document_file(
    doc_id: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Original PDF file not found.")

    pdf_file = resolve_pdf_path(doc.stored_file_path, doc_id)
    if not pdf_file or not pdf_file.exists():
        raise HTTPException(status_code=404, detail="Original PDF file not found.")

    if current_user and current_user.role.lower() != "admin" and doc.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied to access this file.")

    return FileResponse(
        str(pdf_file),
        media_type="application/pdf",
        filename=doc.original_filename
    )

# -------------------------------------------------------------
# 8. Delete Document
# -------------------------------------------------------------
@app.delete("/api/documents/{doc_id}")
def delete_document(
    doc_id: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if current_user and current_user.role.lower() != "admin" and doc.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this document.")

    pdf_file = resolve_pdf_path(doc.stored_file_path, doc_id)
    if pdf_file and pdf_file.exists():
        try: pdf_file.unlink()
        except Exception: pass

    res_path = resolve_result_path(doc_id)
    if res_path and res_path.exists():
        try: res_path.unlink()
        except Exception: pass

    db.delete(doc)
    db.commit()
    return {"status": "deleted", "id": doc_id}

# -------------------------------------------------------------
# 9. Document Specific Voter Records
# -------------------------------------------------------------
@app.get("/api/documents/{doc_id}/records")
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
    source_page: Optional[int] = None,
    sort_by: str = "id",
    order: str = "asc",
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(VoterRecordModel)

    joined_doc = False
    # Standard User can only access voter records from documents they own
    if current_user and current_user.role.lower() != "admin":
        q = q.join(DocumentModel, VoterRecordModel.document_id == DocumentModel.id)
        q = q.filter(DocumentModel.uploaded_by == current_user.id)
        joined_doc = True

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
@app.get("/api/documents/{doc_id}/text")
def get_document_text(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    res_path = resolve_result_path(doc_id)
    pages, paras = [], []
    if res_path and res_path.exists():
        try:
            with open(res_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                pages = data.get("pages", [])
                paras = data.get("paragraphs", [])
        except Exception:
            pass
    return {
        "id": doc_id,
        "filename": doc.original_filename,
        "pages": pages,
        "paragraphs": paras
    }

@app.get("/api/documents/{doc_id}/tables")
def get_document_tables(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    res_path = resolve_result_path(doc_id)
    tables_te, tables_en = [], []
    if res_path and res_path.exists():
        try:
            with open(res_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                tables_te = data.get("table_rows_te", [])
                tables_en = data.get("table_rows_en", [])
        except Exception:
            pass
    return {
        "id": doc_id,
        "filename": doc.original_filename,
        "tables_te": tables_te,
        "tables_en": tables_en
    }

@app.get("/api/documents/{doc_id}/ocr")
def get_document_ocr(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    res_path = resolve_result_path(doc_id)
    ocr_pages = []
    validation = {}
    if res_path and res_path.exists():
        try:
            with open(res_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                pages = data.get("pages", [])
                ocr_pages = [p for p in pages if "OCR" in str(p.get("method", ""))]
                validation = data.get("validation", {})
        except Exception:
            pass
    return {
        "id": doc_id,
        "filename": doc.original_filename,
        "ocr_page_count": len(ocr_pages),
        "pages": ocr_pages,
        "validation": validation
    }
