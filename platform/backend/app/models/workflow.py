"""
WorkflowInstance + WorkflowStep — Workflow automatisé avec validation humaine.

Architecture :
  WorkflowInstance : une instance de workflow par tender
    - démarre automatiquement quand on clique "Lancer le workflow"
    - orchestre les étapes dans l'ordre

  WorkflowStep : une étape du workflow
    status :
      pending    → en attente d'exécution
      running    → agent en cours de traitement
      awaiting   → agent terminé, EN ATTENTE DE VALIDATION HUMAINE ← portail
      approved   → validé par un humain, étape suivante débloquée
      rejected   → rejeté, workflow mis en pause
      skipped    → ignoré (optionnel)
      done       → terminé et intégré dans la plateforme

Étapes du workflow standard AO :
  1. analyze          → Agent analyse le document AO, extrait les infos clés
  2. go_no_go         → Agent génère la recommandation Go/No-Go            [APPROBATION]
  3. requirements     → Agent extrait les exigences techniques
  4. compliance       → Agent génère la matrice de conformité              [APPROBATION]
  5. staffing         → Agent identifie les profils nécessaires
  6. proposal_outline → Agent structure la proposition technique           [APPROBATION]
  7. generate_draft   → Agent génère le livrable complet
  8. final_review     → Validation finale avant envoi                      [APPROBATION]
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class WorkflowInstance(Base):
    """Un workflow complet pour un appel d'offres."""
    __tablename__ = "workflow_instances"

    id             = Column(Integer, primary_key=True, index=True)
    tender_id      = Column(Integer, ForeignKey("tenders.id", ondelete="CASCADE"),
                            nullable=False, unique=True, index=True)
    status         = Column(String(50), nullable=False, default="idle")
    # idle | running | awaiting_approval | paused | completed | failed

    current_step   = Column(String(80), nullable=True)   # step name en cours
    started_by     = Column(String(255), nullable=True)  # email utilisateur
    started_at     = Column(DateTime, nullable=True)
    completed_at   = Column(DateTime, nullable=True)
    error_message  = Column(Text, nullable=True)

    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at     = Column(DateTime, default=datetime.utcnow,
                            onupdate=datetime.utcnow, nullable=False)

    steps    = relationship("WorkflowStep", back_populates="instance",
                            order_by="WorkflowStep.order_index", cascade="all, delete-orphan")
    tender   = relationship("Tender", foreign_keys=[tender_id])


class WorkflowStep(Base):
    """Une étape du workflow avec son statut et le résultat de l'agent."""
    __tablename__ = "workflow_steps"

    id              = Column(Integer, primary_key=True, index=True)
    instance_id     = Column(Integer, ForeignKey("workflow_instances.id", ondelete="CASCADE"),
                             nullable=False, index=True)

    # Identification
    step_key        = Column(String(80), nullable=False)   # "go_no_go", "compliance", ...
    step_label      = Column(String(200), nullable=False)  # label lisible
    order_index     = Column(Integer, nullable=False)

    # État
    status          = Column(String(50), nullable=False, default="pending")
    requires_approval = Column(Boolean, nullable=False, default=False)

    # Exécution
    started_at      = Column(DateTime, nullable=True)
    completed_at    = Column(DateTime, nullable=True)
    agent_result    = Column(Text, nullable=True)    # JSON résultat de l'agent
    result_summary  = Column(Text, nullable=True)    # Résumé lisible pour le validateur

    # Approbation humaine
    approved_by     = Column(String(255), nullable=True)
    approved_at     = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Lien vers l'artefact créé
    artifact_type   = Column(String(80), nullable=True)   # "go_no_go" | "compliance" | "deliverable"
    artifact_id     = Column(Integer, nullable=True)

    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at      = Column(DateTime, default=datetime.utcnow,
                             onupdate=datetime.utcnow, nullable=False)

    instance        = relationship("WorkflowInstance", back_populates="steps")


# ── Catalogue des étapes ──────────────────────────────────────────────────────

WORKFLOW_STEPS = [
    {
        "key":               "analyze",
        "label":             "Analyse du document AO",
        "requires_approval": False,
        "description":       "Extraction automatique des informations clés : objet, acheteur, budget, délai, exigences.",
    },
    {
        "key":               "go_no_go",
        "label":             "Recommandation Go / No-Go",
        "requires_approval": True,
        "description":       "L'agent évalue la pertinence de l'AO selon votre profil et propose une décision Go ou No-Go avec justification.",
    },
    {
        "key":               "requirements",
        "label":             "Extraction des exigences techniques",
        "requires_approval": False,
        "description":       "Identification et catégorisation de toutes les exigences techniques, fonctionnelles et administratives.",
    },
    {
        "key":               "compliance",
        "label":             "Matrice de conformité",
        "requires_approval": True,
        "description":       "Génération de la matrice de conformité : chaque exigence associée à une réponse et des preuves.",
    },
    {
        "key":               "staffing",
        "label":             "Plan de staffing",
        "requires_approval": False,
        "description":       "Identification des profils consultants nécessaires et estimation du plan de charge.",
    },
    {
        "key":               "proposal_outline",
        "label":             "Structure de la proposition",
        "requires_approval": True,
        "description":       "L'agent propose le plan détaillé du mémoire technique, adapté à l'AO.",
    },
    {
        "key":               "generate_draft",
        "label":             "Génération du livrable",
        "requires_approval": False,
        "description":       "Rédaction automatique du mémoire technique complet à partir des étapes validées.",
    },
    {
        "key":               "final_review",
        "label":             "Validation finale",
        "requires_approval": True,
        "description":       "Revue humaine obligatoire du livrable final avant envoi à l'acheteur.",
    },
]
