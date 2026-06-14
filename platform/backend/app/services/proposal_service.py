"""
ProposalGenerationService — Génération de propositions commerciales complètes

C'est la feature qui bat Accenture et Capgemini :
En 4 minutes, génère une proposition technique de 15 pages tailorée à chaque AO.

Structure de la proposition :
  1. Page de garde + résumé exécutif
  2. Compréhension de la mission
  3. Notre approche méthodologique
  4. Équipe proposée (profils consultants)
  5. Planning et jalons
  6. Budget détaillé
  7. Références similaires
  8. Pourquoi DataSphere Innovation
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta
from typing import Any

log = logging.getLogger("datasphere.proposal")

PROPOSAL_SYSTEM = """Tu es un expert en réponse aux appels d'offres data & IA pour un cabinet de conseil
de premier plan. Tu rédiges des propositions qui battent systématiquement Accenture, Capgemini
et McKinsey sur les missions Data Engineering, MLOps, BI, RGPD et gouvernance data.

Tes propositions sont :
  - Ultra-personnalisées au contexte exact de l'acheteur
  - Rigoureuses techniquement (stack précise, métriques)
  - Commercialement attractives (prix compétitif, valeur démontrée)
  - Humainement convaincantes (compréhension des enjeux, empathie client)

Tu génères toujours du contenu en FRANÇAIS professionnel, structuré et sans fautes."""


def _build_proposal_prompt(
    tender_title: str,
    buyer_name: str,
    description: str,
    mission_context: str | None,
    consultant_profiles: list[dict],
    budget_estimate: float | None,
    days_to_deadline: int | None,
) -> str:

    consultants_block = ""
    if consultant_profiles:
        profiles = []
        for c in consultant_profiles[:3]:
            profiles.append(
                f"  - {c.get('name','Consultant')} : {c.get('role','Expert Data')} "
                f"({c.get('years_experience', 8)} ans exp.) — {c.get('domain','Data Engineering')}"
            )
        consultants_block = f"""
ÉQUIPE DISPONIBLE :
{chr(10).join(profiles)}
"""

    budget_block = ""
    if budget_estimate:
        budget_block = f"\nBUDGET ESTIMÉ DE L'AO : {budget_estimate:,.0f} €"

    deadline_block = ""
    if days_to_deadline:
        deadline_block = f"\nDÉLAI RÉPONSE : {days_to_deadline} jours"

    return f"""MISSION : Génère une proposition commerciale complète et convaincante pour cet appel d'offres.

=== CONTEXTE DE L'APPEL D'OFFRES ===
Titre       : {tender_title}
Acheteur    : {buyer_name}
Description : {description or 'Voir titre'}
{f'Contexte    : {mission_context}' if mission_context else ''}
{budget_block}{deadline_block}
{consultants_block}

=== STRUCTURE REQUISE ===

Génère la proposition en JSON strict avec cette structure :

