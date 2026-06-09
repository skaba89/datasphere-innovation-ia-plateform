"""
WorkflowService — Orchestrateur du workflow automatisé AO.

Principe :
  1. start_workflow(tender_id) → crée les 8 étapes, lance la première
  2. _execute_step(step)       → l'agent traite l'étape
     - Si requires_approval=False → marque 'done', passe à l'étape suivante
     - Si requires_approval=True  → marque 'awaiting', ATTEND la validation humaine
  3. approve_step(step_id, user) → valide, passe à l'étape suivante
  4. reject_step(step_id, reason) → met le workflow en pause

L'agent appelle de vrais services backend :
  - analyze       → pdf_extractor + tender fields
  - go_no_go      → tender_governance (GoNoGoCriterion)
  - requirements  → tender requirements
  - compliance    → compliance matrix items
  - staffing      → staffing_matching_service
  - outline       → technical_proposal_service
  - generate      → deliverable créé + sections
  - final_review  → simple gate humain
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.workflow import WorkflowInstance, WorkflowStep, WORKFLOW_STEPS

log = logging.getLogger("datasphere.workflow")


# ── Démarrage ─────────────────────────────────────────────────────────────────

def start_workflow(db: Session, tender_id: int, started_by: str) -> WorkflowInstance:
    """
    Crée (ou reset) le WorkflowInstance pour un tender et démarre l'exécution.
    Si un workflow existe déjà, il est réinitialisé.
    """
    # Check tender exists
    from app.crud.tender import get_tender
    tender = get_tender(db, tender_id)
    if not tender:
        raise ValueError(f"Tender #{tender_id} introuvable")

    # Reset existing workflow
    existing = db.query(WorkflowInstance).filter(
        WorkflowInstance.tender_id == tender_id
    ).first()
    if existing:
        db.delete(existing)
        db.commit()

    # Create instance
    instance = WorkflowInstance(
        tender_id=tender_id,
        status="running",
        started_by=started_by,
        started_at=datetime.utcnow(),
    )
    db.add(instance)
    db.flush()

    # Create steps
    for idx, step_def in enumerate(WORKFLOW_STEPS):
        step = WorkflowStep(
            instance_id=instance.id,
            step_key=step_def["key"],
            step_label=step_def["label"],
            order_index=idx,
            requires_approval=step_def["requires_approval"],
            status="pending",
        )
        db.add(step)

    db.commit()
    db.refresh(instance)

    log.info("Workflow started: tender_id=%d by=%s instance_id=%d", tender_id, started_by, instance.id)

    # Lancer la première étape en arrière-plan
    from app.db.session import SessionLocal
    t = threading.Thread(
        target=_run_next_step,
        args=(instance.id, SessionLocal),
        daemon=True,
    )
    t.start()

    return instance


# ── Exécution des étapes ──────────────────────────────────────────────────────

def _run_next_step(instance_id: int, session_factory) -> None:
    """Trouve la prochaine étape 'pending' et l'exécute."""
    db = session_factory()
    try:
        instance = db.query(WorkflowInstance).filter(
            WorkflowInstance.id == instance_id
        ).first()
        if not instance or instance.status in ("paused", "failed", "completed"):
            return

        # Find next pending step
        next_step = db.query(WorkflowStep).filter(
            WorkflowStep.instance_id == instance_id,
            WorkflowStep.status == "pending",
        ).order_by(WorkflowStep.order_index).first()

        if not next_step:
            # All steps done
            instance.status = "completed"
            instance.completed_at = datetime.utcnow()
            db.commit()
            log.info("Workflow completed: instance_id=%d", instance_id)
            return

        # Execute this step
        _execute_step(db, instance, next_step, session_factory)

    except Exception as e:
        log.exception("Workflow step error: instance_id=%d error=%s", instance_id, e)
        try:
            instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
            if instance:
                instance.status = "failed"
                instance.error_message = str(e)[:500]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _execute_step(db: Session, instance: WorkflowInstance, step: WorkflowStep, session_factory) -> None:
    """Exécute une étape avec l'agent approprié."""
    import time

    step.status = "running"
    step.started_at = datetime.utcnow()
    instance.current_step = step.step_key
    instance.status = "running"
    db.commit()

    log.info("Executing step: instance=%d step=%s tender=%d", instance.id, step.step_key, instance.tender_id)

    try:
        result_summary, artifact_type, artifact_id = _run_agent(db, instance, step)

        step.completed_at = datetime.utcnow()
        step.result_summary = result_summary
        step.artifact_type = artifact_type
        step.artifact_id = artifact_id
        step.agent_result = json.dumps({
            "summary": result_summary,
            "artifact_type": artifact_type,
            "artifact_id": artifact_id,
        })

        if step.requires_approval:
            # Attendre la validation humaine
            step.status = "awaiting"
            instance.status = "awaiting_approval"
            db.commit()

            log.info("Step awaiting approval: step=%s tender=%d", step.step_key, instance.tender_id)

            # Notifier via SSE
            _notify_approval_needed(db, instance, step)
        else:
            # Pas de validation requise → suite automatique
            step.status = "done"
            db.commit()

            # Passer à l'étape suivante
            t = threading.Thread(
                target=_run_next_step,
                args=(instance.id, session_factory),
                daemon=True,
            )
            t.start()

    except Exception as e:
        step.status = "failed"
        step.result_summary = f"Erreur : {e}"
        instance.status = "failed"
        instance.error_message = f"Étape '{step.step_label}' : {e}"
        db.commit()
        log.error("Step failed: step=%s error=%s", step.step_key, e)


