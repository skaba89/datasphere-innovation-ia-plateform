from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.agent import (
    approve_action,
    create_agent,
    create_assignment,
    get_action,
    get_agent,
    get_agent_by_slug,
    get_assignment,
    list_actions,
    list_agents,
    list_assignments,
    mark_action_executed,
    update_agent,
    update_assignment,
)
from app.crud.opportunity import get_opportunity
from app.crud.tender import get_tender
from app.db.session import get_db
from app.schemas.agent import (
    AgentActionRead,
    AgentAssignmentCreate,
    AgentAssignmentRead,
    AgentAssignmentUpdate,
    AgentPlanRequest,
    AgentProfileCreate,
    AgentProfileRead,
    AgentProfileUpdate,
    AgentRunRequest,
)
from app.services.agent_action_engine import build_default_actions_for_assignment, simulate_action_execution

router = APIRouter(prefix="/agents", tags=["agents"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[AgentProfileRead])
def read_agents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_agents(db, skip=skip, limit=limit)


@router.post("", response_model=AgentProfileRead, status_code=status.HTTP_201_CREATED)
def create_new_agent(payload: AgentProfileCreate, db: Session = Depends(get_db)):
    if get_agent_by_slug(db, payload.slug) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent slug already exists")
    return create_agent(db, payload)


@router.get("/{agent_id}", response_model=AgentProfileRead)
def read_agent(agent_id: int, db: Session = Depends(get_db)):
    agent = get_agent(db, agent_id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentProfileRead)
def patch_agent(agent_id: int, payload: AgentProfileUpdate, db: Session = Depends(get_db)):
    agent = get_agent(db, agent_id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return update_agent(db, agent, payload)


@router.get("/assignments/list", response_model=list[AgentAssignmentRead])
def read_assignments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_assignments(db, skip=skip, limit=limit)


@router.post("/assignments", response_model=AgentAssignmentRead, status_code=status.HTTP_201_CREATED)
def create_new_assignment(payload: AgentAssignmentCreate, db: Session = Depends(get_db)):
    if get_agent(db, payload.agent_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent does not exist")
    if payload.opportunity_id is not None and get_opportunity(db, payload.opportunity_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Opportunity does not exist")
    if payload.tender_id is not None and get_tender(db, payload.tender_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tender does not exist")
    return create_assignment(db, payload)


@router.patch("/assignments/{assignment_id}", response_model=AgentAssignmentRead)
def patch_assignment(assignment_id: int, payload: AgentAssignmentUpdate, db: Session = Depends(get_db)):
    assignment = get_assignment(db, assignment_id)
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return update_assignment(db, assignment, payload)


@router.get("/actions/list", response_model=list[AgentActionRead])
def read_actions(assignment_id: int | None = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_actions(db, assignment_id=assignment_id, skip=skip, limit=limit)


@router.post("/actions/plan", response_model=list[AgentActionRead], status_code=status.HTTP_201_CREATED)
def plan_assignment_actions(payload: AgentPlanRequest, db: Session = Depends(get_db)):
    assignment = get_assignment(db, payload.assignment_id)
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    existing_actions = list_actions(db, assignment_id=assignment.id)
    existing_types = {action.action_type for action in existing_actions}
    created_actions = []

    for action_payload in build_default_actions_for_assignment(assignment):
        if action_payload.action_type in existing_types:
            continue
        from app.crud.agent import create_action

        created_actions.append(create_action(db, action_payload))

    return created_actions


@router.post("/actions/{action_id}/approve", response_model=AgentActionRead)
def approve_assignment_action(action_id: int, actor_name: str = "reviewer", db: Session = Depends(get_db)):
    action = get_action(db, action_id)
    if action is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    return approve_action(db, action, actor_name)


@router.post("/actions/run", response_model=AgentActionRead)
def run_assignment_action(payload: AgentRunRequest, db: Session = Depends(get_db)):
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
