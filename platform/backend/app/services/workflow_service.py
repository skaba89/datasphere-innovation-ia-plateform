"""
WorkflowService — Orchestrateur du workflow automatisé AO avec vrais agents LLM.

8 étapes :
  1. analyze          → LLM analyse le document AO
  2. go_no_go         → LLM recommande Go/No-Go          [VALIDATION HUMAINE]
  3. requirements     → LLM extrait les exigences
  4. compliance       → LLM génère la matrice            [VALIDATION HUMAINE]
  5. staffing         → LLM identifie les profils
  6. proposal_outline → LLM structure la proposition     [VALIDATION HUMAINE]
  7. generate_draft   → LLM rédige le mémoire complet
  8. final_review     → Gate humain avant envoi          [VALIDATION HUMAINE]
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
    from app.crud.tender import get_tender
    tender = get_tender(db, tender_id)
    if not tender:
        raise ValueError(f"Tender #{tender_id} introuvable")

    existing = db.query(WorkflowInstance).filter(WorkflowInstance.tender_id == tender_id).first()
    if existing:
        db.delete(existing)
        db.commit()

    instance = WorkflowInstance(
        tender_id=tender_id, status="running",
        started_by=started_by, started_at=datetime.utcnow(),
    )
    db.add(instance)
    db.flush()

    for idx, step_def in enumerate(WORKFLOW_STEPS):
        step = WorkflowStep(
            instance_id=instance.id,
            step_key=step_def["key"], step_label=step_def["label"],
            order_index=idx, requires_approval=step_def["requires_approval"],
            status="pending",
        )
        db.add(step)

    db.commit()
    db.refresh(instance)
    log.info("Workflow started: tender=%d by=%s", tender_id, started_by)

    from app.db.session import SessionLocal
    threading.Thread(target=_run_next_step, args=(instance.id, SessionLocal), daemon=True).start()
    return instance


# ── Exécution des étapes ──────────────────────────────────────────────────────

def _run_next_step(instance_id: int, session_factory) -> None:
    db = session_factory()
    try:
        instance = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
        if not instance or instance.status in ("paused", "failed", "completed"):
            return

        next_step = db.query(WorkflowStep).filter(
            WorkflowStep.instance_id == instance_id,
            WorkflowStep.status == "pending",
        ).order_by(WorkflowStep.order_index).first()

        if not next_step:
            instance.status = "completed"
            instance.completed_at = datetime.utcnow()
            db.commit()
            log.info("Workflow completed: instance=%d tender=%d", instance_id, instance.tender_id)
            return

        _execute_step(db, instance, next_step, session_factory)
    except Exception as e:
        log.exception("Workflow error instance=%d: %s", instance_id, e)
        try:
            inst = db.query(WorkflowInstance).filter(WorkflowInstance.id == instance_id).first()
            if inst:
                inst.status = "failed"
                inst.error_message = str(e)[:500]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _execute_step(db: Session, instance: WorkflowInstance,
                  step: WorkflowStep, session_factory) -> None:
    step.status = "running"
    step.started_at = datetime.utcnow()
    instance.current_step = step.step_key
    instance.status = "running"
    db.commit()

    log.info("Executing step: %s tender=%d", step.step_key, instance.tender_id)

    try:
        summary, artifact_type, artifact_id = _run_agent(db, instance, step)

        step.completed_at = datetime.utcnow()
        step.result_summary = summary
        step.artifact_type = artifact_type
        step.artifact_id = artifact_id
        step.agent_result = json.dumps({"summary": summary, "artifact_type": artifact_type})

        if step.requires_approval:
            step.status = "awaiting"
            instance.status = "awaiting_approval"
            db.commit()
            log.info("Step awaiting approval: %s tender=%d", step.step_key, instance.tender_id)
            _notify_approval_needed(db, instance, step)
        else:
            step.status = "done"
            db.commit()
            threading.Thread(target=_run_next_step, args=(instance.id, session_factory), daemon=True).start()

    except Exception as e:
        step.status = "failed"
        step.result_summary = f"Erreur agent : {e}"
        instance.status = "failed"
        instance.error_message = f"Étape '{step.step_label}' : {str(e)[:300]}"
        db.commit()
        log.error("Step failed: %s — %s", step.step_key, e)


# ── Agents LLM par étape ──────────────────────────────────────────────────────

def _llm(prompt: str, system: str, action_type: str) -> str:
    """Appel LLM avec fallback simulation."""
    from app.services.llm_service import complete
    result, _ = complete(prompt=prompt, system=system, action_type=action_type)
    return result


def _run_agent(db, instance, step) -> tuple[str, str | None, int | None]:
    tid = instance.tender_id
    key = step.step_key
    if key == "analyze":          return _step_analyze(db, tid)
    if key == "go_no_go":         return _step_go_no_go(db, tid)
    if key == "requirements":     return _step_requirements(db, tid)
    if key == "compliance":       return _step_compliance(db, tid)
    if key == "staffing":         return _step_staffing(db, tid)
    if key == "proposal_outline": return _step_proposal_outline(db, tid)
    if key == "generate_draft":   return _step_generate_draft(db, tid, instance)
    if key == "final_review":     return _step_final_review(db, tid)
    return (f"Étape '{key}' exécutée.", None, None)


def _tender_context(tender) -> str:
    """Résumé structuré de l'AO pour les prompts LLM."""
    parts = []
    if tender.title:                parts.append(f"Titre : {tender.title}")
    if tender.buyer_name:           parts.append(f"Acheteur : {tender.buyer_name}")
    if tender.reference:            parts.append(f"Référence : {tender.reference}")
    if tender.submission_deadline:  parts.append(f"Date limite : {tender.submission_deadline}")
    if tender.source_url:           parts.append(f"Source : {tender.source_url}")
    if tender.summary:              parts.append(f"Résumé :\n{tender.summary[:1200]}")
    if tender.ai_notes:             parts.append(f"Notes IA : {tender.ai_notes[:400]}")
    return "\n".join(parts) if parts else "Appel d'offres sans détail"


