"""
File Upload endpoint — attach documents to tenders and deliverables.

POST /uploads/tenders/{tender_id}       — upload file to an AO
POST /uploads/deliverables/{deliverable_id} — upload file to a livrable
GET  /uploads/{resource}/{resource_id}  — list files for a resource
DELETE /uploads/{file_id}               — delete a file

Files are stored in UPLOAD_DIR (default: ./uploads/).
Allowed: PDF, DOCX, XLSX, PPTX, TXT, MD, PNG, JPG, ZIP
Max size: 20 MB per file.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.uploaded_file import UploadedFile
from app.models.user import User
from fastapi.responses import FileResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])

# ── Config ─────────────────────────────────────────────────────────────────────
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".xlsx", ".xls",
    ".pptx", ".ppt", ".txt", ".md",
    ".png", ".jpg", ".jpeg", ".gif",
    ".zip", ".csv",
}

ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/markdown", "text/csv",
    "image/png", "image/jpeg", "image/gif",
    "application/zip",
}


# ── Schema ─────────────────────────────────────────────────────────────────────

class FileRead(BaseModel):
    id: int
    resource_type: str
    resource_id: int
    original_name: str
    mime_type: str | None
    size_bytes: int | None
    uploaded_by: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_file(file: UploadFile) -> None:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Extension non autorisée : {suffix}. Autorisées : {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Type MIME non autorisé : {file.content_type}",
        )


def _list_files(db: Session, resource_type: str, resource_id: int) -> list[UploadedFile]:
    return (
        db.query(UploadedFile)
        .filter(
            UploadedFile.resource_type == resource_type,
            UploadedFile.resource_id == resource_id,
        )
        .order_by(UploadedFile.created_at.desc())
        .all()
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/tenders/{tender_id}", response_model=FileRead, status_code=status.HTTP_201_CREATED)
async def upload_to_tender(
    tender_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileRead:
    """Upload a file (PDF, DOCX, etc.) to an appel d'offres."""
    _validate_file(file)

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier trop volumineux. Maximum : {MAX_FILE_SIZE // (1024 * 1024)} MB",
        )

    suffix = Path(file.filename or "file").suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    dest = UPLOAD_DIR / stored_name
    dest.write_bytes(contents)

    record = UploadedFile(
        resource_type="tender",
        resource_id=tender_id,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        mime_type=file.content_type,
        size_bytes=len(contents),
        uploaded_by=current_user.email,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return FileRead.model_validate(record)


@router.post("/deliverables/{deliverable_id}", response_model=FileRead, status_code=status.HTTP_201_CREATED)
async def upload_to_deliverable(
    deliverable_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileRead:
    """Upload a file (PDF, DOCX, etc.) to a livrable."""
    _validate_file(file)

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier trop volumineux. Maximum : {MAX_FILE_SIZE // (1024 * 1024)} MB",
        )

    suffix = Path(file.filename or "file").suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    dest = UPLOAD_DIR / stored_name
    dest.write_bytes(contents)

    record = UploadedFile(
        resource_type="deliverable",
        resource_id=deliverable_id,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        mime_type=file.content_type,
        size_bytes=len(contents),
        uploaded_by=current_user.email,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return FileRead.model_validate(record)


@router.get("/tenders/{tender_id}", response_model=list[FileRead])
def list_tender_files(
    tender_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[FileRead]:
    return [FileRead.model_validate(f) for f in _list_files(db, "tender", tender_id)]


@router.get("/deliverables/{deliverable_id}", response_model=list[FileRead])
def list_deliverable_files(
    deliverable_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[FileRead]:
    return [FileRead.model_validate(f) for f in _list_files(db, "deliverable", deliverable_id)]


@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FileResponse:
    """Download a specific file by ID."""
    record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier introuvable.")
    file_path = UPLOAD_DIR / record.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier non trouvé sur le disque.")
    return FileResponse(
        path=str(file_path),
        filename=record.original_name,
        media_type=record.mime_type or "application/octet-stream",
    )


@router.delete("/{file_id}", status_code=status.HTTP_200_OK)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a file. Admins can delete any file; others only their own uploads."""
    record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier introuvable.")

    if current_user.role != "admin" and record.uploaded_by != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez supprimer que vos propres fichiers.",
        )

    # Remove from disk
    file_path = UPLOAD_DIR / record.stored_name
    if file_path.exists():
        file_path.unlink()

    db.delete(record)
    db.commit()
    return {"deleted": True, "id": file_id}
