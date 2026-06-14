"""
Consultant Experiences API

GET    /consultant/experiences           → liste mes expériences
POST   /consultant/experiences           → créer une expérience
PATCH  /consultant/experiences/{id}      → modifier
DELETE /consultant/experiences/{id}      → supprimer
PUT    /consultant/experiences/reorder   → réordonner
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.consultant_experience import ConsultantExperience
from app.models.user import User

router = APIRouter(prefix="/consultant/experiences", tags=["consultant-experiences"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ExperienceCreate(BaseModel):
    company:       str
    client_name:   Optional[str] = None
    role:          str
    sector:        Optional[str] = None
    location:      Optional[str] = None
    project_type:  Optional[str] = None
    start_date:    str
    end_date:      Optional[str] = None
    is_current:    bool = False
    context:       Optional[str] = None
    description:   str
    achievements:  Optional[str] = None   # une réalisation par ligne
    technologies:  Optional[str] = None   # séparées par virgules
    methodologies: Optional[str] = None
    is_highlight:  bool = True
    display_order: int  = 0

class ExperienceUpdate(BaseModel):
    company:       Optional[str] = None
    client_name:   Optional[str] = None
    role:          Optional[str] = None
    sector:        Optional[str] = None
    location:      Optional[str] = None
    project_type:  Optional[str] = None
    start_date:    Optional[str] = None
    end_date:      Optional[str] = None
    is_current:    Optional[bool] = None
    context:       Optional[str] = None
    description:   Optional[str] = None
    achievements:  Optional[str] = None
    technologies:  Optional[str] = None
    methodologies: Optional[str] = None
    is_highlight:  Optional[bool] = None
    display_order: Optional[int]  = None

class ExperienceRead(BaseModel):
    id:            int
    owner_email:   str
    company:       str
    client_name:   Optional[str]
    role:          str
    sector:        Optional[str]
    location:      Optional[str]
    project_type:  Optional[str]
    start_date:    str
    end_date:      Optional[str]
    is_current:    bool
    context:       Optional[str]
    description:   str
    achievements:  Optional[str]
    technologies:  Optional[str]
    methodologies: Optional[str]
    is_highlight:  bool
    display_order: int

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ExperienceRead])
def list_experiences(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Liste toutes mes expériences professionnelles triées par ordre."""
    return (
        db.query(ConsultantExperience)
        .filter(ConsultantExperience.owner_email == current_user.email)
        .order_by(ConsultantExperience.display_order, ConsultantExperience.id.desc())
        .all()
    )


@router.post("", response_model=ExperienceRead, status_code=status.HTTP_201_CREATED)
def create_experience(
    payload:      ExperienceCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Ajouter une nouvelle expérience professionnelle."""
    exp = ConsultantExperience(
        owner_email=current_user.email,
        **payload.model_dump(),
    )
    db.add(exp); db.commit(); db.refresh(exp)
    return exp


@router.patch("/{exp_id}", response_model=ExperienceRead)
def update_experience(
    exp_id:       int,
    payload:      ExperienceUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Modifier une expérience."""
    exp = db.query(ConsultantExperience).filter(
        ConsultantExperience.id == exp_id,
        ConsultantExperience.owner_email == current_user.email,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expérience non trouvée")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(exp, k, v)
    db.commit(); db.refresh(exp)
    return exp


@router.delete("/{exp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experience(
    exp_id:       int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Supprimer une expérience."""
    exp = db.query(ConsultantExperience).filter(
        ConsultantExperience.id == exp_id,
        ConsultantExperience.owner_email == current_user.email,
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expérience non trouvée")
    db.delete(exp); db.commit()


@router.put("/reorder", response_model=list[ExperienceRead])
def reorder_experiences(
    order:        list[int],   # IDs dans le nouvel ordre
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Réordonner les expériences (drag & drop)."""
    for i, exp_id in enumerate(order):
        db.query(ConsultantExperience).filter(
            ConsultantExperience.id == exp_id,
            ConsultantExperience.owner_email == current_user.email,
        ).update({"display_order": i})
    db.commit()
    return list_experiences(db, current_user)
