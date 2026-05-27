from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.default_agents import get_default_agent_profiles
from app.crud.agent import create_agent, get_agent_by_slug
from app.db.session import get_db
from app.schemas.agent import AgentProfileRead

router = APIRouter(prefix="/agent-templates", tags=["agent-templates"], dependencies=[Depends(get_current_user)])


@router.get("/defaults", response_model=list[AgentProfileRead])
def preview_default_agent_templates(db: Session = Depends(get_db)):
    profiles = []
    for template in get_default_agent_profiles():
        existing = get_agent_by_slug(db, template.slug)
        if existing is not None:
            profiles.append(existing)
        else:
            data = template.model_dump()
            data["system_prompt"] = data.pop("instruction_template")
            profiles.append(type("PreviewAgent", (), data | {"id": 0, "created_at": None, "updated_at": None})())
    return profiles


@router.post("/defaults/install", response_model=list[AgentProfileRead], status_code=status.HTTP_201_CREATED)
def install_default_agent_templates(db: Session = Depends(get_db)):
    installed = []
    for template in get_default_agent_profiles():
        existing = get_agent_by_slug(db, template.slug)
        if existing is not None:
            installed.append(existing)
            continue
        installed.append(create_agent(db, template))
    return installed
