from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.workspace_scope import get_workspace_scope, WorkspaceContext
from typing import Optional
from app.models.user import User
from app.crud.deliverable import (
    approve_deliverable,
    create_deliverable,
    delete_deliverable,
    get_deliverable,
    list_deliverables,
    mark_deliverable_in_review,
    update_deliverable,
)
from app.crud.deliverable_section import (
    approve_section,
    create_contribution,
    create_section,
    delete_section,
    get_contribution,
    get_section,
    list_contributions,
    list_sections,
    review_section,
    update_contribution,
    update_section,
)
from app.db.session import get_db
from app.schemas.deliverable import (
    DeliverableApproveRequest,
    DeliverableCreate,
    DeliverableGenerateDraftRequest,
    DeliverableRead,
    DeliverableReviewRequest,
    DeliverableUpdate,
)
from app.schemas.deliverable_section import (
    AgentContributionCreate,
    AgentContributionRead,
    AgentContributionUpdate,
    DeliverableSectionCreate,
    DeliverableSectionRead,
    DeliverableSectionUpdate,
    SectionApproveRequest,
    SectionReviewRequest,
)
from app.services.deliverable_draft_engine import (
    build_context_label,
    build_draft_title,
    generate_draft_content,
)

router = APIRouter(
    prefix="/deliverables",
    tags=["deliverables"],
    dependencies=[Depends(get_current_user)],
)


# ---------------------------------------------------------------------------
# Deliverables
# ---------------------------------------------------------------------------


