"""
LinkedIn Schedule API — Calendrier éditorial automatisé

POST /linkedin/schedule          → planifier un post (date + heure)
GET  /linkedin/schedule          → liste des posts planifiés
DELETE /linkedin/schedule/{id}   → annuler un post planifié
POST /linkedin/schedule/calendar → générer un calendrier 30 jours
GET  /linkedin/schedule/stats    → statistiques publication
POST /linkedin/schedule/{id}/publish-now → publier immédiatement
"""
from __future__ import annotations
import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User

log = logging.getLogger("datasphere.linkedin.schedule")
router = APIRouter(prefix="/linkedin", tags=["linkedin-schedule"])

TOPIC_TYPES = [
    "data_engineering", "ao_insight", "market_trend",
    "tech_tip", "feedback", "guinea_africa",
]

WEEKLY_CALENDAR = [
    # (day_offset, topic_type, suggested_hour)
    (0,  "data_engineering", 8),
    (2,  "market_trend",     12),
    (4,  "tech_tip",         17),
    (7,  "data_engineering", 8),
    (9,  "ao_insight",       10),
    (11, "feedback",         15),
    (14, "data_engineering", 8),
    (16, "guinea_africa",    12),
    (18, "market_trend",     17),
    (21, "data_engineering", 8),
    (23, "tech_tip",         10),
    (25, "ao_insight",       15),
    (28, "data_engineering", 8),
    (30, "market_trend",     12),
]


class ScheduleCreate(BaseModel):
    topic_type:   str = "data_engineering"
    topic:        str | None = None
    content:      str | None = None  # Si fourni, pas de génération IA
    scheduled_at: str  # ISO datetime


class CalendarRequest(BaseModel):
    start_date:  str | None = None   # ISO date, défaut = aujourd'hui
    auto_generate: bool = False       # Générer le contenu maintenant (lent) ou à la publication


def _get_post(db: Session, post_id: int, user_id: int) -> dict:
    row = db.execute(text(
        "SELECT * FROM linkedin_scheduled_posts WHERE id=:id AND owner_id=:uid"
    ), {"id": post_id, "uid": user_id}).fetchone()
    if not row:
        raise HTTPException(404, "Post non trouvé")
    return dict(row._mapping)