# ── Étape 1 : Analyse ─────────────────────────────────────────────────────────

def _step_analyze(db, tender_id: int) -> tuple:
    from app.crud.tender import get_tender
    tender = get_tender(db, tender_id)

    ctx = _tender_context(tender)
    result = _llm(
        prompt=f"""Analyse cet appel d'offres et extrais les informations clés :

{ctx}

Fournis une analyse structurée avec :
1. Objet précis du marché
2. Profil de l'acheteur
3. Contraintes principales (délai, budget, exigences)
4. Points d'attention critiques
5. Adéquation avec un cabinet de conseil Data/IA
""",
        system="Tu es un expert en réponse aux appels d'offres pour un cabinet de conseil Data & IA. Sois précis, concis et actionnable.",
        action_type="context_analysis",
    )

    # Update tender summary if empty
    if tender and not tender.summary and result:
        tender.summary = result[:500]
        db.commit()

    return (result, "tender", tender_id)


# ── Étape 2 : Go / No-Go ─────────────────────────────────────────────────────

def _step_go_no_go(db, tender_id: int) -> tuple:
    from app.crud.tender import get_tender
    from app.crud.tender_governance import list_go_no_go_criteria
    tender = get_tender(db, tender_id)
    ctx = _tender_context(tender)

    result = _llm(
        prompt=f"""Évalue cet appel d'offres et recommande Go ou No-Go pour un cabinet de conseil Data/IA senior :

{ctx}

Analyse selon ces 6 critères :
1. Adéquation technique (Data Engineering, IA, Cloud)
2. Budget estimé vs TJM marché (600-900 €/j senior)
3. Probabilité de gain (1 à 5)
4. Charge de réponse vs bénéfice attendu
5. Risques contractuels
6. Alignement stratégique

Conclusion claire : GO ✅ ou NO-GO ❌ avec justification en 3 lignes.
""",
        system="Tu es directeur associé d'un cabinet de conseil Data & IA spécialisé dans les marchés publics et privés en France et Afrique.",
        action_type="go_no_go_recommendation",
    )

    # Create Go/No-Go criteria in DB
    try:
        from app.api.v1.endpoints.tender_templates import _create_default_go_no_go_criteria
        from app.crud.tender_governance import list_go_no_go_criteria
        if not list_go_no_go_criteria(db, tender_id):
            _create_default_go_no_go_criteria(db, tender_id)
    except Exception as e:
        log.debug("Could not create go_no_go criteria: %s", e)

    # Auto-update tender decision based on LLM result
    if tender and ("GO ✅" in result or "GO :" in result.upper() or result.upper().startswith("GO")):
        if tender.status == "draft":
            tender.status = "go"
            db.commit()

    return (result, "go_no_go", tender_id)