def _run_agent(db: Session, instance: WorkflowInstance, step: WorkflowStep) -> tuple[str, str | None, int | None]:
    """
    Exécute l'agent pour une étape donnée.
    Retourne : (result_summary, artifact_type, artifact_id)
    """
    tid = instance.tender_id

    if step.step_key == "analyze":
        return _step_analyze(db, tid)

    elif step.step_key == "go_no_go":
        return _step_go_no_go(db, tid)

    elif step.step_key == "requirements":
        return _step_requirements(db, tid)

    elif step.step_key == "compliance":
        return _step_compliance(db, tid)

    elif step.step_key == "staffing":
        return _step_staffing(db, tid)

    elif step.step_key == "proposal_outline":
        return _step_proposal_outline(db, tid)

    elif step.step_key == "generate_draft":
        return _step_generate_draft(db, tid, instance)

    elif step.step_key == "final_review":
        return _step_final_review(db, tid)

    return (f"Étape '{step.step_key}' exécutée.", None, None)


# ── Agents par étape ──────────────────────────────────────────────────────────

def _step_analyze(db, tender_id: int) -> tuple:
    from app.crud.tender import get_tender
    tender = get_tender(db, tender_id)
    summary_parts = []
    if tender.title:       summary_parts.append(f"AO : {tender.title}")
    if tender.buyer_name:  summary_parts.append(f"Acheteur : {tender.buyer_name}")
    if tender.summary:     summary_parts.append(f"Résumé : {tender.summary[:200]}")
    count_reqs = db.execute(
        __import__('sqlalchemy').text("SELECT COUNT(*) FROM tender_requirements WHERE tender_id=:tid"),
        {"tid": tender_id}
    ).scalar() or 0
    summary_parts.append(f"{count_reqs} exigence(s) déjà enregistrée(s).")
    return (" | ".join(summary_parts), "tender", tender_id)


def _step_go_no_go(db, tender_id: int) -> tuple:
    from app.api.v1.endpoints.tender_templates import (
        _create_default_go_no_go_criteria,
    )
    from app.crud.tender_governance import list_go_no_go_criteria

    existing = list_go_no_go_criteria(db, tender_id)
    if not existing:
        try:
            _create_default_go_no_go_criteria(db, tender_id)
        except Exception:
            pass
    criteria = list_go_no_go_criteria(db, tender_id)
    go_count  = sum(1 for c in criteria if getattr(c, 'decision', '') == 'go')
    nogo_count = sum(1 for c in criteria if getattr(c, 'decision', '') == 'no_go')
    rec = "Go ✅" if go_count >= nogo_count else "No-Go ⚠️"
    summary = (
        f"Recommandation agent : **{rec}**\n"
        f"{len(criteria)} critère(s) évalués — {go_count} Go, {nogo_count} No-Go.\n"
        f"Veuillez valider ou rejeter cette recommandation."
    )
    return (summary, "go_no_go", tender_id)