@router.get("/schedule")
def list_scheduled(
    status: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = "SELECT * FROM linkedin_scheduled_posts WHERE owner_id=:uid"
    params: dict = {"uid": current_user.id}
    if status:
        q += " AND status=:status"
        params["status"] = status
    q += " ORDER BY scheduled_at ASC LIMIT :lim"
    params["lim"] = limit
    try:
        rows = db.execute(text(q), params).fetchall()
        posts = [dict(r._mapping) for r in rows]
        # Déserialiser hashtags JSON
        for p in posts:
            if p.get("hashtags"):
                try:
                    p["hashtags"] = json.loads(p["hashtags"])
                except Exception:
                    pass
        return posts
    except Exception as e:
        return []


@router.post("/schedule", status_code=201)
def schedule_post(
    payload: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Planifie un post LinkedIn pour une date/heure donnée."""
    try:
        scheduled_dt = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "Format de date invalide. Utilisez ISO 8601.")

    if scheduled_dt < datetime.now(timezone.utc):
        raise HTTPException(400, "La date de publication doit être dans le futur.")

    # Générer le contenu si non fourni
    content = payload.content
    hashtags_json = "[]"
    provider = None

    if not content:
        try:
            from app.services.linkedin_agent import generate_post
            result = generate_post(topic_type=payload.topic_type, topic=payload.topic)
            content = result.get("content", "")
            hashtags_json = json.dumps(result.get("hashtags", []))
            provider = result.get("provider")
        except Exception as e:
            log.warning("Pre-generation failed, will generate at publish time: %s", e)

    try:
        db.execute(text("""
            INSERT INTO linkedin_scheduled_posts
                (owner_id, topic_type, topic, content, hashtags, status, scheduled_at, provider, created_at)
            VALUES (:uid, :tt, :topic, :content, :hashtags, 'pending', :sch, :prov, :now)
        """), {
            "uid": current_user.id, "tt": payload.topic_type,
            "topic": payload.topic, "content": content,
            "hashtags": hashtags_json, "sch": scheduled_dt,
            "prov": provider, "now": datetime.utcnow(),
        })
        db.commit()
        row = db.execute(text(
            "SELECT * FROM linkedin_scheduled_posts WHERE owner_id=:uid ORDER BY id DESC LIMIT 1"
        ), {"uid": current_user.id}).fetchone()
        return dict(row._mapping)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Erreur création post: {e}")


@router.delete("/schedule/{post_id}", status_code=204)
def cancel_scheduled_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post(db, post_id, current_user.id)
    if post["status"] == "published":
        raise HTTPException(400, "Impossible d'annuler un post déjà publié.")
    db.execute(text(
        "UPDATE linkedin_scheduled_posts SET status='cancelled' WHERE id=:id"
    ), {"id": post_id})
    db.commit()


@router.post("/schedule/{post_id}/publish-now")
def publish_now(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publie immédiatement un post planifié."""
    post = _get_post(db, post_id, current_user.id)
    if post["status"] == "published":
        raise HTTPException(400, "Post déjà publié.")

    content = post.get("content") or ""
    if not content:
        try:
            from app.services.linkedin_agent import generate_post
            result = generate_post(topic_type=post["topic_type"], topic=post.get("topic"))
            content = result.get("content", "")
        except Exception as e:
            raise HTTPException(500, f"Génération du contenu échouée: {e}")

    # Récupérer token OAuth
    import json as _json
    access_token = ""
    try:
        extra = _json.loads(current_user.extra_data or "{}")
        access_token = extra.get("linkedin_access_token", "")
    except Exception:
        pass

    if not access_token:
        raise HTTPException(401, "Token LinkedIn non configuré. Connectez votre compte via OAuth.")

    try:
        from app.services.linkedin_agent import publish_to_linkedin
        result = publish_to_linkedin(content, access_token)
        db.execute(text("""
            UPDATE linkedin_scheduled_posts
            SET status='published', content=:content, published_at=:now,
                linkedin_post_id=:post_id_li
            WHERE id=:id
        """), {
            "content": content, "now": datetime.utcnow(),
            "post_id_li": str(result.get("id", "")), "id": post_id
        })
        db.commit()
        return {"success": True, "post_id": result.get("id"), "content": content[:100]}
    except Exception as e:
        db.execute(text(
            "UPDATE linkedin_scheduled_posts SET status='failed', error_msg=:err WHERE id=:id"
        ), {"err": str(e)[:500], "id": post_id})
        db.commit()
        raise HTTPException(502, f"Publication LinkedIn échouée: {e}")


@router.post("/schedule/calendar")
def generate_calendar(
    payload: CalendarRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Génère un calendrier éditorial de 30 jours.
    Crée ~14 posts planifiés selon un rythme optimal (lundi/mercredi/vendredi).
    """
    from datetime import date

    start = date.today()
    if payload.start_date:
        try:
            start = date.fromisoformat(payload.start_date)
        except ValueError:
            raise HTTPException(400, "Format de date invalide.")

    # Supprimer les posts pending futurs existants
    db.execute(text("""
        DELETE FROM linkedin_scheduled_posts
        WHERE owner_id=:uid AND status='pending' AND scheduled_at > :now
    """), {"uid": current_user.id, "now": datetime.utcnow()})

    created = []
    for day_offset, topic_type, hour in WEEKLY_CALENDAR:
        scheduled_dt = datetime.combine(
            start + timedelta(days=day_offset),
            datetime.min.time().replace(hour=hour, minute=0),
        )
        if scheduled_dt < datetime.utcnow():
            continue

        # Générer le contenu si demandé
        content = None
        hashtags_json = "[]"
        provider = None

        if payload.auto_generate:
            try:
                from app.services.linkedin_agent import generate_post
                result = generate_post(topic_type=topic_type)
                content = result.get("content")
                hashtags_json = json.dumps(result.get("hashtags", []))
                provider = result.get("provider")
            except Exception as e:
                log.warning("Pre-gen failed for day+%d: %s", day_offset, e)

        db.execute(text("""
            INSERT INTO linkedin_scheduled_posts
                (owner_id, topic_type, content, hashtags, status, scheduled_at, provider, created_at)
            VALUES (:uid, :tt, :content, :hashtags, 'pending', :sch, :prov, :now)
        """), {
            "uid": current_user.id, "tt": topic_type,
            "content": content, "hashtags": hashtags_json,
            "sch": scheduled_dt, "prov": provider, "now": datetime.utcnow(),
        })
        created.append({"day": day_offset, "topic_type": topic_type, "scheduled_at": scheduled_dt.isoformat()})

    db.commit()
    return {"created": len(created), "posts": created}


@router.get("/schedule/stats")
def schedule_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        total     = db.execute(text("SELECT COUNT(*) FROM linkedin_scheduled_posts WHERE owner_id=:uid"), {"uid": current_user.id}).scalar() or 0
        published = db.execute(text("SELECT COUNT(*) FROM linkedin_scheduled_posts WHERE owner_id=:uid AND status='published'"), {"uid": current_user.id}).scalar() or 0
        pending   = db.execute(text("SELECT COUNT(*) FROM linkedin_scheduled_posts WHERE owner_id=:uid AND status='pending'"), {"uid": current_user.id}).scalar() or 0
        failed    = db.execute(text("SELECT COUNT(*) FROM linkedin_scheduled_posts WHERE owner_id=:uid AND status='failed'"), {"uid": current_user.id}).scalar() or 0
        next_post = db.execute(text("""
            SELECT scheduled_at FROM linkedin_scheduled_posts
            WHERE owner_id=:uid AND status='pending' AND scheduled_at > :now
            ORDER BY scheduled_at ASC LIMIT 1
        """), {"uid": current_user.id, "now": datetime.utcnow()}).fetchone()
        return {
            "total": total, "published": published, "pending": pending, "failed": failed,
            "next_scheduled_at": next_post[0].isoformat() if next_post else None,
            "publication_rate": round(published / max(total, 1) * 100, 1),
        }
    except Exception as e:
        return {"total": 0, "published": 0, "pending": 0, "failed": 0, "error": str(e)}
