from typing import Optional, Set
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

try:
    from backend.database import get_db, UserModel, RoleModel, PermissionModel, RolePermissionModel, UserRoleModel
    from backend.security import decode_token
except ImportError:
    from database import get_db, UserModel, RoleModel, PermissionModel, RolePermissionModel, UserRoleModel
    from security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> UserModel:
    """Dependency to retrieve and validate authenticated user from JWT token."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_type = payload.get("type")
    if token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for API access.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(UserModel).filter(UserModel.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account has been deactivated. Please contact an administrator.",
        )

    return user

def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[UserModel]:
    """Dependency for endpoints that can be accessed with or without authentication."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.query(UserModel).filter(UserModel.id == int(user_id)).first()
    except Exception:
        return None

def require_admin(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    """Dependency to enforce Admin role authorization."""
    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges are required to perform this action.",
        )
    return current_user

def get_user_permissions(user: UserModel, db: Session) -> Set[str]:
    """Retrieve all distinct permission codes assigned to the user through their roles."""
    if user.role.lower() == "admin":
        all_perms = db.query(PermissionModel.code).all()
        return {p[0] for p in all_perms}

    # Query permissions via user_roles mapping
    perms = (
        db.query(PermissionModel.code)
        .join(RolePermissionModel, RolePermissionModel.permission_id == PermissionModel.id)
        .join(RoleModel, RoleModel.id == RolePermissionModel.role_id)
        .join(UserRoleModel, UserRoleModel.role_id == RoleModel.id)
        .filter(UserRoleModel.user_id == user.id)
        .all()
    )
    perm_set = {p[0] for p in perms}

    # Fallback to direct user.role if user_roles not explicitly assigned
    if not perm_set and user.role:
        role_perms = (
            db.query(PermissionModel.code)
            .join(RolePermissionModel, RolePermissionModel.permission_id == PermissionModel.id)
            .join(RoleModel, RoleModel.id == RolePermissionModel.role_id)
            .filter(RoleModel.role_name.ilike(user.role))
            .all()
        )
        perm_set = {p[0] for p in role_perms}

    return perm_set

def require_permission(permission_code: str):
    """
    Factory dependency to enforce granular module permissions.
    Example: Depends(require_permission("voters.edit"))
    Returns HTTP 403 Forbidden if the user lacks the permission.
    """
    def dependency(
        current_user: UserModel = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> UserModel:
        if current_user.role.lower() == "admin":
            return current_user

        user_perms = get_user_permissions(current_user, db)
        if permission_code not in user_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: Missing '{permission_code}' permission."
            )
        return current_user
    return dependency
