from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.agent import (
    approve_action,
    create_action,
    get_action,
    get_assignment,
    list_actions,
    mark_action_executed,
)
from app.db.session import get_db
from app.schemas.agent import AgentActionCreate, AgentActionRead, AgentPlanRequest, AgentRunRequest
from app.services.agent_action_engine import build_default_actions_for_assignment, simulate_action_execution

router = APIRouter(prefix="/agent-actions", tags=["agent-actions"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[AgentActionRead])
def read_agent_actions(assignment_id: int | None = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_actions(db, assignment_id=assignment_id, skip=skip, limit=limit)


@router.post("", response_model=AgentActionRead, status_code=status.HTTP_201_CREATED)
def create_new_agent_action(payload: AgentActionCreate, db: Session = Depends(get_db)):
    if get_assignment(db, payload.assignment_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not exist")
    return create_action(db, payload)


@router.post("/plan", response_model=list[AgentActionRead], status_code=status.HTTP_201_CREATED)
def plan_agent_actions(payload: AgentPlanRequest, db: Session = Depends(get_db)):
    assignment = get_assignment(db, payload.assignment_id)
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    existing_actions = list_actions(db, assignment_id=assignment.id)
    existing_types = {action.action_type for action in existing_actions}
    created = []

    for item in build_default_actions_for_assignment(assignment):
        if item.action_type in existing_types:
            continue
        created.append(create_action(db, item))
    return created


@router.post("/{action_id}/approve", response_model=AgentActionRead)
def approve_agent_action(action_id: int, actor_name: str = "human", db: Session = Depends(get_db)):
    action = get_action(db, action_id)
    if action is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return approve_action(db, action, approved_by=actor_name)


@router.post("/run", response_model=AgentActionRead)
def run_agent_action(payload: AgentRunRequest, db: Session = Depends(get_db)):
    action = get_action(db, payload.action_id)
    if action is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")

    if action.requires_human_approval and action.status != "approved" and not payload.force:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Human approval required before running this action",
        )

    result_summary, next_step = simulate_action_execution(action.action_type)
    return mark_action_executed(db, action, result_summary=result_summary, next_step=next_step)
