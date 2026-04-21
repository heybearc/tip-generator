"""
Authentication router — Authentik OIDC (Authorization Code flow)

Flow:
  GET  /api/auth/login     → redirect to Authentik authorize
  GET  /api/auth/callback  → exchange code → JWT session cookie
  GET  /api/auth/me        → return current user from cookie
  POST /api/auth/logout    → clear session cookie
"""
import os, secrets, httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from database import get_db
from models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"], redirect_slashes=False)

# --- Config from .env ---
AUTHENTIK_DOMAIN    = os.getenv("AUTHENTIK_DOMAIN", "auth.cloudigan.net")
CLIENT_ID           = os.getenv("AUTHENTIK_CLIENT_ID", "")
CLIENT_SECRET       = os.getenv("AUTHENTIK_CLIENT_SECRET", "")
REDIRECT_URI        = os.getenv("OAUTH_REDIRECT_URI", "")
SECRET_KEY          = os.getenv("SECRET_KEY", "changeme")
JWT_ALGORITHM       = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_MINUTES  = int(os.getenv("JWT_EXPIRATION_MINUTES", "60"))
FRONTEND_URL        = os.getenv("FRONTEND_URL", "https://blue-tip.cloudigan.net")

# Authentik OIDC endpoints (app-specific slug)
_BASE = f"https://{AUTHENTIK_DOMAIN}/application/o/tip-generator"
AUTHORIZE_URL = f"https://{AUTHENTIK_DOMAIN}/application/o/authorize/"
TOKEN_URL     = f"{_BASE}/token/"        # not actually needed — standard token endpoint
TOKEN_URL     = f"https://{AUTHENTIK_DOMAIN}/application/o/token/"
USERINFO_URL  = f"https://{AUTHENTIK_DOMAIN}/application/o/userinfo/"

COOKIE_NAME = "tip_session"
COOKIE_SECURE = True
COOKIE_SAMESITE = "lax"


# --- Helpers ---

def _make_jwt(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.full_name or user.username,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=JWT_EXPIRY_MINUTES * 60,
        path="/",
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """FastAPI dependency — raises 401 if not authenticated."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid session")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# --- Routes ---

@router.get("/login")
async def login(request: Request):
    """Redirect browser to Authentik authorization page."""
    state = secrets.token_urlsafe(32)
    # Store state in a short-lived cookie for CSRF validation
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": "openid email profile",
        "state": state,
    }
    from urllib.parse import urlencode
    url = f"{AUTHORIZE_URL}?{urlencode(params)}"
    response = RedirectResponse(url=url, status_code=302)
    response.set_cookie("oauth_state", state, httponly=True, secure=COOKIE_SECURE,
                        samesite=COOKIE_SAMESITE, max_age=300, path="/")
    return response


@router.get("/callback")
async def callback(
    request: Request,
    response: Response,
    code: str = "",
    state: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    """Handle Authentik redirect: exchange code for tokens, upsert user, set cookie."""
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/login?error={error}")

    # Validate state
    stored_state = request.cookies.get("oauth_state", "")
    if not state or state != stored_state:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=state_mismatch")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
            },
            headers={"Accept": "application/json"},
            timeout=15,
        )

    if token_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=token_exchange_failed")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    # Fetch user info
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )

    if userinfo_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=userinfo_failed")

    info = userinfo_resp.json()
    sub      = info.get("sub", "")
    email    = info.get("email", "")
    name     = info.get("name", "") or info.get("preferred_username", email)
    username = info.get("preferred_username", email.split("@")[0])

    # Upsert user
    user = db.query(User).filter(User.oauth_id == sub, User.oauth_provider == "authentik").first()
    if not user:
        # Also check by email to merge existing accounts
        user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            username=username,
            full_name=name,
            oauth_provider="authentik",
            oauth_id=sub,
            is_active=True,
        )
        db.add(user)
    else:
        user.full_name = name
        user.oauth_id = sub
        user.oauth_provider = "authentik"
        user.is_active = True
    db.commit()
    db.refresh(user)

    # Issue JWT session cookie and redirect to app
    jwt_token = _make_jwt(user)
    redirect = RedirectResponse(url=f"{FRONTEND_URL}/", status_code=302)
    redirect.delete_cookie("oauth_state", path="/")
    _set_cookie(redirect, jwt_token)
    return redirect


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Return current authenticated user info."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "is_superuser": current_user.is_superuser,
    }


@router.post("/logout")
async def logout():
    """Clear session cookie."""
    response = Response(content='{"message":"logged out"}', media_type="application/json")
    response.delete_cookie(COOKIE_NAME, path="/")
    return response