{{
  "executive_summary": "Résumé exécutif percutant en 3-4 phrases. Commence par pourquoi DataSphere Innovation est le partenaire idéal pour cette mission.",

  "understanding": {{
    "context": "Compréhension approfondie du contexte de {buyer_name} et de ses enjeux data (2-3 paragraphes)",
    "challenges": ["Défi 1 identifié", "Défi 2", "Défi 3"],
    "objectives": ["Objectif 1", "Objectif 2", "Objectif 3"]
  }},

  "approach": {{
    "methodology": "Description de l'approche méthodologique (Agile/Scrum, sprints, livrables itératifs)",
    "phases": [
      {{"name": "Phase 1 — Cadrage", "duration": "2 semaines", "deliverables": ["Atelier de lancement", "Cartographie as-is", "Feuille de route"]}},
      {{"name": "Phase 2 — Développement", "duration": "6-8 semaines", "deliverables": ["Architecture cible", "Développements", "Tests"]}},
      {{"name": "Phase 3 — Déploiement", "duration": "2 semaines", "deliverables": ["Mise en production", "Formation", "Documentation"]}}
    ],
    "tech_stack": ["Technologies principales adaptées à la mission"],
    "differentiators": ["Ce qui nous différencie concrètement des autres prestataires"]
  }},

  "team": {{
    "lead": {{"name": "Expert Data Senior", "role": "Chef de projet & Architecte", "experience": "10+ ans", "highlights": ["Certification Snowflake", "3 missions similaires réussies"]}},
    "members": [
      {{"role": "Data Engineer Senior", "experience": "7 ans", "skills": ["dbt", "Airflow", "Python"]}},
      {{"role": "Data Analyst / BI", "experience": "5 ans", "skills": ["Power BI", "SQL", "DAX"]}}
    ]
  }},

  "planning": {{
    "start_date": "{(date.today() + timedelta(days=14)).strftime('%d/%m/%Y')}",
    "duration_weeks": 12,
    "milestones": [
      {{"week": 1, "milestone": "Kick-off et accès aux systèmes"}},
      {{"week": 3, "milestone": "Architecture validée par le client"}},
      {{"week": 8, "milestone": "Livrable principal (MVP)"}},
      {{"week": 12, "milestone": "Recette et mise en production"}}
    ]
  }},

  "commercial": {{
    "daily_rate": 850,
    "total_days": 90,
    "total_ht": 76500,
    "total_ttc": 91800,
    "payment_terms": "30% à la commande, 40% mi-projet, 30% à la recette",
    "guarantee": "Satisfaction garantie ou remboursement de la dernière tranche"
  }},

  "references": [
    {{"client": "Organisme public similaire", "mission": "Mission Data Engineering comparable", "result": "Résultat concret mesurable", "date": "2023"}},
    {{"client": "Entreprise privée", "mission": "Gouvernance data", "result": "Réduction 40% des coûts infrastructure", "date": "2024"}}
  ],

  "why_datasphere": [
    "Expertise certifiée data engineering (Snowflake, dbt, Airflow, Azure/AWS/GCP)",
    "Équipe 100% senior — pas de stagiaires sur vos projets critiques",
    "Méthodologie éprouvée : 95% de missions livrées dans les délais",
    "Proximité et réactivité : interlocuteur unique, disponible",
    "Tarifs compétitifs : 30% moins chers que les grands cabinets pour une qualité supérieure"
  ],

  "call_to_action": "Phrase finale percutante pour convaincre de choisir DataSphere Innovation"
}}

IMPORTANT : Personnalise PROFONDÉMENT pour {buyer_name} et la mission spécifique.
Sois concret, précis, mesurable. Évite le jargon creux.
Génère UNIQUEMENT le JSON, sans markdown, sans commentaires."""


def generate_proposal(
    tender_id: int,
    tender_title: str,
    buyer_name: str,
    description: str | None = None,
    mission_context: str | None = None,
    consultant_profiles: list[dict] | None = None,
    budget_estimate: float | None = None,
    submission_deadline: str | None = None,
) -> dict[str, Any]:
    """
    Génère une proposition commerciale complète en utilisant le LLM actif.

    Returns:
        dict avec les sections de la proposition + metadata
    """
    from app.services.llm_service import complete

    # Calculate days to deadline
    days_to_deadline = None
    if submission_deadline:
        try:
            deadline_date = datetime.strptime(submission_deadline[:10], "%Y-%m-%d").date()
            days_to_deadline = (deadline_date - date.today()).days
        except (ValueError, TypeError):
            pass

    prompt = _build_proposal_prompt(
        tender_title=tender_title,
        buyer_name=buyer_name,
        description=description or tender_title,
        mission_context=mission_context,
        consultant_profiles=consultant_profiles or [],
        budget_estimate=budget_estimate,
        days_to_deadline=days_to_deadline,
    )

    log.info("Generating proposal for tender %d: %s", tender_id, tender_title[:50])

    raw, _ = complete(prompt, system=PROPOSAL_SYSTEM, action_type="deliverable_plan")

    # Parse JSON response
    try:
        # Clean potential markdown fences
        clean = raw.strip()
        if clean.startswith("```"):
            clean = "\n".join(clean.split("\n")[1:])
        if clean.endswith("```"):
            clean = "\n".join(clean.split("\n")[:-1])
        proposal_data = json.loads(clean)
    except json.JSONDecodeError:
        log.warning("LLM returned non-JSON proposal, using raw text")
        proposal_data = {
            "executive_summary": raw[:500],
            "raw_content": raw,
            "parse_error": True,
        }

    return {
        "tender_id":        tender_id,
        "tender_title":     tender_title,
        "buyer_name":       buyer_name,
        "generated_at":     datetime.utcnow().isoformat(),
        "days_to_deadline": days_to_deadline,
        "proposal":         proposal_data,
        "word_count":       len(raw.split()),
        "status":           "generated",
    }


def proposal_to_markdown(proposal_data: dict) -> str:
    """Convertit la proposition JSON en Markdown formaté pour export DOCX/PDF."""
    p = proposal_data.get("proposal", {})
    title  = proposal_data.get("tender_title", "Mission")
    buyer  = proposal_data.get("buyer_name", "Client")
    now    = datetime.now().strftime("%d/%m/%Y")

    md = f"""# PROPOSITION COMMERCIALE

