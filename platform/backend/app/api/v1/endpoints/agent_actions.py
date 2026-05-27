from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.agent import approve_action, create_action, get_action, get_assignment, list_actions
from app.db.session import get_db
from app.schemas.agent import AgentActionCreate, AgentActionRead, AgentPlanRequest
from app.services.agent_action_engine import build_default_actions_for_assignment

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

    created = []
    for item in build_default_actions_for_assignment(assignment):
        created.append(create_action(db, item))
    return created


@router.post("/{action_id}/approve", response_model=AgentActionRead)
def approve_agent_action(action_id: int, actor_name: str = "human", db: Session = Depends(get_db)):
    action = get_action(db, action_id)
    if action is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return approve_action(db, action, approved_by=actor_name)
