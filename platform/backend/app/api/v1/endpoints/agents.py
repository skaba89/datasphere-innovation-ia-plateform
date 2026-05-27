from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.agent import (
    create_agent,
    create_assignment,
    get_agent,
    get_agent_by_slug,
    get_assignment,
    list_agents,
    list_assignments,
    update_agent,
    update_assignment,
)
from app.crud.opportunity import get_opportunity
from app.crud.tender import get_tender
from app.db.session import get_db
from app.schemas.agent import (
    AgentAssignmentCreate,
    AgentAssignmentRead,
    AgentAssignmentUpdate,
    AgentProfileCreate,
    AgentProfileRead,
    AgentProfileUpdate,
)

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
