from __future__ import annotations

import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.v1.endpoints.uploads import UPLOAD_DIR
from app.db.session import get_db
from app.models.uploaded_file import UploadedFile
from app.services.data_expert_agents_service import (
    run_data_analyst_agent,
    run_data_engineer_agent,
    run_data_expert_agents,
)


class DataMissionRequest(BaseModel):
    project_title: str = Field(min_length=3, max_length=250)
    context: str = Field(min_length=10)
    requirements: list[str] = Field(default_factory=list)


class DataMissionUploadRequest(BaseModel):
    project_title: str = Field(min_length=3, max_length=250)
    extra_context: str = ""
    requirements: list[str] = Field(default_factory=list)


class DataMissionAgentResponse(BaseModel):
    agent: str
    project_title: str
    generated_at: str
    detected_keywords: list[str]
    summary: str
    deliverables: list[dict]


class DataMissionCombinedResponse(BaseModel):
    project_title: str
    generated_at: str
    agents: list[DataMissionAgentResponse]
    combined_recommendations: list[str]


class DataMissionUploadResponse(DataMissionCombinedResponse):
    file_id: int
    original_name: str
    extracted_characters: int
    extraction_status: str


router = APIRouter(
    prefix="/data-mission",
    tags=["data-mission"],
    dependencies=[Depends(get_current_user)],
)


def _extract_docx_text(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as archive:
            xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
        return (
            xml.replace("</w:p>", "\n")
            .replace("<w:tab/>", " ")
            .replace("</w:t>", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
        )
    except Exception:
        return ""


def _extract_pptx_text(path: Path) -> str:
    try:
        texts: list[str] = []
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                    texts.append(archive.read(name).decode("utf-8", errors="ignore"))
        return "\n".join(texts)
    except Exception:
        return ""


def _extract_xlsx_text(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as archive:
            texts = []
            for name in archive.namelist():
                if name.startswith("xl/sharedStrings") or name.startswith("xl/worksheets/sheet"):
                    texts.append(archive.read(name).decode("utf-8", errors="ignore"))
        return "\n".join(texts)
    except Exception:
        return ""


def _extract_file_text(path: Path, original_name: str) -> tuple[str, str]:
    suffix = Path(original_name).suffix.lower()
    if suffix in {".txt", ".md", ".csv"}:
        return path.read_text(encoding="utf-8", errors="ignore"), "text_extracted"
    if suffix == ".docx":
        text = _extract_docx_text(path)
        return text, "docx_text_extracted" if text else "docx_extraction_empty"
    if suffix == ".pptx":
        text = _extract_pptx_text(path)
        return text, "pptx_text_extracted" if text else "pptx_extraction_empty"
    if suffix == ".xlsx":
        text = _extract_xlsx_text(path)
        return text, "xlsx_text_extracted" if text else "xlsx_extraction_empty"
    if suffix == ".pdf":
        return "", "pdf_text_extraction_not_enabled_yet"
    return "", "unsupported_for_text_extraction"


@router.post("/analyze", response_model=DataMissionCombinedResponse)
def analyze_data_mission(payload: DataMissionRequest):
    """Run Data Engineer and Data Analyst agents on a project context or specification."""
    return run_data_expert_agents(
        project_title=payload.project_title,
        context=payload.context,
        requirements=payload.requirements,
    )


@router.post("/analyze-upload/{file_id}", response_model=DataMissionUploadResponse)
def analyze_uploaded_specification(
    file_id: int,
    payload: DataMissionUploadRequest,
    db: Session = Depends(get_db),
):
    """Analyze an uploaded specification using Data Engineer and Data Analyst agents."""
    record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    file_path = UPLOAD_DIR / record.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le disque")

    extracted_text, extraction_status = _extract_file_text(file_path, record.original_name)
    context_parts = [payload.extra_context.strip(), extracted_text.strip()]
    context = "\n\n".join(part for part in context_parts if part)
    if len(context.strip()) < 10:
        context = (
            f"Document {record.original_name} chargé mais texte non extractible automatiquement. "
            "Utiliser le contexte complémentaire ou ajouter une version TXT/DOCX du cahier des charges."
        )

    result = run_data_expert_agents(
        project_title=payload.project_title,
        context=context[:12000],
        requirements=payload.requirements,
    )
    return {
        **result,
        "file_id": record.id,
        "original_name": record.original_name,
        "extracted_characters": len(extracted_text),
        "extraction_status": extraction_status,
    }


@router.post("/agents/data-engineer", response_model=DataMissionAgentResponse)
def analyze_with_data_engineer(payload: DataMissionRequest):
    """Run only the Data Engineer agent."""
    return run_data_engineer_agent(
        project_title=payload.project_title,
        context=payload.context,
        requirements=payload.requirements,
    )


@router.post("/agents/data-analyst", response_model=DataMissionAgentResponse)
def analyze_with_data_analyst(payload: DataMissionRequest):
    """Run only the Data Analyst agent."""
    return run_data_analyst_agent(
        project_title=payload.project_title,
        context=payload.context,
        requirements=payload.requirements,
    )
