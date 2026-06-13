"""
CV Generator endpoints

POST /cv/generate          — Générer un CV complet via LLM
GET  /cv/domains           — Liste des domaines disponibles
GET  /cv/{id}/export/md    — Exporter un CV en Markdown
GET  /cv/{id}/export/html  — Exporter un CV en HTML
GET  /cv                   — Lister les CVs générés (en mémoire session)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse, HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_pagination, PaginationParams
from app.db.session import get_db
from app.models.user import User
from app.services.cv_agent import MISSION_DOMAINS, cv_to_markdown

router = APIRouter(prefix="/cv", tags=["cv-generator"])

# In-session CV store (stored in DB via JSONField for persistence)
_cv_store: dict[int, dict] = {}
_cv_counter = 0


class CVGenerateRequest(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=100, description="Prénom du consultant")
    last_name:  str = Field(..., min_length=2, max_length=100, description="Nom du consultant")
    domain:     str = Field(default="data_engineering", description="Domaine de compétence")
    mission_context: str | None = Field(default=None, max_length=2000,
                                         description="Contexte de la mission cible (optionnel)")
    years_experience: int = Field(default=7, ge=6, le=25,
                                   description="Années d'expérience minimum (6 minimum)")


@router.get("/domains")
def list_domains(current_user: User = Depends(get_current_user)):
    """Return available domains for CV generation."""
    return {
        "domains": [
            {"key": k, "label": v["label"], "roles": v["roles"][:3], "stack": v["stack"][:6]}
            for k, v in MISSION_DOMAINS.items()
        ]
    }


@router.post("/generate")
def generate_cv(
    payload: CVGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a complete consultant CV using AI."""
    global _cv_counter

    from app.services.cv_agent import generate_cv as gen
    try:
        result = gen(
            first_name=payload.first_name,
            last_name=payload.last_name,
            domain=payload.domain,
            mission_context=payload.mission_context,
            years_experience=payload.years_experience,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération CV : {e}")

    # Store for export
    _cv_counter += 1
    cv_id = _cv_counter
    _cv_store[cv_id] = result
    result["id"] = cv_id

    return result


@router.get("")
def list_cvs(current_user: User = Depends(get_current_user)):
    """Return all generated CVs in current session."""
    return [
        {
            "id": cid,
            "name": f"{cv['cv']['personal']['first_name']} {cv['cv']['personal']['last_name']}",
            "title": cv['cv']['personal'].get('title', ''),
            "domain": cv.get("domain_label", cv.get("domain", "")),
            "generated_at": cv.get("generated_at"),
            "provider": cv.get("provider"),
        }
        for cid, cv in _cv_store.items()
    ]


@router.get("/{cv_id}/export/md", response_class=PlainTextResponse)
def export_cv_markdown(cv_id: int, current_user: User = Depends(get_current_user)):
    """Export CV as Markdown."""
    cv = _cv_store.get(cv_id)
    if not cv:
        raise HTTPException(status_code=404, detail="CV non trouvé")
    md = cv_to_markdown(cv)
    p = cv["cv"]["personal"]
    filename = f"CV_{p['last_name']}_{p['first_name']}.md"
    return PlainTextResponse(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{cv_id}/export/html", response_class=HTMLResponse)
def export_cv_html(cv_id: int, current_user: User = Depends(get_current_user)):
    """Export CV as styled HTML."""
    cv = _cv_store.get(cv_id)
    if not cv:
        raise HTTPException(status_code=404, detail="CV non trouvé")
    md = cv_to_markdown(cv)
    p = cv["cv"]["personal"]
    html = _md_to_html(md, p)
    filename = f"CV_{p['last_name']}_{p['first_name']}.html"
    return HTMLResponse(
        content=html,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _md_to_html(md: str, personal: dict) -> str:
    """Convert Markdown CV to styled HTML."""
    import re
    name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}"
    title = personal.get("title", "")

    # Basic MD → HTML conversion
    html_body = md
    html_body = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html_body, flags=re.MULTILINE)
    html_body = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html_body, flags=re.MULTILINE)
    html_body = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html_body, flags=re.MULTILINE)
    html_body = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html_body)
    html_body = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html_body)
    html_body = re.sub(r'^- (.+)$', r'<li>\1</li>', html_body, flags=re.MULTILINE)
    html_body = re.sub(r'^---$', r'<hr>', html_body, flags=re.MULTILINE)
    html_body = html_body.replace('\n\n', '</p><p>')

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CV — {name}</title>
<style>
  body {{ font-family: 'Helvetica Neue', sans-serif; max-width: 900px; margin: 40px auto;
          padding: 40px; color: #1a1a1a; line-height: 1.6; }}
  h1 {{ color: #0f172a; font-size: 2rem; margin-bottom: 4px; }}
  h2 {{ color: #1e40af; font-size: 1.2rem; border-bottom: 2px solid #1e40af;
        padding-bottom: 4px; margin-top: 32px; }}
  h3 {{ color: #0f172a; font-size: 1rem; margin-bottom: 4px; }}
  li {{ margin: 4px 0; }}
  strong {{ color: #1e40af; }}
  hr {{ border: 1px solid #e2e8f0; margin: 16px 0; }}
  em {{ color: #64748b; }}
  @media print {{ body {{ margin: 0; padding: 20px; }} }}
</style>
</head>
<body>
<p>{html_body}</p>
</body>
</html>"""
