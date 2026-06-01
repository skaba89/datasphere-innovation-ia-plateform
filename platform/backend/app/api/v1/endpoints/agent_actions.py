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
from app.crud.audit_log import write_log
from app.db.session import get_db
from app.models.agent import AgentAction
from app.schemas.agent import AgentActionCreate, AgentActionRead, AgentPlanRequest, AgentRunRequest
from app.services.agent_action_engine import build_default_actions_for_assignment
from app.services.agent_executor import execute_action

router = APIRouter(prefix="/agent-actions", tags=["agent-actions"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[AgentActionRead])
def read_agent_actions(assignment_id: int | None = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return list_actions(db, assignment_id=assignment_id, skip=skip, limit=limit)


@router.get("/pending-approvals", response_model=list[AgentActionRead])
def read_pending_approvals(db: Session = Depends(get_db)):
    """Return all actions that require human approval and have not been approved yet."""
    return (
        db.query(AgentAction)
        .filter(
            AgentAction.requires_human_approval == True,  # noqa: E712
            AgentAction.approved_by.is_(None),
            AgentAction.status != "done",
            AgentAction.status != "failed",
        )
        .order_by(AgentAction.created_at.asc())
        .all()
    )


@router.post("", response_model=AgentActionRead, status_code=status.HTTP_201_CREATED)
def create_new_agent_action(payload: AgentActionCreate, db: Session = Depends(get_db)):
    if get_assignment(db, payload.assignment_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment does not exist")
    return create_action(db, payload)


@router.post("/plan", response_model=list[AgentActionRead], status_code=status.HTTP_201_CREATED)
def plan_agent_actions(payload: AgentPlanRequest, db: Session = Depends(get_db)):
    """
    Idempotent planning: create only missing action types, then return ALL
    actions for the assignment (new + pre-existing).
    """
    assignment = get_assignment(db, payload.assignment_id)
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    existing_actions = list_actions(db, assignment_id=assignment.id)
    existing_types = {action.action_type for action in existing_actions}
    new_count = 0

    for item in build_default_actions_for_assignment(assignment):
        if item.action_type in existing_types:
            continue
        create_action(db, item)
        new_count += 1

    if new_count:
        write_log(
            db, action="PLAN", resource_type="agent_assignment",
            resource_id=assignment.id,
            resource_label=f"Assignment #{assignment.id}",
            detail=f"{new_count} action(s) planifiée(s)",
        )

    return list_actions(db, assignment_id=assignment.id)


@router.post("/{action_id}/approve", response_model=AgentActionRead)
def approve_agent_action(action_id: int, actor_name: str = "human", db: Session = Depends(get_db)):
    action = get_action(db, action_id)
    if action is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    result = approve_action(db, action, approved_by=actor_name)
    write_log(
        db, action="APPROVE", resource_type="agent_action",
        resource_id=action_id,
        resource_label=action.title,
        actor_name=actor_name,
        detail=f"Action type: {action.action_type}",
    )
    return result


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

    try:
        result_summary, next_step = execute_action(db, action)
    except Exception as exc:
        write_log(
            db, action="EXECUTE", resource_type="agent_action",
            resource_id=action.id, resource_label=action.title, status="error",
            detail=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Execution error: {exc}",
        ) from exc

    executed = mark_action_executed(db, action, result_summary=result_summary, next_step=next_step)
    write_log(
        db, action="EXECUTE", resource_type="agent_action",
        resource_id=action.id, resource_label=action.title,
        detail=f"type={action.action_type} · {len(result_summary or '')} chars",
    )
    return executed