# ── Étape 3 : Exigences ───────────────────────────────────────────────────────

def _step_requirements(db, tender_id: int) -> tuple:
    from app.crud.tender import get_tender
    from sqlalchemy import text
    tender = get_tender(db, tender_id)
    ctx = _tender_context(tender)

    result = _llm(
        prompt=f"""Extrais toutes les exigences techniques et administratives de cet AO :

{ctx}

Classe les exigences en :
- OBLIGATOIRES (éliminatoires si non remplies)
- IMPORTANTES (notées fortement)
- OPTIONNELLES (bonus)

Pour chaque exigence précise :
- Intitulé exact
- Catégorie (Technique / Fonctionnel / Administratif / Financier)
- Niveau de criticité
- Notre capacité à y répondre (OUI/PARTIEL/NON)
""",
        system="Tu es expert en qualification d'appels d'offres IT et Data pour marchés publics français.",
        action_type="tender_requirements_review",
    )

    # Parse and save requirements
    count = db.execute(text("SELECT COUNT(*) FROM tender_requirements WHERE tender_id=:tid"), {"tid": tender_id}).scalar() or 0
    if count == 0:
        _save_requirements_from_llm(db, tender_id, result)
        count = db.execute(text("SELECT COUNT(*) FROM tender_requirements WHERE tender_id=:tid"), {"tid": tender_id}).scalar() or 0

    return (f"{count} exigence(s) identifiée(s) et enregistrée(s).\n\n{result[:600]}", "requirements", tender_id)


def _save_requirements_from_llm(db: Session, tender_id: int, llm_text: str) -> None:
    """Parse LLM output and create TenderRequirement rows."""
    try:
        from app.crud.tender import create_tender_requirement
        from app.schemas.tender import TenderRequirementCreate

        lines = [l.strip() for l in llm_text.split("\n") if l.strip() and len(l.strip()) > 10]
        for line in lines[:20]:
            if any(c in line for c in [":", "-", "•", "–"]):
                req_type = "technical"
                if any(w in line.lower() for w in ["admin", "juridique", "attestation", "bilan"]):
                    req_type = "administrative"
                elif any(w in line.lower() for w in ["financier", "budget", "prix", "tarif"]):
                    req_type = "financial"

                status = "to_analyze"
                if any(w in line.lower() for w in ["obligat", "éliminat", "requis"]):
                    status = "mandatory"

                create_tender_requirement(db, TenderRequirementCreate(
                    tender_id=tender_id,
                    description=line[:255],
                    requirement_type=req_type,
                    status=status,
                ))
    except Exception as e:
        log.debug("Could not save requirements: %s", e)


# ── Étape 4 : Matrice de conformité ──────────────────────────────────────────

def _step_compliance(db, tender_id: int) -> tuple:
    from app.crud.tender import get_tender
    from app.crud.tender_governance import list_compliance_items, list_go_no_go_criteria
    tender = get_tender(db, tender_id)
    ctx = _tender_context(tender)

    # Get requirements for context
    from sqlalchemy import text
    reqs = db.execute(text("SELECT title, category FROM tender_requirements WHERE tender_id=:tid LIMIT 15"), {"tid": tender_id}).fetchall()
    reqs_text = "\n".join(f"- {r[0]} ({r[1]})" for r in reqs) if reqs else "Aucune exigence enregistrée"

    result = _llm(
        prompt=f"""Génère la matrice de conformité pour cet AO :

AO : {ctx}

Exigences identifiées :
{reqs_text}

Pour chaque exigence, fournis :
- Statut : CONFORME / PARTIELLEMENT CONFORME / NON CONFORME
- Notre réponse en 1-2 phrases
- Preuve ou référence que nous pouvons apporter
- Note de solidité de notre réponse (/10)

Sois réaliste et précis pour un cabinet Data/IA spécialisé en Snowflake, dbt, Airflow, Python.
""",
        system="Tu es responsable qualité et conformité dans un cabinet de conseil Data & IA répondant à des appels d'offres.",
        action_type="compliance_matrix",
    )

    # Create compliance items
    try:
        if not list_compliance_items(db, tender_id):
            from app.api.v1.endpoints.tender_templates import _create_compliance_from_requirements
            _create_compliance_from_requirements(db, tender_id)
    except Exception as e:
        log.debug("Compliance creation: %s", e)

    items = list_compliance_items(db, tender_id)
    return (f"{len(items)} ligne(s) de conformité.\n\n{result[:600]}", "compliance", tender_id)


