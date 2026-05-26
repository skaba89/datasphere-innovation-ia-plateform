from sqlalchemy.orm import Session

from app.models.tender import TenderRequirement
from app.models.tender_governance import ComplianceMatrixItem, GoNoGoCriterion

DEFAULT_GO_NO_GO_CRITERIA = [
    {
        "name": "Adequation strategique",
        "description": "Alignement avec le positionnement DataSphere Innovation et les marches cibles.",
        "score": 3,
        "weight": 3,
        "max_score": 5,
        "rationale": "A evaluer selon le secteur, le pays, la visibilite et le potentiel de reference.",
        "recommendation": "to_review",
    },
    {
        "name": "Capacite technique Data / IT / IA",
        "description": "Capacite a couvrir le perimetre technique avec les expertises internes et partenaires.",
        "score": 3,
        "weight": 4,
        "max_score": 5,
        "rationale": "Verifier architecture, data engineering, IA, securite, gouvernance et integration.",
        "recommendation": "to_review",
    },
    {
        "name": "Rentabilite et effort de reponse",
        "description": "Rapport entre valeur potentielle, charge de preparation et probabilite de gain.",
        "score": 3,
        "weight": 4,
        "max_score": 5,
        "rationale": "Ne pas mobiliser l equipe sur des appels peu rentables ou trop administratifs.",
        "recommendation": "to_review",
    },
    {
        "name": "Acces au decisionnaire",
        "description": "Niveau de relation, comprehension du besoin et capacite a obtenir des clarifications.",
        "score": 2,
        "weight": 3,
        "max_score": 5,
        "rationale": "Sans acces au contexte, le risque de reponse generique est eleve.",
        "recommendation": "to_review",
    },
    {
        "name": "Risque contractuel et delai",
        "description": "Analyse des contraintes legales, delais, penalites, garanties et dependances.",
        "score": 3,
        "weight": 3,
        "max_score": 5,
        "rationale": "A revoir avec la direction avant engagement formel.",
        "recommendation": "to_review",
    },
]


def apply_default_go_no_go_template(db: Session, tender_id: int) -> list[GoNoGoCriterion]:
    existing_names = {
        item.name
        for item in db.query(GoNoGoCriterion).filter(GoNoGoCriterion.tender_id == tender_id).all()
    }
    created: list[GoNoGoCriterion] = []

    for template in DEFAULT_GO_NO_GO_CRITERIA:
        if template["name"] in existing_names:
            continue
        criterion = GoNoGoCriterion(tender_id=tender_id, **template)
        db.add(criterion)
        created.append(criterion)

    db.commit()
    for criterion in created:
        db.refresh(criterion)
    return created


def generate_compliance_from_requirements(db: Session, tender_id: int) -> list[ComplianceMatrixItem]:
    requirements = db.query(TenderRequirement).filter(TenderRequirement.tender_id == tender_id).all()
    existing_requirement_ids = {
        item.requirement_id
        for item in db.query(ComplianceMatrixItem).filter(ComplianceMatrixItem.tender_id == tender_id).all()
        if item.requirement_id is not None
    }
    created: list[ComplianceMatrixItem] = []

    for requirement in requirements:
        if requirement.id in existing_requirement_ids:
            continue
        item = ComplianceMatrixItem(
            tender_id=tender_id,
            requirement_id=requirement.id,
            requirement_code=requirement.requirement_code,
            requirement_summary=requirement.description,
            compliance_status="to_review",
            response_location=None,
            evidence=requirement.proof_or_deliverable,
            gap=None,
            action_plan=requirement.response_strategy,
            owner_name=requirement.owner_name,
            comments="Generated from tender requirement.",
        )
        db.add(item)
        created.append(item)

    db.commit()
    for item in created:
        db.refresh(item)
    return created
