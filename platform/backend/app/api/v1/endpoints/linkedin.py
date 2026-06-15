"""
LinkedIn Agent endpoints

POST /linkedin/generate           — génère un post via LLM
POST /linkedin/generate-from-ao   — génère depuis un AO traité
POST /linkedin/publish             — publie via l'API LinkedIn
GET  /linkedin/topics              — liste des sujets suggérés
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/linkedin", tags=["linkedin"])


class GenerateRequest(BaseModel):
    topic_type: str = "data_engineering"
    topic:      str | None = None


class GenerateFromAORequest(BaseModel):
    tender_id: int


class PublishRequest(BaseModel):
    content:      str
    access_token: str = ""  # Optionnel — si absent, utilise le token OAuth stocké en DB


@router.get("/topics")
def get_topics(current_user: User = Depends(get_current_user)):
    """Return suggested LinkedIn post topics."""
    from app.services.linkedin_agent import DEFAULT_TOPICS, TOPIC_PROMPTS
    return {
        "topics":      DEFAULT_TOPICS,
        "topic_types": list(TOPIC_PROMPTS.keys()),
        "tip": "Ajoutez LINKEDIN_ACCESS_TOKEN dans Render pour publier automatiquement.",
    }


@router.post("/generate")
def generate_post(
    payload: GenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a LinkedIn post on a data engineering topic."""
    from app.services.linkedin_agent import generate_post as gen
    try:
        result = gen(topic_type=payload.topic_type, topic=payload.topic)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-from-ao")
def generate_from_ao(
    payload: GenerateFromAORequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a LinkedIn post from a completed AO workflow."""
    from app.crud.tender import get_tender
    from app.models.workflow import WorkflowInstance, WorkflowStep
    from app.services.linkedin_agent import generate_from_tender

    tender = get_tender(db, payload.tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="AO introuvable")

    # Get workflow result if available
    wf = db.query(WorkflowInstance).filter(WorkflowInstance.tender_id == payload.tender_id).first()
    workflow_result = None
    if wf:
        draft_step = db.query(WorkflowStep).filter(
            WorkflowStep.instance_id == wf.id,
            WorkflowStep.step_key == "generate_draft",
            WorkflowStep.status == "done",
        ).first()
        if draft_step:
            workflow_result = draft_step.result_summary

    try:
        result = generate_from_tender(
            tender_title=tender.title,
            tender_summary=tender.summary,
            workflow_result=workflow_result,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/publish")
def publish_post(
    payload: PublishRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Publish a LinkedIn post.
    Token priority:
      1. Token OAuth2 stocké en DB pour l'utilisateur courant (via /linkedin/oauth/callback)
      2. Token passé dans le body (legacy / manuel)
    """
    from app.services.linkedin_agent import publish_to_linkedin
    import json as _json

    # 1. Récupérer le token OAuth stocké en DB
    access_token = ""
    try:
        if hasattr(current_user, "extra_data") and current_user.extra_data:
            extra = _json.loads(current_user.extra_data)
            stored_token = extra.get("linkedin_access_token", "")
            if stored_token:
                from datetime import datetime, timezone
                expires = extra.get("linkedin_token_expires")
                if expires:
                    exp_dt = datetime.fromisoformat(expires)
                    if exp_dt > datetime.now(timezone.utc):
                        access_token = stored_token
                    else:
                        raise HTTPException(
                            status_code=401,
                            detail="Token LinkedIn expiré. Reconnectez-vous via /linkedin/oauth/auth-url."
                        )
                else:
                    access_token = stored_token
    except HTTPException:
        raise
    except Exception:
        pass

    # 2. Fallback: token passé dans le body (legacy)
    if not access_token and payload.access_token.strip():
        access_token = payload.access_token.strip()

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Aucun token LinkedIn disponible. Connectez votre compte via OAuth ou fournissez un token manuel."
        )

    try:
        result = publish_to_linkedin(payload.content, access_token)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur LinkedIn API: {e}")

