from sqlalchemy.orm import Session

from app.models.agent import AgentAssignment, AgentProfile
from app.schemas.agent import AgentAssignmentCreate, AgentAssignmentUpdate, AgentProfileCreate, AgentProfileUpdate


def list_agents(db: Session, skip: int = 0, limit: int = 100) -> list[AgentProfile]:
    return db.query(AgentProfile).order_by(AgentProfile.domain.asc(), AgentProfile.name.asc()).offset(skip).limit(limit).all()


def get_agent(db: Session, agent_id: int) -> AgentProfile | None:
    return db.query(AgentProfile).filter(AgentProfile.id == agent_id).first()


def get_agent_by_slug(db: Session, slug: str) -> AgentProfile | None:
    return db.query(AgentProfile).filter(AgentProfile.slug == slug).first()


def create_agent(db: Session, payload: AgentProfileCreate) -> AgentProfile:
    data = payload.model_dump()
    data["system_prompt"] = data.pop("instruction_template")
    agent = AgentProfile(**data)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def update_agent(db: Session, agent: AgentProfile, payload: AgentProfileUpdate) -> AgentProfile:
    data = payload.model_dump(exclude_unset=True)
    if "instruction_template" in data:
        data["system_prompt"] = data.pop("instruction_template")
    for field, value in data.items():
        setattr(agent, field, value)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def list_assignments(db: Session, skip: int = 0, limit: int = 100) -> list[AgentAssignment]:
    return db.query(AgentAssignment).order_by(AgentAssignment.created_at.desc()).offset(skip).limit(limit).all()


def get_assignment(db: Session, assignment_id: int) -> AgentAssignment | None:
    return db.query(AgentAssignment).filter(AgentAssignment.id == assignment_id).first()


def create_assignment(db: Session, payload: AgentAssignmentCreate) -> AgentAssignment:
    assignment = AgentAssignment(**payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def update_assignment(db: Session, assignment: AgentAssignment, payload: AgentAssignmentUpdate) -> AgentAssignment:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(assignment, field, value)
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment
