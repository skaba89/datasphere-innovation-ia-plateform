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
    from datetime import datetime, timedelta, timezone

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

    return {"assignments": rows, "generated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/dashboard")
def dashboard_kpis(db: Session = Depends(get_db)):
    """
    Comprehensive dashboard KPIs — all metrics in one call.
    Covers CRM, AO, deliverables, agents, suggestions, team.
    """
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func

    from app.models.agent import AgentAction, AgentAssignment, AgentProfile
    from app.models.contact import Contact
    from app.models.deliverable import Deliverable
    from app.models.notification import Notification
    from app.models.opportunity import Opportunity
    from app.models.organization import Organization
    from app.models.tender import Tender
    from app.models.user import User

    now = datetime.now(timezone.utc)
    last_30 = now - timedelta(days=30)
    last_7 = now - timedelta(days=7)

    # ── CRM ──────────────────────────────────────────────────────────────────
    total_orgs = db.query(Organization).filter(Organization.validation_status == "validated").count()
    total_contacts = db.query(Contact).count()
    total_opps = db.query(Opportunity).filter(Opportunity.validation_status == "validated").count()

    pipeline_value = db.query(
        func.sum(Opportunity.potential_value * Opportunity.probability / 100)
    ).filter(
        Opportunity.validation_status == "validated",
        Opportunity.potential_value.isnot(None),
    ).scalar() or 0

    won_opps = db.query(Opportunity).filter(
        Opportunity.status.in_(["Gagnée", "Signée"]),
        Opportunity.validation_status == "validated",
    ).count()

    active_opps = db.query(Opportunity).filter(
        Opportunity.status.notin_(["Perdue", "Abandonnée", "Gagnée", "Signée"]),
        Opportunity.validation_status == "validated",
    ).count()

    # ── AO ────────────────────────────────────────────────────────────────────
    total_tenders = db.query(Tender).filter(Tender.validation_status == "validated").count()
    pending_tenders = db.query(Tender).filter(Tender.validation_status == "pending").count()
    go_tenders = db.query(Tender).filter(Tender.go_no_go_decision == "go").count()
    submitted_tenders = db.query(Tender).filter(Tender.status == "submitted").count()

    upcoming_deadlines = db.query(Tender).filter(
        Tender.submission_deadline.isnot(None),
        Tender.submission_deadline >= now,
        Tender.submission_deadline <= now + timedelta(days=14),
        Tender.status != "submitted",
        Tender.validation_status == "validated",
    ).count()

    # ── Livrables ─────────────────────────────────────────────────────────────
    total_deliverables = db.query(Deliverable).count()
    approved_deliverables = db.query(Deliverable).filter(Deliverable.status == "approved").count()
    in_review = db.query(Deliverable).filter(Deliverable.status == "in_review").count()
    draft_deliverables = db.query(Deliverable).filter(Deliverable.status == "draft").count()

    # ── Agents ────────────────────────────────────────────────────────────────
    pending_approvals = db.query(AgentAction).filter(
        AgentAction.requires_human_approval == True,  # noqa
        AgentAction.approved_by.is_(None),
        AgentAction.status.in_(["auto_ready", "suggested"]),
    ).count()

    actions_30d = db.query(AgentAction).filter(
        AgentAction.created_at >= last_30
    ).count()

    done_actions_30d = db.query(AgentAction).filter(
        AgentAction.status == "done",
        AgentAction.created_at >= last_30,
    ).count()

    # ── Suggestions ───────────────────────────────────────────────────────────
    pending_suggestions = (
        db.query(Organization).filter(Organization.validation_status == "pending").count()
        + db.query(Opportunity).filter(Opportunity.validation_status == "pending").count()
        + db.query(Tender).filter(Tender.validation_status == "pending").count()
    )

    # ── Team ──────────────────────────────────────────────────────────────────
    total_users = db.query(User).filter(User.is_active == True).count()  # noqa

    # ── Notifications ─────────────────────────────────────────────────────────
    unread_notifications = db.query(Notification).filter(
        Notification.is_read == False  # noqa
    ).count()

    # ── Recent activity (last 7 days) ─────────────────────────────────────────
    new_opps_7d = db.query(Opportunity).filter(
        Opportunity.created_at >= last_7,
        Opportunity.validation_status == "validated",
    ).count()
    new_tenders_7d = db.query(Tender).filter(
        Tender.created_at >= last_7,
        Tender.validation_status == "validated",
    ).count()
    new_deliverables_7d = db.query(Deliverable).filter(
        Deliverable.created_at >= last_7
    ).count()

    return {
        "generated_at": now.isoformat(),
        "crm": {
            "organizations": total_orgs,
            "contacts": total_contacts,
            "opportunities_total": total_opps,
            "opportunities_active": active_opps,
            "opportunities_won": won_opps,
            "pipeline_value_weighted": round(float(pipeline_value), 2),
        },
        "tenders": {
            "total": total_tenders,
            "pending_validation": pending_tenders,
            "go_decisions": go_tenders,
            "submitted": submitted_tenders,
            "upcoming_deadlines_14d": upcoming_deadlines,
        },
        "deliverables": {
            "total": total_deliverables,
            "approved": approved_deliverables,
            "in_review": in_review,
            "draft": draft_deliverables,
            "approval_rate": round(approved_deliverables / max(total_deliverables, 1) * 100, 1),
        },
        "agents": {
            "pending_approvals": pending_approvals,
            "actions_last_30d": actions_30d,
            "done_last_30d": done_actions_30d,
            "execution_rate": round(done_actions_30d / max(actions_30d, 1) * 100, 1),
        },
        "suggestions": {
            "pending_validation": pending_suggestions,
        },
        "team": {
            "active_users": total_users,
        },
        "notifications": {
            "unread": unread_notifications,
        },
        "activity_7d": {
            "new_opportunities": new_opps_7d,
            "new_tenders": new_tenders_7d,
            "new_deliverables": new_deliverables_7d,
        },
    }


