from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.analytics import PipelineAnalytics
from app.services.analytics_service import get_pipeline_analytics

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/pipeline", response_model=PipelineAnalytics)
def pipeline_analytics(db: Session = Depends(get_db)):
    """
    Return comprehensive pipeline KPIs in a single call:
    opportunities, tenders, agents, deliverables, scheduler stats + notifications.
    """
    return get_pipeline_analytics(db)


@router.get("/gantt")
def gantt_data(db: Session = Depends(get_db)):
    """
    Return assignments + their actions for Gantt timeline visualization.
    Each assignment is a row; each action is a bar with start/end dates.
    """
    from app.models.agent import AgentAction, AgentAssignment, AgentProfile
    from app.models.opportunity import Opportunity
    from app.models.tender import Tender
    from datetime import datetime, timedelta

    assignments = (
        db.query(AgentAssignment)
        .order_by(AgentAssignment.created_at.desc())
        .limit(20)
        .all()
    )

    rows = []
    for a in assignments:
        actions = (
            db.query(AgentAction)
            .filter(AgentAction.assignment_id == a.id)
            .order_by(AgentAction.created_at)
            .all()
        )
        agent = db.query(AgentProfile).filter(AgentProfile.id == a.agent_id).first()

        # Context label
        ctx = ""
        if a.tender_id:
            t = db.query(Tender).filter(Tender.id == a.tender_id).first()
            ctx = t.reference or t.title if t else f"AO #{a.tender_id}"
        elif a.opportunity_id:
            o = db.query(Opportunity).filter(Opportunity.id == a.opportunity_id).first()
            ctx = o.title[:40] if o else f"Opp #{a.opportunity_id}"

        # Build action bars
        action_bars = []
        base_dt = a.created_at
        for i, action in enumerate(actions):
            start = action.created_at
            end = action.executed_at or (start + timedelta(hours=2))
            action_bars.append({
                "id": action.id,
                "action_type": action.action_type,
                "title": action.title,
                "status": action.status,
                "requires_human_approval": action.requires_human_approval,
                "approved_by": action.approved_by,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "duration_minutes": max(1, int((end - start).total_seconds() / 60)),
            })

        rows.append({
            "assignment_id": a.id,
            "agent_name": agent.name if agent else f"Agent #{a.agent_id}",
            "context": ctx,
            "objective": a.objective[:60],
            "status": a.status,
            "priority": a.priority,
            "created_at": a.created_at.isoformat(),
            "actions": action_bars,
            "total_actions": len(actions),
            "done_actions": sum(1 for ac in actions if ac.status == "done"),
        })

    return {"assignments": rows, "generated_at": datetime.utcnow().isoformat()}