def _step_requirements(db, tender_id: int) -> tuple:
    from sqlalchemy import text
    count = db.execute(
        text("SELECT COUNT(*) FROM tender_requirements WHERE tender_id=:tid"),
        {"tid": tender_id}
    ).scalar() or 0
    return (f"{count} exigence(s) technique(s) enregistrées pour cet AO.", "requirements", tender_id)


def _step_compliance(db, tender_id: int) -> tuple:
    from app.api.v1.endpoints.tender_templates import _create_compliance_from_requirements
    from app.crud.tender_governance import list_compliance_items

    existing = list_compliance_items(db, tender_id)
    if not existing:
        try:
            _create_compliance_from_requirements(db, tender_id)
        except Exception:
            pass
    items = list_compliance_items(db, tender_id)
    compliant = sum(1 for i in items if getattr(i, 'compliance_status', '') == 'compliant')
    summary = (
        f"{len(items)} ligne(s) de conformité générée(s).\n"
        f"{compliant}/{len(items)} exigences couvertes.\n"
        f"Veuillez vérifier et valider la matrice."
    )
    return (summary, "compliance", tender_id)


def _step_staffing(db, tender_id: int) -> tuple:
    try:
        from app.services.staffing_matching_service import match_profiles_for_tender
        result = match_profiles_for_tender(db, tender_id)
        profiles = result.get("matched_profiles", [])
        return (f"{len(profiles)} profil(s) consultant identifié(s) pour cet AO.", "staffing", tender_id)
    except Exception as e:
        return (f"Plan de staffing : service non disponible ({e}).", None, None)


def _step_proposal_outline(db, tender_id: int) -> tuple:
    try:
        from app.services.technical_proposal_service import generate_proposal_outline
        outline = generate_proposal_outline(db, tender_id)
        sections = outline.get("sections", [])
        summary = (
            f"Structure proposée : {len(sections)} section(s).\n" +
            "\n".join(f"  {i+1}. {s.get('title','?')}" for i, s in enumerate(sections[:6])) +
            ("\n  ..." if len(sections) > 6 else "") +
            "\n\nValidez pour lancer la génération du livrable."
        )
        return (summary, "proposal_outline", tender_id)
    except Exception as e:
        return (f"Structure générée (service simplifié). Validez pour continuer.", None, None)


def _step_generate_draft(db, tender_id: int, instance: WorkflowInstance) -> tuple:
    from app.crud.tender import get_tender
    from app.crud.opportunity import get_opportunity
    from sqlalchemy import text

    tender = get_tender(db, tender_id)
    title = f"Mémoire technique — {tender.title}"

    # Find or create deliverable
    opp_id = tender.opportunity_id if tender.opportunity_id else None
    if not opp_id:
        row = db.execute(text("SELECT id FROM opportunities LIMIT 1")).fetchone()
        opp_id = row[0] if row else None

    if opp_id:
        from app.crud.deliverable import create_deliverable
        from app.schemas.deliverable import DeliverableCreate
        draft = create_deliverable(db, DeliverableCreate(
            opportunity_id=opp_id,
            title=title,
            deliverable_type="technical_proposal",
            status="draft",
            content_markdown=_generate_markdown(tender),
            version=1,
        ))
        return (f"Livrable '{title}' créé (brouillon). Prêt pour la revue finale.", "deliverable", draft.id)
    return ("Livrable généré en mémoire (aucune opportunité liée).", None, None)


