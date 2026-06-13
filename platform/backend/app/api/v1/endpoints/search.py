"""
Global search — fulltext search across organizations, opportunities, tenders,
deliverables, contacts and agent actions in a single call.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_pagination, PaginationParams
from app.db.session import get_db
from app.models.agent import AgentAction
from app.models.contact import Contact
from app.models.deliverable import Deliverable
from app.models.opportunity import Opportunity
from app.models.organization import Organization
from app.models.tender import Tender

router = APIRouter(
    prefix="/search",
    tags=["search"],
    dependencies=[Depends(get_current_user)],
)


def _like(term: str) -> str:
    return f"%{term}%"


@router.get("")
def global_search(q: str, limit: int = 10, db: Session = Depends(get_db)):
    """
    Search across all entities. Returns grouped results by entity type.
    q: search term (min 2 chars)
    limit: max results per category (default 10, max 50)
    """
    if len(q.strip()) < 2:
        return {"query": q, "results": {}, "total": 0}

    limit = min(limit, 50)
    t = _like(q)
    results: dict[str, list] = {}
    total = 0

    # Organizations
    orgs = (
        db.query(Organization)
        .filter(
            or_(
                Organization.name.ilike(t),
                Organization.sector.ilike(t),
                Organization.country.ilike(t),
            )
        )
        .limit(limit)
        .all()
    )
    if orgs:
        results["organizations"] = [
            {
                "id": o.id,
                "type": "organization",
                "title": o.name,
                "subtitle": f"{o.sector or '?'} · {o.country or '?'}",
                "url_hint": f"/organizations/{o.id}",
            }
            for o in orgs
        ]
        total += len(orgs)

    # Opportunities
    opps = (
        db.query(Opportunity)
        .filter(
            or_(
                Opportunity.title.ilike(t),
                Opportunity.sector.ilike(t),
                Opportunity.notes.ilike(t),
                Opportunity.next_action.ilike(t),
            )
        )
        .limit(limit)
        .all()
    )
    if opps:
        results["opportunities"] = [
            {
                "id": o.id,
                "type": "opportunity",
                "title": o.title,
                "subtitle": f"{o.status} · {o.priority} · {o.probability}%",
                "url_hint": f"/opportunities/{o.id}",
            }
            for o in opps
        ]
        total += len(opps)

    # Tenders
    tenders = (
        db.query(Tender)
        .filter(
            or_(
                Tender.title.ilike(t),
                Tender.reference.ilike(t),
                Tender.buyer_name.ilike(t),
                Tender.summary.ilike(t),
            )
        )
        .limit(limit)
        .all()
    )
    if tenders:
        results["tenders"] = [
            {
                "id": td.id,
                "type": "tender",
                "title": td.title,
                "subtitle": f"{td.reference or 'N/A'} · {td.buyer_name or '?'} · {td.go_no_go_decision or 'Non qualifié'}",
                "url_hint": f"/tenders/{td.id}",
            }
            for td in tenders
        ]
        total += len(tenders)

    # Deliverables
    deliverables = (
        db.query(Deliverable)
        .filter(
            or_(
                Deliverable.title.ilike(t),
                Deliverable.summary.ilike(t),
                Deliverable.content_markdown.ilike(t),
                Deliverable.tags.ilike(t),
            )
        )
        .limit(limit)
        .all()
    )
    if deliverables:
        results["deliverables"] = [
            {
                "id": d.id,
                "type": "deliverable",
                "title": d.title,
                "subtitle": f"{d.deliverable_type} · {d.status} · v{d.version}",
                "url_hint": f"/deliverables/{d.id}",
            }
            for d in deliverables
        ]
        total += len(deliverables)

    # Contacts
    contacts = (
        db.query(Contact)
        .filter(
            or_(
                Contact.first_name.ilike(t),
                Contact.last_name.ilike(t),
                Contact.professional_email.ilike(t),
                Contact.job_title.ilike(t),
            )
        )
        .limit(limit)
        .all()
    )
    if contacts:
        results["contacts"] = [
            {
                "id": c.id,
                "type": "contact",
                "title": f"{c.first_name or ''} {c.last_name or ''}".strip() or c.professional_email or f"Contact #{c.id}",
                "subtitle": f"{c.job_title or '?'} · {c.professional_email or ''}",
                "url_hint": f"/contacts/{c.id}",
            }
            for c in contacts
        ]
        total += len(contacts)

    # Agent actions
    actions = (
        db.query(AgentAction)
        .filter(
            or_(
                AgentAction.title.ilike(t),
                AgentAction.description.ilike(t),
                AgentAction.result_summary.ilike(t),
            )
        )
        .limit(limit)
        .all()
    )
    if actions:
        results["actions"] = [
            {
                "id": a.id,
                "type": "agent_action",
                "title": a.title,
                "subtitle": f"{a.action_type} · {a.status}",
                "url_hint": f"/agent-actions/{a.id}",
            }
            for a in actions
        ]
        total += len(actions)

    return {
        "query": q,
        "total": total,
        "results": results,
    }