**Mission :** {title}
**Pour :** {buyer}
**Date :** {now}
**Proposée par :** DataSphere Innovation

---

## RÉSUMÉ EXÉCUTIF

{p.get('executive_summary', '')}

---

## 1. COMPRÉHENSION DE LA MISSION

{p.get('understanding', {}).get('context', '')}

**Défis identifiés :**
{chr(10).join(f"- {d}" for d in p.get('understanding', {}).get('challenges', []))}

**Objectifs :**
{chr(10).join(f"- {o}" for o in p.get('understanding', {}).get('objectives', []))}

---

## 2. NOTRE APPROCHE

{p.get('approach', {}).get('methodology', '')}

**Phases de la mission :**
"""
    for phase in p.get('approach', {}).get('phases', []):
        md += f"\n### {phase.get('name', '')} — {phase.get('duration', '')}\n"
        for d in phase.get('deliverables', []):
            md += f"- {d}\n"

    md += f"""
**Stack technologique :** {', '.join(p.get('approach', {}).get('tech_stack', []))}

**Nos différenciateurs :**
{chr(10).join(f"- ✅ {d}" for d in p.get('approach', {}).get('differentiators', []))}

---

## 3. ÉQUIPE DÉDIÉE

**Chef de projet :** {p.get('team', {}).get('lead', {}).get('name', 'Expert Senior')}
- Rôle : {p.get('team', {}).get('lead', {}).get('role', '')}
- Expérience : {p.get('team', {}).get('lead', {}).get('experience', '')}

**Équipe :**
"""
    for m in p.get('team', {}).get('members', []):
        md += f"- {m.get('role', '')} ({m.get('experience', '')}) — {', '.join(m.get('skills', []))}\n"

    comm = p.get('commercial', {})
    md += f"""
---

## 4. PLANNING

**Démarrage :** {p.get('planning', {}).get('start_date', 'À définir')}
**Durée :** {p.get('planning', {}).get('duration_weeks', 12)} semaines

"""
    for ms in p.get('planning', {}).get('milestones', []):
        md += f"- Semaine {ms.get('week', '')} : {ms.get('milestone', '')}\n"

    md += f"""
---

## 5. CONDITIONS COMMERCIALES

| Élément | Valeur |
|---|---|
| TJM moyen | {comm.get('daily_rate', 850):,} € HT |
| Charge totale | {comm.get('total_days', 90)} jours |
| **Total HT** | **{comm.get('total_ht', 0):,} €** |
| TVA (20%) | {comm.get('total_ttc', 0) - comm.get('total_ht', 0):,} € |
| **Total TTC** | **{comm.get('total_ttc', 0):,} €** |

**Conditions de paiement :** {comm.get('payment_terms', '30/40/30')}
**Garantie :** {comm.get('guarantee', '')}

---

## 6. POURQUOI DATASPHERE INNOVATION ?

{chr(10).join(f"✅ {w}" for w in p.get('why_datasphere', []))}

---

## 7. PROCHAINES ÉTAPES

{p.get('call_to_action', 'Nous serions ravis de discuter de cette proposition avec vous.')}

---

*DataSphere Innovation — Cabinet de conseil Data & IA*
*Contact : infos@datasphere-innovation.net*
"""
    return md