@router.get("", response_model=list[DeliverableRead])
def read_deliverables(
    opportunity_id: int | None = None,
    tender_id: int | None = None,
    status: str | None = None,
    deliverable_type: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    results = list_deliverables(db, skip=skip, limit=limit)
    if opportunity_id is not None:
        results = [d for d in results if d.opportunity_id == opportunity_id]
    if tender_id is not None:
        results = [d for d in results if d.tender_id == tender_id]
    if status is not None:
        results = [d for d in results if getattr(d, 'status', None) == status]
    if deliverable_type is not None:
        results = [d for d in results if getattr(d, 'deliverable_type', None) == deliverable_type]
    return results


@router.post("", response_model=DeliverableRead, status_code=status.HTTP_201_CREATED)
def create_new_deliverable(payload: DeliverableCreate, db: Session = Depends(get_db)):
    return create_deliverable(db, payload)




# ── Templates ─────────────────────────────────────────────────────────────────

@router.get("/templates")
def list_deliverable_templates(current_user: User = Depends(get_current_user)):
    """List all available deliverable templates."""
    from app.services.deliverable_templates import list_templates
    return list_templates()


@router.get("/templates/{template_key}")
def get_deliverable_template(
    template_key: str,
    tender_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a template ready to apply. Optionally pre-fill with tender context."""
    from app.services.deliverable_templates import apply_template, get_template
    from app.crud.tender import get_tender as get_tender_crud

    if not get_template(template_key):
        raise HTTPException(status_code=404, detail=f"Template '{template_key}' not found")

    tender_title = None
    buyer_name   = None
    if tender_id:
        tender = get_tender_crud(db, tender_id)
        if tender:
            tender_title = tender.title
            buyer_name   = tender.buyer_name

    return apply_template(template_key, tender_title=tender_title, buyer_name=buyer_name)


@router.post("/from-template/{template_key}")
def create_deliverable_from_template(
    template_key: str,
    tender_id:    int,
    opportunity_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new deliverable pre-filled from a template."""
    from app.services.deliverable_templates import apply_template, get_template
    from app.crud.tender import get_tender as get_tender_crud
    from app.schemas.deliverable import DeliverableCreate

    if not get_template(template_key):
        raise HTTPException(status_code=404, detail=f"Template '{template_key}' not found")

    tender = get_tender_crud(db, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    tpl_data = apply_template(
        template_key,
        tender_title=tender.title,
        buyer_name=tender.buyer_name,
    )

    payload = DeliverableCreate(
        tender_id=tender_id,
        opportunity_id=opportunity_id or tender.opportunity_id,
        title=tpl_data["title"],
        deliverable_type=tpl_data["deliverable_type"],
        status="draft",
        content_markdown=tpl_data["content_markdown"],
        version=1,
    )
    deliverable = create_deliverable(db, payload)
    return deliverable


# ── RAG — Similar deliverables ────────────────────────────────────────────────

@router.get("/similar")
def find_similar_deliverables(
    title:   str,
    type:    str | None = None,
    limit:   int = 3,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Find similar approved deliverables (RAG context retrieval)."""
    from app.services.rag_service import find_similar_deliverables as find_sim
    return find_sim(db, query_title=title, query_content="",
                    deliverable_type=type, limit=limit)


@router.get("/{deliverable_id}", response_model=DeliverableRead)
def read_deliverable(deliverable_id: int, db: Session = Depends(get_db)):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return deliverable


@router.patch("/{deliverable_id}", response_model=DeliverableRead)
def patch_deliverable(deliverable_id: int, payload: DeliverableUpdate, db: Session = Depends(get_db)):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return update_deliverable(db, deliverable, payload)


@router.delete("/{deliverable_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_deliverable(deliverable_id: int, db: Session = Depends(get_db)):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    delete_deliverable(db, deliverable)


@router.post("/generate-draft", response_model=DeliverableRead, status_code=status.HTTP_201_CREATED)
def generate_draft_deliverable(payload: DeliverableGenerateDraftRequest, db: Session = Depends(get_db)):
    context_label = build_context_label(
        db,
        payload.opportunity_id,
        payload.tender_id,
        payload.assignment_id,
        payload.action_id,
    )
    title = build_draft_title(payload.deliverable_type, context_label)
    content = generate_draft_content(payload.deliverable_type, context_label, payload.language or "fr")

    create_payload = DeliverableCreate(
        opportunity_id=payload.opportunity_id,
        tender_id=payload.tender_id,
        assignment_id=payload.assignment_id,
        action_id=payload.action_id,
        title=title,
        deliverable_type=payload.deliverable_type,
        status="draft",
        language=payload.language or "fr",
        audience=payload.audience,
        content_markdown=content,
        generated_by=payload.generated_by or "agent",
        summary=f"Brouillon genere automatiquement pour : {context_label}",
    )
    return create_deliverable(db, create_payload)


@router.post("/{deliverable_id}/review", response_model=DeliverableRead)
def review_deliverable_action(
    deliverable_id: int,
    payload: DeliverableReviewRequest,
    db: Session = Depends(get_db),
):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return mark_deliverable_in_review(db, deliverable, payload.reviewer_name)


@router.post("/{deliverable_id}/approve", response_model=DeliverableRead)
def approve_deliverable_action(
    deliverable_id: int,
    payload: DeliverableApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deliverable = get_deliverable(db, deliverable_id)
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    # Default approver_name to current user email if not provided
    approver = payload.approver_name or current_user.email or current_user.first_name or "admin"
    result = approve_deliverable(db, deliverable, approver)

    # Fire-and-forget email to approver
    import threading
    from app.services.email_service import EmailType, send_typed_email
    def _notify():
        send_typed_email(
            to=current_user.email,
            email_type=EmailType.DELIVERABLE_APPROVED,
            params={
                "first_name": current_user.first_name or current_user.email,
                "deliverable_title": result.title,
                "approver": payload.approver_name,
            },
        )
    threading.Thread(target=_notify, daemon=True).start()

    # Index dans pgvector (async, non-bloquant)
    def _index_rag():
        try:
            from app.services.rag_service import index_deliverable
            vectorized = index_deliverable(db, deliverable_id)
            import logging
            logging.getLogger("datasphere.rag").info(
                "Deliverable %d indexed: %s", deliverable_id,
                "pgvector" if vectorized else "tfidf-fallback"
            )
        except Exception as e:
            import logging
            logging.getLogger("datasphere.rag").warning("RAG indexing failed: %s", e)
    threading.Thread(target=_index_rag, daemon=True).start()

    return result


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------


@router.get("/{deliverable_id}/sections", response_model=list[DeliverableSectionRead])
def read_sections(deliverable_id: int, db: Session = Depends(get_db)):
    if get_deliverable(db, deliverable_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return list_sections(db, deliverable_id)


@router.post(
    "/{deliverable_id}/sections",
    response_model=DeliverableSectionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_new_section(
    deliverable_id: int,
    payload: DeliverableSectionCreate,
    db: Session = Depends(get_db),
):
    if get_deliverable(db, deliverable_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    if payload.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="deliverable_id mismatch")
    return create_section(db, payload)


@router.patch("/{deliverable_id}/sections/{section_id}", response_model=DeliverableSectionRead)
def patch_section(
    deliverable_id: int,
    section_id: int,
    payload: DeliverableSectionUpdate,
    db: Session = Depends(get_db),
):
    section = get_section(db, section_id)
    if section is None or section.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return update_section(db, section, payload)


@router.delete("/{deliverable_id}/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_section(deliverable_id: int, section_id: int, db: Session = Depends(get_db)):
    section = get_section(db, section_id)
    if section is None or section.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    delete_section(db, section)


@router.post("/{deliverable_id}/sections/{section_id}/review", response_model=DeliverableSectionRead)
def review_section_action(
    deliverable_id: int,
    section_id: int,
    payload: SectionReviewRequest,
    db: Session = Depends(get_db),
):
    section = get_section(db, section_id)
    if section is None or section.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return review_section(db, section, payload.reviewer_name)


@router.post("/{deliverable_id}/sections/{section_id}/approve", response_model=DeliverableSectionRead)
def approve_section_action(
    deliverable_id: int,
    section_id: int,
    payload: SectionApproveRequest,
    db: Session = Depends(get_db),
):
    section = get_section(db, section_id)
    if section is None or section.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return approve_section(db, section, payload.approver_name)


# ---------------------------------------------------------------------------
# Contributions
# ---------------------------------------------------------------------------


@router.get("/{deliverable_id}/contributions", response_model=list[AgentContributionRead])
def read_contributions(deliverable_id: int, db: Session = Depends(get_db)):
    if get_deliverable(db, deliverable_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    return list_contributions(db, deliverable_id)


@router.post(
    "/{deliverable_id}/contributions",
    response_model=AgentContributionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_new_contribution(
    deliverable_id: int,
    payload: AgentContributionCreate,
    db: Session = Depends(get_db),
):
    if get_deliverable(db, deliverable_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    if payload.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="deliverable_id mismatch")
    return create_contribution(db, payload)


@router.patch(
    "/{deliverable_id}/contributions/{contribution_id}",
    response_model=AgentContributionRead,
)
def patch_contribution(
    deliverable_id: int,
    contribution_id: int,
    payload: AgentContributionUpdate,
    db: Session = Depends(get_db),
):
    contribution = get_contribution(db, contribution_id)
    if contribution is None or contribution.deliverable_id != deliverable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")
    return update_contribution(db, contribution, payload)


# ── Versioning ────────────────────────────────────────────────────────────────

from app.services.versioning_service import (  # noqa: E402
    compute_diff,
    get_version,
    list_versions,
    restore_version,
    snapshot,
)


class VersionRead(BaseModel):
    id: int
    deliverable_id: int
    version: int
    title: str
    status: str
    summary: str | None = None
    created_by: str | None = None
    change_note: str | None = None
    created_at: datetime


class RestoreRequest(BaseModel):
    version_number: int
    restored_by: str = "admin"


@router.get("/{deliverable_id}/versions", response_model=list[VersionRead])
def list_deliverable_versions(deliverable_id: int, db: Session = Depends(get_db)):
    """List all saved versions for a deliverable."""
    d = get_deliverable(db, deliverable_id)
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return list_versions(db, deliverable_id)


@router.post("/{deliverable_id}/versions/snapshot", response_model=VersionRead, status_code=201)
def create_snapshot(
    deliverable_id: int,
    change_note: str | None = None,
    created_by: str = "manual",
    db: Session = Depends(get_db),
):
    """Manually save a snapshot of the current deliverable state."""
    d = get_deliverable(db, deliverable_id)
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return snapshot(db, d, created_by=created_by, change_note=change_note)


@router.get("/{deliverable_id}/versions/{version_number}/diff")
def diff_versions(
    deliverable_id: int,
    version_number: int,
    compare_to: int | None = None,
    db: Session = Depends(get_db),
):
    """
    Diff version_number against compare_to (defaults to version_number + 1).
    Returns added/removed/unchanged line counts + line-level diff.
    """
    d = get_deliverable(db, deliverable_id)
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    old_v = get_version(db, deliverable_id, version_number)
    if not old_v:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found")

    if compare_to is None:
        compare_to = version_number + 1

    new_v = get_version(db, deliverable_id, compare_to)
    if not new_v:
        raise HTTPException(
            status_code=404,
            detail=f"Version {compare_to} not found. Create a snapshot first.",
        )

    return compute_diff(old_v, new_v)


@router.post("/{deliverable_id}/versions/restore", response_model=DeliverableRead)
def restore_deliverable_version(
    deliverable_id: int,
    payload: RestoreRequest,
    db: Session = Depends(get_db),
):
    """Restore a deliverable to a previous version (creates a new version, resets to draft)."""
    d = get_deliverable(db, deliverable_id)
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    v = get_version(db, deliverable_id, payload.version_number)
    if not v:
        raise HTTPException(status_code=404, detail=f"Version {payload.version_number} not found")

    return restore_version(db, d, v, restored_by=payload.restored_by)


@router.get("/{deliverable_id}/export/docx")
def export_deliverable_docx(
    deliverable_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export deliverable as formatted Word (.docx) document."""
    from fastapi.responses import Response
    from app.services.docx_export import markdown_to_docx
    from app.crud.tender import get_tender

    deliverable = get_deliverable(db, deliverable_id)
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    # Get buyer name from tender if available
    buyer_name = None
    if deliverable.tender_id:
        tender = get_tender(db, deliverable.tender_id)
        if tender:
            buyer_name = tender.buyer_name

    safe_title = "".join(c for c in (deliverable.title or "livrable") if c.isalnum() or c in " -_")[:50]

    try:
        docx_bytes = markdown_to_docx(
            title=deliverable.title or "Livrable",
            content_markdown=deliverable.content_markdown or deliverable.content or "",
            author=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or "DataSphere",
            buyer_name=buyer_name,
            confidential=True,
        )
        filename = f"Livrable_{safe_title}.docx"
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        # Fallback Markdown si python-docx échoue
        md = deliverable.content_markdown or deliverable.content or ""
        filename = f"Livrable_{safe_title}.md"
        return Response(
            content=md.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


@router.get("/{deliverable_id}/export/pdf")
def export_deliverable_pdf(
    deliverable_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export deliverable as styled PDF (WeasyPrint)."""
    from fastapi.responses import Response
    from app.services.pdf_export import markdown_to_pdf
    from app.crud.tender import get_tender

    deliverable = get_deliverable(db, deliverable_id)
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    buyer_name = None
    if deliverable.tender_id:
        tender = get_tender(db, deliverable.tender_id)
        if tender:
            buyer_name = tender.buyer_name

    safe_title = "".join(ch for ch in (deliverable.title or "livrable") if ch.isalnum() or ch in " -_")[:50]

    try:
        result = markdown_to_pdf(
            title=deliverable.title or "Livrable",
            content_markdown=deliverable.content_markdown or deliverable.content or "",
            author=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or "DataSphere",
            buyer_name=buyer_name,
            version=getattr(deliverable, 'version', 1) or 1,
            confidential=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")

    # Détecter PDF vs HTML fallback
    # PDF commence par %PDF-, HTML par <!DOCTYPE ou <html
    result_bytes = result if isinstance(result, bytes) else result.encode("utf-8")
    is_pdf = result_bytes[:5] == b'%PDF-'

    if is_pdf:
        return Response(
            content=result_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Livrable_{safe_title}.pdf"'},
        )
    else:
        # Fallback HTML — ouvrable dans le navigateur, imprimable en PDF
        return Response(
            content=result_bytes,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="Livrable_{safe_title}.html"'},
        )


@router.post("/{deliverable_id}/generate")
def generate_content_for_deliverable(
    deliverable_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Génère le contenu IA pour un livrable existant (brouillon).
    Utilise le type du livrable et les AOs liés comme contexte.
    """
    deliverable = db.query(Deliverable).filter(Deliverable.id == deliverable_id).first()
    if not deliverable:
        raise HTTPException(status_code=404, detail="Livrable non trouvé")
    if deliverable.status not in ("draft", "review"):
        raise HTTPException(status_code=400, detail="Seuls les brouillons peuvent être regénérés")

    # Contexte : titre + tender lié si disponible
    context_label = deliverable.title or ""
    if deliverable.tender_id:
        from app.models.tender import Tender
        tender = db.query(Tender).filter(Tender.id == deliverable.tender_id).first()
        if tender:
            context_label = f"{tender.title} — {deliverable.title}"

    try:
        result = generate_draft_content(
            deliverable_type=deliverable.deliverable_type or "technical_proposal",
            context=context_label,
            language="fr",
        )
        # generate_draft_content peut retourner str ou dict selon la version
        if isinstance(result, dict):
            provider    = result.get("provider", "template")
            content_text = result.get("content", "")
        else:
            provider    = "template"
            content_text = str(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération IA : {e}")

    # Sauvegarder le contenu généré
    deliverable.content = content_text
    deliverable.content_markdown = content_text
    deliverable.generated_by = f"ai:{provider}"
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)

    return {"content": content_text, "provider": provider, "deliverable_id": deliverable_id}


@router.get("/{deliverable_id}/export/markdown")
def export_deliverable_markdown(
    deliverable_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export deliverable as raw Markdown (.md) file."""
    from fastapi.responses import Response

    deliverable = get_deliverable(db, deliverable_id)
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")

    md_content = deliverable.content_markdown or deliverable.content or ""
    if not md_content:
        raise HTTPException(status_code=404, detail="Aucun contenu Markdown disponible")

    filename = f"livrable-{deliverable_id}.md"
    return Response(
        content=md_content.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.post("/{deliverable_id}/version")
def create_deliverable_version(
    deliverable_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crée une nouvelle version d'un livrable approuvé.
    v1 → v2 → v3 ...
    L'ancienne version est archivée, la nouvelle repart en brouillon.
    """
    source = db.query(Deliverable).filter(Deliverable.id == deliverable_id).first()
    if not source:
        raise HTTPException(404, "Livrable non trouvé")

    # Calculer le prochain numéro de version
    current_version = getattr(source, "version", 1) or 1
    next_version = current_version + 1

    # Créer la nouvelle version (copie du livrable)
    new_deliverable = Deliverable(
        opportunity_id=source.opportunity_id,
        tender_id=source.tender_id,
        title=source.title,
        deliverable_type=source.deliverable_type,
        status="draft",
        version=next_version,
        content=source.content,
        content_markdown=source.content_markdown,
        generated_by=f"version:{current_user.email}",
        workspace_id=getattr(source, "workspace_id", None),
        created_by_email=current_user.email,
    )
    db.add(new_deliverable)

    # Archiver l'ancienne version
    source.status = "archived"
    db.add(source)
    db.commit()
    db.refresh(new_deliverable)

    return {
        "new_version": next_version,
        "deliverable_id": new_deliverable.id,
        "previous_id": source.id,
        "message": f"✅ Version v{next_version} créée — v{current_version} archivée",
    }