@router.get("/performance")
def performance_metrics(db: Session = Depends(get_db)):
    """
    Métriques de performance et statistiques d'utilisation de la plateforme.
    Utile pour la page de monitoring et les rapports SaaS.
    """
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func

    from app.models.agent import AgentAction, AgentAssignment, AgentProfile
    from app.models.deliverable import Deliverable
    from app.models.notification import Notification
    from app.models.organization import Organization
    from app.models.tender import Tender
    from app.models.user import User

    now = datetime.now(timezone.utc)
    last_7d  = now - timedelta(days=7)
    last_30d = now - timedelta(days=30)
    last_90d = now - timedelta(days=90)

    def count(model, since=None, status=None, status_field="status"):
        q = db.query(model)
        if since:
            q = q.filter(model.created_at >= since)
        if status:
            q = q.filter(getattr(model, status_field) == status)
        return q.count()

    # ── Growth metrics ────────────────────────────────────────────────────────
    orgs_total   = count(Organization)
    orgs_30d     = count(Organization, since=last_30d)
    tenders_total = count(Tender)
    deliv_total  = count(Deliverable)
    deliv_approved = count(Deliverable, status="approved")
    agents_total = count(AgentProfile)
    actions_total = count(AgentAction)
    actions_30d  = count(AgentAction, since=last_30d)
    actions_done = count(AgentAction, status="done")

    # ── Conversion funnel ─────────────────────────────────────────────────────
    tender_submitted = count(Tender, status="submitted")
    tender_go        = db.query(Tender).filter(Tender.go_no_go_decision == "go").count()
    deliv_approved_30d = count(Deliverable, since=last_30d, status="approved")

    # ── Team activity ─────────────────────────────────────────────────────────
    active_users = count(User)
    notifs_unread = db.query(Notification).filter(Notification.is_read == False).count()  # noqa

    # ── Weekly trend (last 4 weeks) ───────────────────────────────────────────
    weekly_tenders = []
    for week in range(4, 0, -1):
        wstart = now - timedelta(weeks=week)
        wend   = now - timedelta(weeks=week - 1)
        wcount = db.query(Tender).filter(
            Tender.created_at >= wstart,
            Tender.created_at < wend,
        ).count()
        weekly_tenders.append({
            "week": f"S-{week}",
            "tenders": wcount,
        })

    return {
        "generated_at": now.isoformat(),
        "growth": {
            "organizations_total": orgs_total,
            "organizations_last_30d": orgs_30d,
            "tenders_total": tenders_total,
            "deliverables_total": deliv_total,
            "deliverables_approved": deliv_approved,
            "approval_rate_pct": round(deliv_approved / max(deliv_total, 1) * 100, 1),
        },
        "agents": {
            "profiles_total": agents_total,
            "actions_total": actions_total,
            "actions_last_30d": actions_30d,
            "actions_done": actions_done,
            "execution_rate_pct": round(actions_done / max(actions_total, 1) * 100, 1),
        },
        "funnel": {
            "tenders_submitted": tender_submitted,
            "tenders_go_decision": tender_go,
            "go_rate_pct": round(tender_go / max(tenders_total, 1) * 100, 1),
            "deliverables_approved_30d": deliv_approved_30d,
        },
        "team": {
            "active_users": active_users,
            "unread_notifications": notifs_unread,
        },
        "trend": {
            "weekly_tenders": weekly_tenders,
        },
    }
