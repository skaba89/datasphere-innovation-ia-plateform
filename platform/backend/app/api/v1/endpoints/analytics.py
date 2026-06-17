# ── Cache simple en mémoire (5 minutes TTL) ──────────────────────────────────
import time as _time
_CACHE: dict = {}
_CACHE_TTL = 300  # 5 minutes

def _get_cached(key: str):
    entry = _CACHE.get(key)
    if entry and _time.time() - entry["ts"] < _CACHE_TTL:
        return entry["data"]
    return None

def _set_cached(key: str, data):
    _CACHE[key] = {"data": data, "ts": _time.time()}

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
def pipeline_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Return comprehensive pipeline KPIs in a single call:
    opportunities, tenders, agents, deliverables, scheduler stats + notifications.
    """
    cached = _get_cached("pipeline")
    if cached: return cached
    result = get_pipeline_analytics(db)
    _set_cached("pipeline", result)
    return result


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
    Cached 60s in-memory.
    """
    cached = cache_get("analytics:dashboard_kpis")
    if cached is not None:
        return cached

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

    # ── Top AOs — deadlines urgentes (14j) ───────────────────────────────────
    top_tenders = []
    try:
        urgent = db.query(Tender).filter(
            Tender.validation_status == "validated",
            Tender.status.notin_(["submitted", "lost", "cancelled"]),
            Tender.go_no_go_decision != "no_go",
        ).order_by(Tender.submission_deadline.asc().nullslast()).limit(5).all()

        for t in urgent:
            days_left = None
            if t.submission_deadline:
                delta = (t.submission_deadline.replace(tzinfo=None) - now.replace(tzinfo=None)).days
                days_left = delta
            top_tenders.append({
                "id":              t.id,
                "title":           t.title[:60],
                "buyer_name":      t.buyer_name or "—",
                "status":          t.status,
                "go_no_go":        t.go_no_go_decision,
                "score":           t.go_no_go_score,
                "days_left":       days_left,
                "deadline":        t.submission_deadline.isoformat() if t.submission_deadline else None,
            })
    except Exception:
        pass

    # ── Livrables récents ────────────────────────────────────────────────────
    recent_deliverables = []
    try:
        recents = db.query(Deliverable).order_by(Deliverable.updated_at.desc()).limit(5).all()
        for d in recents:
            recent_deliverables.append({
                "id":     d.id,
                "title":  d.title[:55],
                "status": d.status,
                "type":   d.deliverable_type,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None,
                "tender_id": d.tender_id,
            })
    except Exception:
        pass

    # ── Provider actif ───────────────────────────────────────────────────────
    active_provider = "simulation"
    try:
        from app.services.llm_service import provider_label
        active_provider = provider_label()
    except Exception:
        pass


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


@router.get("/timeline")
def timeline_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Return monthly stats for the last 12 months — AOs, workflow completions,
    deliverables, taux de succès estimé.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func, text, extract
    from app.models.tender import Tender
    from app.models.workflow import WorkflowInstance
    from app.models.deliverable import Deliverable

    months = []
    now = datetime.utcnow()
    for i in range(11, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0)
        month_end   = (month_start + timedelta(days=32)).replace(day=1)
        label = month_start.strftime("%b %Y")

        ao_count = db.query(Tender).filter(
            Tender.created_at >= month_start,
            Tender.created_at < month_end,
        ).count()

        wf_done = db.query(WorkflowInstance).filter(
            WorkflowInstance.status == "completed",
            WorkflowInstance.completed_at >= month_start,
            WorkflowInstance.completed_at < month_end,
        ).count()

        deliverables = db.query(Deliverable).filter(
            Deliverable.created_at >= month_start,
            Deliverable.created_at < month_end,
        ).count()

        won = db.query(Tender).filter(
            Tender.status == "won",
            Tender.updated_at >= month_start,
            Tender.updated_at < month_end,
        ).count()

        months.append({
            "month":        label,
            "ao_detectes":  ao_count,
            "wf_completes": wf_done,
            "livrables":    deliverables,
            "gagnes":       won,
            "taux_succes":  round(won / ao_count * 100, 1) if ao_count > 0 else 0,
        })

    return {
        "months":  months,
        "totals": {
            "ao_detectes":  sum(m["ao_detectes"] for m in months),
            "wf_completes": sum(m["wf_completes"] for m in months),
            "livrables":    sum(m["livrables"] for m in months),
            "gagnes":       sum(m["gagnes"] for m in months),
        },
    }


