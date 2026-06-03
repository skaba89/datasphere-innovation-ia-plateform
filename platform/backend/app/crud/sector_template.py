from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.sector_template import SectorTemplate


def list_sector_templates(
    db: Session,
    sector_key: str | None = None,
    deliverable_type: str | None = None,
) -> list[SectorTemplate]:
    query = db.query(SectorTemplate).order_by(SectorTemplate.sector_key, SectorTemplate.deliverable_type)
    if sector_key:
        query = query.filter(SectorTemplate.sector_key == sector_key)
    if deliverable_type:
        query = query.filter(SectorTemplate.deliverable_type == deliverable_type)
    return query.all()


def get_sector_template(
    db: Session, sector_key: str, deliverable_type: str
) -> SectorTemplate | None:
    return (
        db.query(SectorTemplate)
        .filter(
            SectorTemplate.sector_key == sector_key,
            SectorTemplate.deliverable_type == deliverable_type,
        )
        .first()
    )


def install_builtin_templates(db: Session) -> list[SectorTemplate]:
    from app.core.sector_templates_seed import get_builtin_templates

    installed = []
    for data in get_builtin_templates():
        existing = get_sector_template(db, data["sector_key"], data["deliverable_type"])
        if existing is not None:
            installed.append(existing)
            continue
        tpl = SectorTemplate(**data, is_builtin=True, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
        db.add(tpl)
        db.commit()
        db.refresh(tpl)
        installed.append(tpl)
    return installed
