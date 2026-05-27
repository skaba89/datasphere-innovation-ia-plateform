from app.models.agent import AgentAssignment
from app.schemas.agent import AgentActionCreate


def build_default_actions_for_assignment(assignment: AgentAssignment) -> list[AgentActionCreate]:
    base_priority = assignment.priority or "Moyenne"
    actions = [
        AgentActionCreate(
            assignment_id=assignment.id,
            action_type="context_analysis",
            title="Analyser le contexte de mission",
            description=(
                "Lire l objectif, le contexte CRM ou AO, identifier les parties prenantes, "
                "les contraintes, les risques et les informations manquantes."
            ),
            priority=base_priority,
            status="auto_ready",
            requires_human_approval=False,
            next_step="Produire une synthese de cadrage.",
        ),
        AgentActionCreate(
            assignment_id=assignment.id,
            action_type="deliverable_plan",
            title="Preparer le plan de livrable",
            description=(
                "Structurer le livrable attendu avec sections, hypotheses, preuves, donnees necessaires, "
                "roles et points de validation."
            ),
            priority=base_priority,
            status="auto_ready",
            requires_human_approval=False,
            next_step="Faire valider le plan par le reviewer humain si necessaire.",
        ),
        AgentActionCreate(
            assignment_id=assignment.id,
            action_type="human_review",
            title="Demander validation humaine",
            description=(
                "Soumettre les recommandations, livrables ou decisions sensibles a un reviewer humain "
                "avant toute transmission client ou execution critique."
            ),
            priority="Haute",
            status="suggested",
            requires_human_approval=True,
            next_step="Attendre validation humaine.",
        ),
    ]

    if assignment.tender_id is not None:
        actions.insert(
            1,
            AgentActionCreate(
                assignment_id=assignment.id,
                action_type="tender_requirements_review",
                title="Analyser les exigences AO",
                description=(
                    "Identifier les exigences obligatoires, criteres de notation, preuves attendues, "
                    "risques de non-conformite et axes de differenciation."
                ),
                priority="Haute",
                status="auto_ready",
                requires_human_approval=False,
                next_step="Construire la matrice de conformite et la recommandation Go No-Go.",
            ),
        )

    return actions


def simulate_action_execution(action_type: str) -> tuple[str, str | None]:
    if action_type == "context_analysis":
        return (
            "Contexte analyse. Les informations essentielles, risques et donnees manquantes doivent etre consolides.",
            "Completer les informations manquantes dans l opportunite ou l appel d offres.",
        )
    if action_type == "deliverable_plan":
        return (
            "Plan de livrable prepare avec structure, hypotheses, preuves attendues et points de validation.",
            "Faire relire le plan avant production finale.",
        )
    if action_type == "tender_requirements_review":
        return (
            "Exigences AO analysees. Les exigences obligatoires et risques de non-conformite sont a prioriser.",
            "Completer la matrice de conformite et evaluer le Go No-Go.",
        )
    return ("Action executee en mode MVP simule.", "Verifier le resultat avant toute action client.")