# ── Étape 5 : Staffing ────────────────────────────────────────────────────────

def _step_staffing(db, tender_id: int) -> tuple:
    from app.crud.tender import get_tender
    tender = get_tender(db, tender_id)
    ctx = _tender_context(tender)

    result = _llm(
        prompt=f"""Propose un plan de staffing optimal pour répondre à cet AO :

{ctx}

Définis :
1. Les profils nécessaires (rôle, expertise, niveau, charge estimée)
2. L'organisation de l'équipe
3. Le profil chef de projet
4. Les expertises techniques clés requises
5. Estimation du budget jour (base TJM marché)

Format souhaité : tableau Rôle | Expertise | Jours | TJM | Coût estimé
""",
        system="Tu es directeur de delivery dans un cabinet de conseil spécialisé Data/IA en France. Tu connais les TJM du marché freelance data en 2024-2025.",
        action_type="deliverable_plan",
    )

    return (result, "staffing", tender_id)


# ── Étape 6 : Structure de la proposition ────────────────────────────────────

def _step_proposal_outline(db, tender_id: int) -> tuple:
    from app.crud.tender import get_tender
    tender = get_tender(db, tender_id)
    ctx = _tender_context(tender)

    result = _llm(
        prompt=f"""Propose le plan détaillé du mémoire technique pour cet AO :

{ctx}

Structure le mémoire en sections principales avec :
- Titre de chaque section
- Objectif de la section
- Contenu clé à inclure
- Longueur recommandée (pages)
- Points différenciants à mettre en avant

Le mémoire doit répondre au CCTP tout en valorisant nos expertises Data & IA.
Format : plan numéroté avec sous-sections.
""",
        system="Tu es expert en rédaction de mémoires techniques pour marchés publics IT. Tu connais parfaitement les attentes des acheteurs publics français.",
        action_type="commercial_proposal",
    )

    return (result, "proposal_outline", tender_id)


# ── Étape 7 : Génération du livrable ─────────────────────────────────────────

def _step_generate_draft(db, tender_id: int, instance: WorkflowInstance) -> tuple:
    from app.crud.tender import get_tender
    from sqlalchemy import text
    tender = get_tender(db, tender_id)
    ctx = _tender_context(tender)

    # Get validated data from previous steps
    prev_steps = db.query(WorkflowStep).filter(
        WorkflowStep.instance_id == instance.id,
        WorkflowStep.status.in_(["done", "awaiting"]),
    ).all()

    prev_context = ""
    for s in prev_steps:
        if s.result_summary and s.step_key in ("analyze", "go_no_go", "requirements", "proposal_outline"):
            prev_context += f"\n\n### Résultats {s.step_label} :\n{s.result_summary[:400]}"

    markdown = _llm(
        prompt=f"""Rédige le mémoire technique complet pour cet appel d'offres.

AO : {ctx}

Contexte des étapes précédentes :{prev_context}

Rédige un mémoire technique professionnel complet en Markdown incluant :
1. Compréhension du besoin et des enjeux
2. Notre approche méthodologique
3. Architecture technique proposée
4. Organisation et équipe projet
5. Planning de réalisation
6. Références et expériences similaires
7. Garanties et engagements qualité

Sois précis, professionnel, en français. Minimum 800 mots.
""",
        system="Tu es consultant senior Data & IA rédigeant un mémoire technique de haute qualité pour un cabinet de conseil. Tu maîtrises Snowflake, dbt, Airflow, Python, ML/IA.",
        action_type="commercial_proposal",
    )

    # Create deliverable in DB
    opp_id = tender.opportunity_id if tender.opportunity_id else None
    if not opp_id:
        row = db.execute(text("SELECT id FROM opportunities LIMIT 1")).fetchone()
        opp_id = row[0] if row else None

    if markdown:
        try:
            from app.crud.deliverable import create_deliverable
            from app.schemas.deliverable import DeliverableCreate
            draft = create_deliverable(db, DeliverableCreate(
                tender_id=tender_id,           # lien direct à l'AO
                opportunity_id=opp_id or None,
                title=f"Mémoire technique — {tender.title}",
                deliverable_type="technical_proposal",
                status="draft",
                content_markdown=markdown,
                version=1,
            ))
            return (f"Mémoire technique rédigé ({len(markdown)} caractères).\nLivrable #{draft.id} créé — prêt pour revue finale.", "deliverable", draft.id)
        except Exception as e:
            log.warning("Could not create deliverable: %s", e)

    return (f"Mémoire généré ({len(markdown)} caractères).\n\n{markdown[:400]}...", None, None)


