from sqlalchemy.orm import Session

from app.models.tender_governance import ComplianceMatrixItem, GoNoGoCriterion
from app.schemas.tender_governance import (
    ComplianceMatrixItemCreate,
    ComplianceMatrixItemUpdate,
    GoNoGoCriterionCreate,
    GoNoGoCriterionUpdate,
)


def list_go_no_go_criteria(db: Session, tender_id: int) -> list[GoNoGoCriterion]:
    return db.query(GoNoGoCriterion).filter(GoNoGoCriterion.tender_id == tender_id).order_by(GoNoGoCriterion.created_at.asc()).all()


def get_go_no_go_criterion(db: Session, criterion_id: int) -> GoNoGoCriterion | None:
    return db.query(GoNoGoCriterion).filter(GoNoGoCriterion.id == criterion_id).first()


def create_go_no_go_criterion(db: Session, payload: GoNoGoCriterionCreate) -> GoNoGoCriterion:
    criterion = GoNoGoCriterion(**payload.model_dump())
    db.add(criterion)
    db.commit()
    db.refresh(criterion)
    return criterion


def update_go_no_go_criterion(db: Session, criterion: GoNoGoCriterion, payload: GoNoGoCriterionUpdate) -> GoNoGoCriterion:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(criterion, field, value)
    db.add(criterion)
    db.commit()
    db.refresh(criterion)
    return criterion


def delete_go_no_go_criterion(db: Session, criterion: GoNoGoCriterion) -> None:
    db.delete(criterion)
    db.commit()


def compute_go_no_go_summary(criteria: list[GoNoGoCriterion], tender_id: int) -> dict:
    weighted_score = sum(item.score * item.weight for item in criteria)
    max_weighted_score = sum(item.max_score * item.weight for item in criteria)
    percentage = round((weighted_score / max_weighted_score) * 100, 2) if max_weighted_score else 0.0

    if percentage >= 75:
        recommendation = "GO"
    elif percentage >= 55:
        recommendation = "GO_WITH_RESERVES"
    else:
        recommendation = "NO_GO"

    return {
        "tender_id": tender_id,
        "criteria_count": len(criteria),
        "weighted_score": float(weighted_score),
        "max_weighted_score": float(max_weighted_score),
        "percentage": percentage,
        "recommendation": recommendation,
    }


def list_compliance_items(db: Session, tender_id: int) -> list[ComplianceMatrixItem]:
    return db.query(ComplianceMatrixItem).filter(ComplianceMatrixItem.tender_id == tender_id).order_by(ComplianceMatrixItem.created_at.asc()).all()


def get_compliance_item(db: Session, item_id: int) -> ComplianceMatrixItem | None:
    return db.query(ComplianceMatrixItem).filter(ComplianceMatrixItem.id == item_id).first()


def create_compliance_item(db: Session, payload: ComplianceMatrixItemCreate) -> ComplianceMatrixItem:
    item = ComplianceMatrixItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_compliance_item(db: Session, item: ComplianceMatrixItem, payload: ComplianceMatrixItemUpdate) -> ComplianceMatrixItem:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_compliance_item(db: Session, item: ComplianceMatrixItem) -> None:
    db.delete(item)
    db.commit()


def compute_compliance_summary(items: list[ComplianceMatrixItem], tender_id: int) -> dict:
    total = len(items)
    compliant = sum(1 for item in items if item.compliance_status == "compliant")
    partial = sum(1 for item in items if item.compliance_status == "partial")
    gap = sum(1 for item in items if item.compliance_status == "gap")
    to_review = sum(1 for item in items if item.compliance_status == "to_review")
    compliance_rate = round((compliant / total) * 100, 2) if total else 0.0

    return {
        "tender_id": tender_id,
        "total_items": total,
        "compliant": compliant,
        "partial": partial,
        "gap": gap,
        "to_review": to_review,
        "compliance_rate": compliance_rate,
    }
