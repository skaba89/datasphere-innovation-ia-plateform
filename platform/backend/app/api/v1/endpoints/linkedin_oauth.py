"""
LinkedIn OAuth2 flow — DataSphere Innovation

GET  /linkedin/oauth/auth-url   → génère l'URL d'autorisation LinkedIn
GET  /linkedin/oauth/callback   → reçoit le code et échange contre un access_token
POST /linkedin/oauth/revoke     → révoque le token stocké
GET  /linkedin/oauth/status     → vérifie si un token valide est stocké

Le token est stocké en DB par user (pas en session).
"""

from __future__ import annotations
import os
import urllib.parse
import urllib.request
import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User

log = logging.getLogger("datasphere.linkedin_oauth")
router = APIRouter(prefix="/linkedin/oauth", tags=["linkedin"])

LINKEDIN_CLIENT_ID     = os.getenv("LINKEDIN_CLIENT_ID", "")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
LINKEDIN_REDIRECT_URI  = os.getenv("LINKEDIN_REDIRECT_URI",
    "https://datasphere-backend-zl3v.onrender.com/api/v1/linkedin/oauth/callback")

SCOPES = "openid profile email w_member_social"


@router.get("/auth-url")
def get_auth_url(current_user: User = Depends(get_current_user)):
    """Generate the LinkedIn OAuth2 authorization URL."""
    if not LINKEDIN_CLIENT_ID:
        return {
            "configured": False,
            "message": "LinkedIn OAuth non configuré. Ajoutez LINKEDIN_CLIENT_ID et LINKEDIN_CLIENT_SECRET dans Render.",
            "manual_token_url": "https://developers.linkedin.com",
        }

    params = {
        "response_type": "code",
        "client_id": LINKEDIN_CLIENT_ID,
        "redirect_uri": LINKEDIN_REDIRECT_URI,
        "scope": SCOPES,
        "state": f"user_{current_user.id}_{datetime.now(timezone.utc).timestamp():.0f}",
    }
    url = "https://www.linkedin.com/oauth/v2/authorization?" + urllib.parse.urlencode(params)
    return {"configured": True, "auth_url": url, "scopes": SCOPES}


@router.get("/callback")
def oauth_callback(
    code:  str = Query(...),
    state: str = Query(""),
    db:    Session = Depends(get_db),
):
    """Handle LinkedIn OAuth2 callback — exchange code for access token."""
    if not LINKEDIN_CLIENT_ID:
        raise HTTPException(status_code=503, detail="LinkedIn OAuth non configuré")

    # Exchange code for token
    data = urllib.parse.urlencode({
        "grant_type":    "authorization_code",
        "code":          code,
        "redirect_uri":  LINKEDIN_REDIRECT_URI,
        "client_id":     LINKEDIN_CLIENT_ID,
        "client_secret": LINKEDIN_CLIENT_SECRET,
    }).encode()

    req = urllib.request.Request(
        "https://www.linkedin.com/oauth/v2/accessToken",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            token_data = json.load(resp)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LinkedIn token exchange failed: {e}")

    access_token = token_data.get("access_token")
    expires_in   = token_data.get("expires_in", 5184000)  # 60 days default

    if not access_token:
        raise HTTPException(status_code=502, detail="No access_token in LinkedIn response")

    # Store token in user profile (extra_data JSON field)
    try:
        user_id = int(state.split("_")[1]) if state.startswith("user_") else None
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                import json as _json
                extra = _json.loads(user.extra_data or "{}") if hasattr(user, "extra_data") and user.extra_data else {}
                extra["linkedin_access_token"] = access_token
                extra["linkedin_token_expires"] = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()
                if hasattr(user, "extra_data"):
                    user.extra_data = _json.dumps(extra)
                    db.commit()
    except Exception as e:
        log.warning(f"Failed to store LinkedIn token: {e}")

    # Redirect to frontend with success
    frontend = os.getenv("CORS_ORIGINS", "https://datasphere-frontend-n1mb.onrender.com").split(",")[0]
    return RedirectResponse(url=f"{frontend}?linkedin_connected=1", status_code=302)


@router.get("/status")
def oauth_status(current_user: User = Depends(get_current_user)):
    """Check if the current user has a valid LinkedIn access token."""
    configured = bool(LINKEDIN_CLIENT_ID)

    # Check stored token
    try:
        import json as _json
        extra = _json.loads(current_user.extra_data or "{}") if hasattr(current_user, "extra_data") and current_user.extra_data else {}
        token = extra.get("linkedin_access_token")
        expires = extra.get("linkedin_token_expires")
        has_token = bool(token)
        is_expired = False
        if expires:
            exp_dt = datetime.fromisoformat(expires)
            is_expired = exp_dt < datetime.now(timezone.utc)
    except Exception:
        has_token = False
        is_expired = False
        token = None

    return {
        "oauth_configured": configured,
        "has_token":        has_token,
        "is_expired":       is_expired,
        "connect_url":      "/api/v1/linkedin/oauth/auth-url" if configured else None,
        "manual_token_doc": "https://developers.linkedin.com",
    }
