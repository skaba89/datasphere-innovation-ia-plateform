"""Tests for workflow_service — critical path coverage."""
import pytest
from datetime import datetime
from unittest.mock import patch

from app.db.session import SessionLocal
from app.models.tender import Tender
from app.models.opportunity import Opportunity
from app.models.organization import Organization


def make_tender(db):
    """Create a minimal tender for testing."""
    org = Organization(name="Test Org", source="manual",
                       created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(org); db.flush()
    opp = Opportunity(organization_id=org.id, title="Opp", status="open", source="manual",
                      created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(opp); db.flush()
    t = Tender(
        opportunity_id=opp.id, title="Audit Plateforme Data Nationale",
        buyer_name="ARTP", summary="Audit QoS", status="draft", source="manual",
        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
    )
    db.add(t); db.flush()
    db.commit()
    return t


# ── _tender_context ───────────────────────────────────────────────────────────

def test_tender_context_uses_submission_deadline(reset_database):
    from app.services.workflow_service import _tender_context
    db = SessionLocal()
    try:
        t = make_tender(db)
        t.submission_deadline = datetime(2026, 7, 30)
        ctx = _tender_context(t)
        assert "Date limite" in ctx
        assert "deadline" not in ctx  # old wrong field name
    finally:
        db.close()


def test_tender_context_minimal(reset_database):
    from app.services.workflow_service import _tender_context
    t = Tender(title=None, buyer_name=None, status="draft",
               created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    ctx = _tender_context(t)
    assert ctx == "Appel d'offres sans détail"


# ── Individual step functions ─────────────────────────────────────────────────

@patch("app.services.workflow_service._llm", return_value="Analyse LLM simulée pour tests")
def test_step_analyze(mock_llm, reset_database):
    from app.services.workflow_service import _step_analyze
    db = SessionLocal()
    try:
        t = make_tender(db)
        summary, atype, aid = _step_analyze(db, t.id)
        assert len(summary) > 0
        assert atype == "tender"
    finally:
        db.close()


@patch("app.services.workflow_service._llm", return_value="GO ✅ — Forte adéquation technique")
def test_step_go_no_go(mock_llm, reset_database):
    from app.services.workflow_service import _step_go_no_go
    db = SessionLocal()
    try:
        t = make_tender(db)
        summary, atype, aid = _step_go_no_go(db, t.id)
        assert len(summary) > 0
        assert atype == "go_no_go"
    finally:
        db.close()


@patch("app.services.workflow_service._llm", return_value="- Exigence : maîtrise Python\n- Exigence admin : Kbis")
def test_step_requirements(mock_llm, reset_database):
    from app.services.workflow_service import _step_requirements
    db = SessionLocal()
    try:
        t = make_tender(db)
        summary, atype, aid = _step_requirements(db, t.id)
        assert len(summary) > 0
        assert atype == "requirements"
    finally:
        db.close()


@patch("app.services.workflow_service._llm", return_value="CONFORME — Snowflake maîtrisé")
def test_step_compliance(mock_llm, reset_database):
    from app.services.workflow_service import _step_compliance
    db = SessionLocal()
    try:
        t = make_tender(db)
        summary, atype, aid = _step_compliance(db, t.id)
        assert len(summary) > 0
        assert atype == "compliance"
    finally:
        db.close()


def test_step_final_review(reset_database):
    from app.services.workflow_service import _step_final_review
    db = SessionLocal()
    try:
        t = make_tender(db)
        summary, atype, aid = _step_final_review(db, t.id)
        assert len(summary) > 20
        assert atype is None
    finally:
        db.close()


# ── start_workflow ────────────────────────────────────────────────────────────

@patch("threading.Thread")
def test_start_workflow_creates_8_steps(mock_thread, reset_database):
    from app.services.workflow_service import start_workflow
    from app.models.workflow import WorkflowStep
    db = SessionLocal()
    try:
        t = make_tender(db)
        instance = start_workflow(db, t.id, "admin@test.fr")
        steps = db.query(WorkflowStep).filter(WorkflowStep.instance_id == instance.id).all()
        assert len(steps) == 8
        keys = [s.step_key for s in sorted(steps, key=lambda s: s.order_index)]
        assert "analyze" in keys
        assert "final_review" in keys
    finally:
        db.close()


@patch("threading.Thread")
def test_start_workflow_resets_existing(mock_thread, reset_database):
    from app.services.workflow_service import start_workflow
    from app.models.workflow import WorkflowInstance
    db = SessionLocal()
    try:
        t = make_tender(db)
        start_workflow(db, t.id, "admin@test.fr")
        start_workflow(db, t.id, "admin@test.fr")
        count = db.query(WorkflowInstance).filter(WorkflowInstance.tender_id == t.id).count()
        assert count == 1
    finally:
        db.close()


# ── get_workflow ──────────────────────────────────────────────────────────────

@patch("threading.Thread")
def test_get_workflow(mock_thread, reset_database):
    from app.services.workflow_service import start_workflow, get_workflow
    db = SessionLocal()
    try:
        t = make_tender(db)
        start_workflow(db, t.id, "admin@test.fr")
        wf = get_workflow(db, t.id)
        assert wf is not None
        assert wf.tender_id == t.id
    finally:
        db.close()


def test_get_workflow_not_found(reset_database):
    from app.services.workflow_service import get_workflow
    db = SessionLocal()
    try:
        assert get_workflow(db, 99999) is None
    finally:
        db.close()