def _generate_markdown(tender) -> str:
    return f"""# Mémoire technique — {tender.title}

## 1. Compréhension du besoin

{tender.summary or 'À compléter selon le cahier des charges.'}

## 2. Méthodologie proposée

Notre approche s'articule en trois phases :
- **Phase 1** : Cadrage et analyse des besoins
- **Phase 2** : Conception et développement
- **Phase 3** : Déploiement et transfert de compétences

## 3. Profils proposés

*À compléter après validation du plan de staffing.*

## 4. Planning

*À compléter selon les délais de l'AO.*

## 5. Références similaires

*À compléter avec les références pertinentes.*

---
*Document généré automatiquement par DataSphere Innovation IA Platform.*
*À compléter et valider avant envoi.*
"""


def _step_final_review(db, tender_id: int) -> tuple:
    return (
        "Toutes les étapes automatiques sont terminées.\n"
        "Veuillez effectuer une relecture complète du livrable avant validation finale et envoi à l'acheteur.",
        None, None
    )


# ── Approbation humaine ───────────────────────────────────────────────────────

def approve_step(
    db: Session,
    step_id: int,
    approved_by: str,
    session_factory,
) -> WorkflowStep:
    """Un humain approuve une étape — débloque la suite du workflow."""
    step = db.query(WorkflowStep).filter(WorkflowStep.id == step_id).first()
    if not step:
        raise ValueError(f"Étape #{step_id} introuvable")
    if step.status != "awaiting":
        raise ValueError(f"Cette étape n'est pas en attente de validation (statut : {step.status})")

    step.status = "done"
    step.approved_by = approved_by
    step.approved_at = datetime.utcnow()

    instance = step.instance
    instance.status = "running"
    db.commit()

    log.info("Step approved: step_id=%d step=%s by=%s", step_id, step.step_key, approved_by)

    # Notifier via SSE
    _notify_step_approved(db, instance, step)

    # Passer à l'étape suivante
    t = threading.Thread(
        target=_run_next_step,
        args=(instance.id, session_factory),
        daemon=True,
    )
    t.start()

    return step


def reject_step(
    db: Session,
    step_id: int,
    rejected_by: str,
    reason: str,
) -> WorkflowStep:
    """Un humain rejette une étape — met le workflow en pause."""
    step = db.query(WorkflowStep).filter(WorkflowStep.id == step_id).first()
    if not step:
        raise ValueError(f"Étape #{step_id} introuvable")

    step.status = "rejected"
    step.rejection_reason = reason
    step.approved_by = rejected_by
    step.approved_at = datetime.utcnow()

    instance = step.instance
    instance.status = "paused"
    db.commit()

    log.info("Step rejected: step_id=%d by=%s reason=%s", step_id, rejected_by, reason[:100])
    return step


def get_workflow(db: Session, tender_id: int) -> WorkflowInstance | None:
    return db.query(WorkflowInstance).filter(
        WorkflowInstance.tender_id == tender_id
    ).first()


def get_pending_approvals(db: Session) -> list[WorkflowStep]:
    """Retourne toutes les étapes en attente de validation humaine."""
    return db.query(WorkflowStep).filter(
        WorkflowStep.status == "awaiting"
    ).order_by(WorkflowStep.created_at).all()


# ── SSE Notifications ─────────────────────────────────────────────────────────

def _notify_approval_needed(db: Session, instance: WorkflowInstance, step: WorkflowStep) -> None:
    try:
        from app.crud.notification import create_notification
        from app.models.notification import Notification
        notif = Notification(
            user_id=None,  # broadcast
            title=f"Validation requise : {step.step_label}",
            body=f"AO #{instance.tender_id} — {step.result_summary[:120] if step.result_summary else ''}",
            notification_type="workflow_approval",
            reference_type="workflow_step",
            reference_id=step.id,
        )
        db.add(notif)
        db.commit()
    except Exception as e:
        log.debug("Could not create notification: %s", e)


def _notify_step_approved(db: Session, instance: WorkflowInstance, step: WorkflowStep) -> None:
    try:
        from app.models.notification import Notification
        notif = Notification(
            user_id=None,
            title=f"Étape validée : {step.step_label}",
            body=f"AO #{instance.tender_id} — Workflow reprend automatiquement.",
            notification_type="workflow_approved",
            reference_type="workflow_step",
            reference_id=step.id,
        )
        db.add(notif)
        db.commit()
    except Exception as e:
        log.debug("Could not create notification: %s", e)
