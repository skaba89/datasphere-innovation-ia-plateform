from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.agent import AgentAction, AgentAssignment, AgentProfile
from app.schemas.agent import (
    AgentActionCreate,
    AgentActionUpdate,
    AgentAssignmentCreate,
    AgentAssignmentUpdate,
    AgentProfileCreate,
    AgentProfileUpdate,
)


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


def list_actions(db: Session, assignment_id: int | None = None, skip: int = 0, limit: int = 100) -> list[AgentAction]:
    query = db.query(AgentAction)
    if assignment_id is not None:
        query = query.filter(AgentAction.assignment_id == assignment_id)
    return query.order_by(AgentAction.created_at.asc()).offset(skip).limit(limit).all()


def get_action(db: Session, action_id: int) -> AgentAction | None:
    return db.query(AgentAction).filter(AgentAction.id == action_id).first()


def create_action(db: Session, payload: AgentActionCreate) -> AgentAction:
    action = AgentAction(**payload.model_dump())
    db.add(action)
    db.commit()
    db.refresh(action)
    # Push notification for actions requiring human approval
    if action.requires_human_approval:
        try:
            from app.crud.notification import push_approval_required
            push_approval_required(db, action.id, action.title)
        except Exception:
            pass  # Never block action creation due to notification failure
    return action


def update_action(db: Session, action: AgentAction, payload: AgentActionUpdate) -> AgentAction:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(action, field, value)
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


def approve_action(db: Session, action: AgentAction, approved_by: str) -> AgentAction:
    action.status = "approved"
    action.approved_by = approved_by
    action.approved_at = datetime.now(timezone.utc)
    db.add(action)
    db.commit()
    db.refresh(action)
    try:
        from app.api.v1.endpoints.sse import push_action_approved
        push_action_approved(action.id, action.title)
    except Exception:
        pass
    return action


def mark_action_executed(db: Session, action: AgentAction, result_summary: str, next_step: str | None = None) -> AgentAction:
    action.status = "done"
    action.executed_at = datetime.now(timezone.utc)
    action.result_summary = result_summary
    action.next_step = next_step
    db.add(action)
    db.commit()
    db.refresh(action)
    return action