@router.get("/performance-v2")
def performance_stats(db: Session = Depends(get_db)):
    """KPIs de performance : TJM moyen, délai moyen workflow, nb providers actifs."""
    from datetime import datetime, timedelta
    from app.models.workflow import WorkflowInstance, WorkflowStep
    from app.services.llm_service import list_providers

    # Avg workflow duration (completed ones)
    completed = db.query(WorkflowInstance).filter(
        WorkflowInstance.status == "completed",
        WorkflowInstance.completed_at.isnot(None),
    ).limit(50).all()

    durations = [
        (wf.completed_at - wf.started_at).total_seconds() / 60
        for wf in completed
        if wf.started_at and wf.completed_at
    ]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    # Providers configured
    providers = list_providers()
    active_providers = [p["name"] for p in providers if p["configured"]]

    return {
        "avg_workflow_minutes":  avg_duration,
        "workflows_completed":   len(completed),
        "active_providers":      active_providers,
        "active_providers_count": len(active_providers),
    }


@router.get("/tender/{tender_id}/score-breakdown")
def tender_score_breakdown(
    tender_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return detailed score breakdown for Go/No-Go decision.
    Criteria weights: domain_match 30%, technical_requirements 25%,
    timeline_feasibility 20%, budget_adequacy 15%, strategic_fit 10%
    """
    from app.models.tender import Tender
    from app.models.workflow import WorkflowInstance, WorkflowStep

    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    overall = tender.go_no_go_score or 0

    # Generate criteria scores from overall + text analysis
    title_lower = (tender.title or "").lower()
    summary_lower = (tender.summary or "").lower()
    text = f"{title_lower} {summary_lower}"

    # Keyword scoring
    data_kws = ["data", "snowflake", "dbt", "airflow", "spark", "bi", "analytics",
                "machine learning", "ia", "intelligence artificielle", "python", "sql",
                "informatique", "numérique", "cloud", "azure", "aws", "gcp"]
    data_matches = sum(1 for kw in data_kws if kw in text)
    domain_score = min(100, 60 + data_matches * 8)

    # Heuristics
    has_requirements = False
    technical_score  = min(100, domain_score - 5)
    timeline_score   = min(100, 75 + (10 if tender.submission_deadline else 0))
    budget_score     = min(100, 70 + (15 if getattr(tender, "estimated_budget", None) else 0))
    strategic_score  = min(100, 65 + (overall - 70) * 0.5 if overall > 70 else 65)

    if overall > 0:
        # Backfill from real score
        scale = overall / 80  # 80 is expected weighted avg
        domain_score   = min(100, int(domain_score * scale))
        technical_score = min(100, int(technical_score * scale))
        timeline_score  = min(100, int(timeline_score * scale))
        budget_score    = min(100, int(budget_score * scale))
        strategic_score = min(100, int(strategic_score * scale))

    criteria = [
        {"key": "domain_match",          "label": "Correspondance domaine data",  "weight": 30, "score": domain_score,    "color": "#3b82f6"},
        {"key": "technical_requirements", "label": "Exigences techniques",         "weight": 25, "score": technical_score, "color": "#8b5cf6"},
        {"key": "timeline_feasibility",   "label": "Faisabilité planning",         "weight": 20, "score": timeline_score,  "color": "#06b6d4"},
        {"key": "budget_adequacy",        "label": "Adéquation budget",            "weight": 15, "score": budget_score,    "color": "#10b981"},
        {"key": "strategic_fit",          "label": "Alignement stratégique",       "weight": 10, "score": strategic_score, "color": "#f59e0b"},
    ]

    weighted_avg = sum(c["score"] * c["weight"] / 100 for c in criteria)
    final_score  = overall or int(weighted_avg)

    return {
        "tender_id":   tender_id,
        "title":       tender.title,
        "decision":    tender.go_no_go_decision,
        "final_score": final_score,
        "criteria":    criteria,
        "recommendation": (
            "GO — Score excellent, mission parfaitement alignée"  if final_score >= 80 else
            "GO conditionnel — À évaluer avec l'équipe"           if final_score >= 65 else
            "À surveiller — Opportunité partielle"                if final_score >= 50 else
            "NO GO — Mission peu alignée avec le profil"
        ),
    }


@router.get("/tender/{tender_id}/win-probability")
def get_win_probability(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
) -> dict:
    """Calcule la probabilité de remporter cet AO."""
    from app.services.win_probability import compute_win_probability
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    result = compute_win_probability(
        title=tender.title or "",
        buyer_name=tender.buyer_name or "",
        summary=getattr(tender, 'summary', None) or "",
        go_no_go_score=tender.go_no_go_score,
        submission_deadline=getattr(tender, 'submission_deadline', None),
        estimated_budget=getattr(tender, 'estimated_budget', None),
        status=tender.status or "draft",
    )
    result["tender_id"] = tender_id
    return result


@router.get("/dashboard/win-stats")
def get_win_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
) -> dict:
    """Statistiques globales de probabilité de gain sur tous les AOs actifs."""
    from app.services.win_probability import compute_win_probability
    from app.models.tender import Tender as TenderModel
    tenders = db.query(TenderModel).filter(
        TenderModel.status.notin_(["no_go", "lost"])
    ).limit(50).all()

    results = []
    total_prob = 0
    for t in tenders:
        prob = compute_win_probability(
            title=t.title or "",
            buyer_name=t.buyer_name or "",
            summary=getattr(t, 'summary', None) or "",
            go_no_go_score=t.go_no_go_score,
        )
        results.append({"id": t.id, "title": t.title, "probability": prob["probability"]})
        total_prob += prob["probability"]

    high = [r for r in results if r["probability"] >= 65]
    medium = [r for r in results if 35 <= r["probability"] < 65]
    low = [r for r in results if r["probability"] < 35]

    return {
        "total_active": len(tenders),
        "average_probability": round(total_prob / max(len(tenders), 1)),
        "high_probability": len(high),
        "medium_probability": len(medium),
        "low_probability": len(low),
        "top_opportunities": sorted(results, key=lambda x: x["probability"], reverse=True)[:5],
    }

@router.get("/pipeline-forecast")
def pipeline_forecast(
    horizon: int = 90,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Prévision pipeline commercial sur horizon jours (30/60/90).
    Calcule le revenu prévisionnel pondéré par probabilité de succès.
    """
    from datetime import datetime, timedelta
    from app.models.opportunity import Opportunity
    from app.models.tender import Tender

    now = datetime.utcnow()
    cutoff = now + timedelta(days=horizon)

    # AOs avec deadline dans la fenêtre
    tenders = (
        db.query(Tender)
        .filter(
            Tender.submission_deadline >= now,
            Tender.submission_deadline <= cutoff,
        )
        .all()
    )

    # Opportunités actives
    opps = (
        db.query(Opportunity)
        .filter(
            Opportunity.status.notin_(["Perdu", "Annulé"]),
            Opportunity.next_action_date >= now,
            Opportunity.next_action_date <= cutoff,
        )
        .all()
    )

    # Construire la timeline par semaine
    weeks = []
    for w in range(int(horizon / 7) + 1):
        week_start = now + timedelta(weeks=w)
        week_end   = week_start + timedelta(weeks=1)

        week_tenders = [t for t in tenders
                        if t.submission_deadline and week_start <= t.submission_deadline < week_end]
        week_opps    = [o for o in opps
                        if o.next_action_date and week_start <= o.next_action_date < week_end]

        weighted_value = sum(
            float(o.potential_value or 0) * (o.probability or 20) / 100
            for o in week_opps
        )

        weeks.append({
            "week": w + 1,
            "start": week_start.isoformat(),
            "end":   week_end.isoformat(),
            "tenders_deadline": len(week_tenders),
            "opportunities":    len(week_opps),
            "weighted_value":   round(weighted_value, 2),
            "tender_titles":    [t.title[:60] for t in week_tenders[:3]],
        })

    # Totaux
    total_weighted = sum(w["weighted_value"] for w in weeks)
    total_pipeline = sum(float(o.potential_value or 0) for o in opps)
    avg_probability = (
        sum(o.probability or 20 for o in opps) / len(opps) if opps else 0
    )

    # Répartition par statut
    status_breakdown = {}
    for o in opps:
        s = o.status or "Inconnu"
        if s not in status_breakdown:
            status_breakdown[s] = {"count": 0, "value": 0}
        status_breakdown[s]["count"] += 1
        status_breakdown[s]["value"] += float(o.potential_value or 0)

    return {
        "horizon_days":      horizon,
        "total_opportunities": len(opps),
        "total_tenders_due": len(tenders),
        "total_pipeline":    round(total_pipeline, 2),
        "weighted_forecast": round(total_weighted, 2),
        "avg_probability":   round(avg_probability, 1),
        "status_breakdown":  status_breakdown,
        "weekly_timeline":   weeks,
    }


@router.get("/win-rate-by-sector")
def win_rate_by_sector(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Win rate par secteur — benchmark interne."""
    from app.models.tender import Tender
    from sqlalchemy import func

    rows = (
        db.query(
            Tender.status,
            func.count(Tender.id).label("count"),
            func.avg(Tender.go_no_go_score).label("avg_score"),
        )
        .filter(Tender.go_no_go_score.isnot(None))
        .group_by(Tender.status)
        .all()
    )

    return [
        {"status": r.status, "count": r.count, "avg_score": round(float(r.avg_score or 0), 1)}
        for r in rows
    ]
