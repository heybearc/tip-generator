"""
Admin router — user management and usage stats (superuser only)

Endpoints:
  GET  /api/admin/users            → list all users with stats
  PATCH /api/admin/users/{id}      → update user (activate/deactivate)
  GET  /api/admin/stats            → aggregate usage stats
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from models.user import User
from models.draft import Draft, DraftStatus
from models.document import Document
from routers.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"], redirect_slashes=False)


# --- Admin dependency ---

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency — raises 403 if user is not a superuser."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# --- Schemas ---

class UserAdminResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    is_superuser: bool
    has_api_key: bool
    claude_model: Optional[str]
    draft_count: int
    total_tokens: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    total_drafts: int
    total_tokens: int
    users_with_api_key: int


# --- Routes ---

@router.get("/users", response_model=List[UserAdminResponse])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all users with draft counts and token usage."""
    users = db.query(User).order_by(User.created_at).all()

    stats = (
        db.query(
            Draft.user_id,
            func.count(Draft.id).label("draft_count"),
            func.coalesce(func.sum(Draft.generation_tokens), 0).label("total_tokens"),
        )
        .group_by(Draft.user_id)
        .all()
    )
    stats_by_user = {row.user_id: row for row in stats}

    result = []
    for u in users:
        s = stats_by_user.get(u.id)
        result.append(UserAdminResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            full_name=u.full_name,
            is_active=u.is_active,
            is_superuser=u.is_superuser,
            has_api_key=bool(u.claude_api_key),
            claude_model=u.claude_model,
            draft_count=s.draft_count if s else 0,
            total_tokens=s.total_tokens if s else 0,
            created_at=u.created_at,
        ))
    return result


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
def update_user(
    user_id: int,
    body: UserUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Activate/deactivate a user or toggle superuser status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account")

    if body.is_active is not None:
        user.is_active = body.is_active
    if body.is_superuser is not None:
        user.is_superuser = body.is_superuser

    db.commit()
    db.refresh(user)

    s = (
        db.query(
            func.count(Draft.id).label("draft_count"),
            func.coalesce(func.sum(Draft.generation_tokens), 0).label("total_tokens"),
        )
        .filter(Draft.user_id == user_id)
        .first()
    )

    return UserAdminResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        has_api_key=bool(user.claude_api_key),
        claude_model=user.claude_model,
        draft_count=s.draft_count if s else 0,
        total_tokens=s.total_tokens if s else 0,
        created_at=user.created_at,
    )


@router.get("/stats", response_model=AdminStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Aggregate usage stats across all users."""
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    users_with_api_key = db.query(func.count(User.id)).filter(User.claude_api_key != None).scalar()
    total_drafts = db.query(func.count(Draft.id)).scalar()
    total_tokens = db.query(func.coalesce(func.sum(Draft.generation_tokens), 0)).scalar()

    return AdminStatsResponse(
        total_users=total_users,
        active_users=active_users,
        total_drafts=total_drafts,
        total_tokens=total_tokens,
        users_with_api_key=users_with_api_key,
    )


# --- Documents ---

class AdminDocumentResponse(BaseModel):
    id: int
    owner_email: str
    owner_username: str
    filename: str
    original_filename: str
    document_type: str
    status: str
    file_size: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/documents", response_model=List[AdminDocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all uploaded documents across all users."""
    rows = (
        db.query(Document, User)
        .join(User, Document.user_id == User.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [
        AdminDocumentResponse(
            id=doc.id,
            owner_email=user.email,
            owner_username=user.username,
            filename=doc.filename,
            original_filename=doc.original_filename,
            document_type=doc.document_type.value if hasattr(doc.document_type, 'value') else str(doc.document_type),
            status=doc.status.value if hasattr(doc.status, 'value') else str(doc.status),
            file_size=doc.file_size,
            created_at=doc.created_at,
        )
        for doc, user in rows
    ]


# --- Drafts ---

class AdminDraftResponse(BaseModel):
    id: int
    owner_email: str
    owner_username: str
    title: str
    status: str
    claude_model: Optional[str]
    generation_tokens: Optional[int]
    created_at: datetime
    generated_at: Optional[datetime]

    class Config:
        from_attributes = True


@router.get("/drafts", response_model=List[AdminDraftResponse])
def list_drafts(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """List all drafts across all users."""
    rows = (
        db.query(Draft, User)
        .join(User, Draft.user_id == User.id)
        .order_by(Draft.created_at.desc())
        .all()
    )
    return [
        AdminDraftResponse(
            id=draft.id,
            owner_email=user.email,
            owner_username=user.username,
            title=draft.title,
            status=draft.status.value if hasattr(draft.status, 'value') else str(draft.status),
            claude_model=draft.claude_model,
            generation_tokens=draft.generation_tokens,
            created_at=draft.created_at,
            generated_at=draft.generated_at,
        )
        for draft, user in rows
    ]