# ── Étape 8 : Revue finale ────────────────────────────────────────────────────

def _step_final_review(db, tender_id: int) -> tuple:
    from app.crud.tender import get_tender
    tender = get_tender(db, tender_id)
    return (
        f"✅ Workflow complet pour : {tender.title if tender else f'AO #{tender_id}'}\n\n"
        "Toutes les étapes ont été traitées automatiquement.\n"
        "Le livrable est disponible dans l'onglet Livrables.\n\n"
        "**Actions avant envoi :**\n"
        "1. Relire et personnaliser le mémoire technique\n"
        "2. Vérifier la matrice de conformité\n"
        "3. Valider le plan de staffing et les coûts\n"
        "4. Signer et déposer sur la plateforme acheteur",
        None, None
    )


# ── Approbation humaine ───────────────────────────────────────────────────────

def approve_step(db: Session, step_id: int, approved_by: str, session_factory) -> WorkflowStep:
    step = db.query(WorkflowStep).filter(WorkflowStep.id == step_id).first()
    if not step:
        raise ValueError(f"Étape #{step_id} introuvable")
    if step.status != "awaiting":
        raise ValueError(f"Cette étape n'est pas en attente (statut : {step.status})")

    step.status = "done"
    step.approved_by = approved_by
    step.approved_at = datetime.utcnow()
    instance = step.instance
    instance.status = "running"
    db.commit()

    log.info("Step approved: %s by=%s", step.step_key, approved_by)
    _notify_step_approved(db, instance, step)

    threading.Thread(target=_run_next_step, args=(instance.id, session_factory), daemon=True).start()
    return step


def reject_step(db: Session, step_id: int, rejected_by: str, reason: str) -> WorkflowStep:
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
    log.info("Step rejected: %s reason=%s", step.step_key, reason[:80])
    return step


def get_workflow(db: Session, tender_id: int) -> WorkflowInstance | None:
    return db.query(WorkflowInstance).filter(WorkflowInstance.tender_id == tender_id).first()


def get_pending_approvals(db: Session) -> list[WorkflowStep]:
    return db.query(WorkflowStep).filter(WorkflowStep.status == "awaiting").order_by(WorkflowStep.created_at).all()


# ── Notifications ─────────────────────────────────────────────────────────────

def _notify_approval_needed(db, instance, step) -> None:
    try:
        from app.models.notification import Notification
        db.add(Notification(
            user_id=None,
            title=f"⏳ Validation requise : {step.step_label}",
            body=f"AO #{instance.tender_id} — {(step.result_summary or '')[:120]}",
            notification_type="workflow_approval",
            reference_type="workflow_step",
            reference_id=step.id,
        ))
        db.commit()
    except Exception as e:
        log.debug("Notification: %s", e)


def _notify_step_approved(db, instance, step) -> None:
    try:
        from app.models.notification import Notification
        db.add(Notification(
            user_id=None,
            title=f"✅ Validé : {step.step_label}",
            body=f"AO #{instance.tender_id} — Workflow reprend automatiquement.",
            notification_type="workflow_approved",
            reference_type="workflow_step",
            reference_id=step.id,
        ))
        db.commit()
    except Exception as e:
        log.debug("Notification: %s", e)
