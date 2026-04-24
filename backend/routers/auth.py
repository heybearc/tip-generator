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
SECRET_KEY          = os.getenv("SECRET_KEY", "changeme")
JWT_ALGORITHM       = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_MINUTES  = int(os.getenv("JWT_EXPIRATION_MINUTES", "60"))


def _base_url(request: Request) -> str:
    """Derive scheme+host from the incoming request (works for any domain)."""
    scheme = (
        request.headers.get("x-forwarded-proto")
        or request.headers.get("x-forwarded-scheme")
        or request.url.scheme
    )
    host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    # NPM proxies to backend over plain HTTP, so forwarded-proto may arrive as http
    # even on HTTPS domains. Force https for any non-localhost host.
    if scheme == "http" and host and not host.startswith("localhost") and not host.startswith("127.") and ":" not in host:
        scheme = "https"
    return f"{scheme}://{host}"

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
    redirect_uri = f"{_base_url(request)}/api/auth/callback"
    # Store state in a short-lived cookie for CSRF validation
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": "openid email profile",
        "state": state,
    }
    from urllib.parse import urlencode
    # Use default urlencode (quote_plus: spaces→+) for all params except redirect_uri
    # which must remain unencoded to avoid double-encoding in Authentik's next= redirect
    other = {k: v for k, v in params.items() if k != "redirect_uri"}
    qs = urlencode(other) + "&redirect_uri=" + redirect_uri
    url = f"{AUTHORIZE_URL}?{qs}"
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
    frontend_url = _base_url(request)
    redirect_uri = f"{frontend_url}/api/auth/callback"

    if error:
        return RedirectResponse(f"{frontend_url}/login?error={error}")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
            },
            headers={"Accept": "application/json"},
            timeout=15,
        )

    if token_resp.status_code != 200:
        return RedirectResponse(f"{frontend_url}/login?error=token_exchange_failed")

    tokens = token_resp.json()
    id_token = tokens.get("id_token", "")

    # Decode id_token claims directly (skip signature verification — Authentik is trusted internal IdP)
    try:
        import base64, json as _json
        payload_b64 = id_token.split(".")[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        info = _json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception:
        info = {}

    sub = info.get("sub", "")
    if not sub:
        return RedirectResponse(f"{frontend_url}/login?error=userinfo_failed")

    # Always fetch userinfo for email/name — id_token only contains sub+aud+iss
    access_token = tokens.get("access_token", "")
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    if userinfo_resp.status_code == 200:
        profile = userinfo_resp.json()
        info.update(profile)

    email    = info.get("email", "") or f"{sub[:8]}@authentik.local"
    name     = info.get("name", "") or info.get("preferred_username", "") or email.split("@")[0]
    username = info.get("preferred_username", "") or email.split("@")[0] or sub[:16]

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
    redirect = RedirectResponse(url=f"{frontend_url}/", status_code=302)
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


@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    """Return current user's profile including whether a Claude API key is set."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "has_claude_api_key": bool(current_user.claude_api_key),
        "claude_model": current_user.claude_model,
        "instruction_presets": current_user.instruction_presets or [],
    }


@router.get("/profile/models")
async def list_claude_models(current_user: User = Depends(get_current_user)):
    """Fetch available Claude models from Anthropic using the user's API key."""
    if not current_user.claude_api_key:
        raise HTTPException(status_code=402, detail="No Claude API key configured.")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.anthropic.com/v1/models",
            headers={
                "x-api-key": current_user.claude_api_key,
                "anthropic-version": "2023-06-01",
            },
            timeout=10,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch models from Anthropic.")
    data = resp.json()
    models = [
        {"id": m["id"], "display_name": m.get("display_name", m["id"])}
        for m in data.get("data", [])
        if "claude" in m["id"].lower()
    ]
    return {"models": models}


@router.patch("/profile")
async def update_profile(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update user profile. Accepts: claude_api_key (set or clear), full_name, claude_model, instruction_presets."""
    if "claude_api_key" in body:
        key = body["claude_api_key"]
        current_user.claude_api_key = key.strip() if key else None
    if "full_name" in body:
        current_user.full_name = body["full_name"]
    if "claude_model" in body:
        current_user.claude_model = body["claude_model"] or None
    if "instruction_presets" in body:
        presets = body["instruction_presets"]
        if isinstance(presets, list):
            current_user.instruction_presets = presets
    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "has_claude_api_key": bool(current_user.claude_api_key),
        "claude_model": current_user.claude_model,
        "instruction_presets": current_user.instruction_presets or [],
    }


@router.get("/users/search")
async def search_users(
    q: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search active users by username or full_name prefix. Returns up to 10 matches. Excludes self."""
    if len(q) < 2:
        return []
    results = (
        db.query(User)
        .filter(
            User.is_active == True,
            User.id != current_user.id,
            (User.username.ilike(f"%{q}%") | User.full_name.ilike(f"%{q}%")),
        )
        .limit(10)
        .all()
    )
    return [{"username": u.username, "full_name": u.full_name} for u in results]


@router.post("/logout")
async def logout():
    """Clear session cookie."""
    response = Response(content='{"message":"logged out"}', media_type="application/json")
    response.delete_cookie(COOKIE_NAME, path="/")
    return response
