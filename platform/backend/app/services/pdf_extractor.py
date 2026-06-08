"""
Service d'extraction PDF pour les Appels d'Offres.

Fonctionnalités :
  - Extraction texte via PyMuPDF (fiable sur PDFs textuels)
  - Fallback OCR mention si PDF scanné
  - Détection automatique des sections clés (objet, délai, budget, critères…)
  - Extraction des exigences techniques sous forme de liste
  - Score de confiance de l'extraction
"""
from __future__ import annotations

import io
import re
import logging
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger("datasphere.pdf")

# ── Section patterns (French public tender keywords) ─────────────────────────

SECTION_PATTERNS = {
    "objet":        [r"objet\s*(du|de\s*l[a']?)\s*(march[eé]|consultation|appel)", r"^objet\s*:"],
    "organisme":    [r"pouvoir\s*adjudicateur", r"acheteur\s*public", r"ma[îi]tre\s*d.ouvrage",
                     r"organisme\s*(acheteur|commanditaire)"],
    "budget":       [r"valeur\s*(estim[eé]e|du\s*march[eé])", r"budget\s*(pr[eé]visionnel|allou[eé]|maximum)",
                     r"montant\s*(maximum|estim[eé])", r"enveloppe\s*budg[eé]taire"],
    "delai":        [r"d[eé]lai\s*(d.ex[eé]cution|de\s*r[eé]alisation|global)",
                     r"dur[eé]e\s*(du\s*march[eé]|d.ex[eé]cution)", r"calendrier"],
    "criteres":     [r"crit[eè]res\s*(de\s*(jugement|s[eé]lection|attribution)|d.[eé]valuation)",
                     r"pond[eé]ration", r"note\s*technique", r"barème"],
    "exigences":    [r"exigences?\s*(techniques?|fonctionnelles?|minimales?)",
                     r"pr[eé]requis", r"capacit[eé]s?\s*(techniques?|professionnelles?)",
                     r"comp[eé]tences?\s*(requises?|attendues?|n[eé]cessaires?)"],
    "deadline":     [r"date\s*(limite|de\s*(d[eé]p[oô]t|remise|r[eé]ception))\s*des?\s*(offres?|candidatures?)",
                     r"date\s*limite", r"r[eé]ception\s*des?\s*offres?"],
    "procedure":    [r"proc[eé]dure\s*(d.appel|adapt[eé]e|ouverte|restreinte|n[eé]goci[eé]e)",
                     r"MAPA", r"appel\s*d.offres?\s*(ouvert|restreint)"],
    "lots":         [r"lot\s*n[o°]?\s*\d+", r"allotissement", r"liste\s*des\s*lots"],
    "references":   [r"r[eé]f[eé]rences?\s*(similaires?|professionnelles?|pertinentes?)",
                     r"exp[eé]riences?\s*(similaires?|pertinentes?)", r"prestations?\s*(r[eé]alis[eé]es?)"],
}

TECHNICAL_KEYWORDS = [
    "data", "sql", "python", "spark", "airflow", "dbt", "snowflake", "databricks",
    "power bi", "tableau", "qlik", "looker", "bigquery", "redshift", "postgres",
    "aws", "azure", "gcp", "kubernetes", "docker", "api", "etl", "elt",
    "machine learning", "ia", "intelligence artificielle", "analytique",
    "entrepôt de données", "data warehouse", "data lake", "lakehouse",
    "gouvernance", "catalogue", "lineage", "qualité", "mdm",
    "architecture", "dataops", "mlops", "pipeline", "orchestration",
]


# ── Dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class ExtractedSection:
    title: str
    content: str
    page: int
    confidence: float = 1.0


@dataclass
class PDFExtractionResult:
    success:            bool
    text:               str = ""
    total_pages:        int = 0
    total_chars:        int = 0
    extraction_method:  str = "none"   # text | fallback | empty
    confidence:         float = 0.0

    # Structured sections
    sections:           dict[str, ExtractedSection] = field(default_factory=dict)

    # Parsed fields
    objet:              str | None = None
    organisme:          str | None = None
    budget_text:        str | None = None
    delai_text:         str | None = None
    deadline_text:      str | None = None
    procedure:          str | None = None

    # Technical analysis
    requirements:       list[str] = field(default_factory=list)
    technical_keywords: list[str] = field(default_factory=list)
    detected_lots:      list[str] = field(default_factory=list)

    # Errors
    error:              str | None = None


# ── Core extractor ────────────────────────────────────────────────────────────

def extract_pdf(content: bytes, filename: str = "") -> PDFExtractionResult:
    """
    Extract and analyze an AO PDF.

    Args:
        content: raw PDF bytes
        filename: original filename (for logging)

    Returns:
        PDFExtractionResult with all parsed fields
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return PDFExtractionResult(
            success=False, error="PyMuPDF non disponible. Installer : pip install pymupdf"
        )

    result = PDFExtractionResult(success=False)

    try:
        doc = fitz.open(stream=content, filetype="pdf")
        result.total_pages = len(doc)

        # Extract text from all pages
        pages_text: list[tuple[int, str]] = []
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text", sort=True)
            if text.strip():
                pages_text.append((page_num, text))

        doc.close()

        if not pages_text:
            result.error = "PDF sans texte extractible (probablement scanné). OCR requis."
            result.extraction_method = "empty"
            return result

        full_text = "\n".join(t for _, t in pages_text)
        result.text = full_text
        result.total_chars = len(full_text)
        result.extraction_method = "text"
        result.success = True

        # Confidence based on text density
        avg_chars_per_page = result.total_chars / max(result.total_pages, 1)
        result.confidence = min(1.0, avg_chars_per_page / 800)

        # Parse sections and fields
        _parse_sections(result, pages_text)
        _extract_requirements(result, full_text)
        _extract_technical_keywords(result, full_text)
        _extract_lots(result, full_text)

        log.info(
            "PDF extracted: %s — %d pages, %d chars, confidence=%.2f",
            filename or "unknown", result.total_pages, result.total_chars, result.confidence
        )

    except Exception as e:
        result.success = False
        result.error = f"Erreur extraction PDF : {e}"
        log.exception("PDF extraction failed for %s: %s", filename, e)

    return result


def _parse_sections(result: PDFExtractionResult, pages_text: list[tuple[int, str]]) -> None:
    """Detect and extract structured sections."""
    full_lower = result.text.lower()
    lines = result.text.split("\n")

    for section_key, patterns in SECTION_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, full_lower, re.IGNORECASE | re.MULTILINE)
            if not match:
                continue

            # Find the page
            char_pos = match.start()
            running = 0
            page_num = 1
            for pn, pt in pages_text:
                running += len(pt)
                if running > char_pos:
                    page_num = pn
                    break

            # Extract surrounding context (3 lines before, 8 lines after)
            match_line_idx = result.text[:match.start()].count("\n")
            context_lines = lines[max(0, match_line_idx - 1): match_line_idx + 8]
            content = " ".join(l.strip() for l in context_lines if l.strip())[:500]

            if content:
                result.sections[section_key] = ExtractedSection(
                    title=section_key,
                    content=content,
                    page=page_num,
                )
                break

    # Map to top-level fields
    if "objet" in result.sections:
        result.objet = _clean(result.sections["objet"].content)[:300]
    if "organisme" in result.sections:
        result.organisme = _clean(result.sections["organisme"].content)[:200]
    if "budget" in result.sections:
        result.budget_text = _clean(result.sections["budget"].content)[:200]
    if "delai" in result.sections:
        result.delai_text = _clean(result.sections["delai"].content)[:200]
    if "deadline" in result.sections:
        result.deadline_text = _clean(result.sections["deadline"].content)[:200]
    if "procedure" in result.sections:
        result.procedure = _clean(result.sections["procedure"].content)[:200]


def _extract_requirements(result: PDFExtractionResult, text: str) -> None:
    """
    Extract technical requirements as a bullet list.
    Looks for numbered lists, bullets, and requirement markers.
    """
    requirements: list[str] = []

    # Patterns for list items
    list_patterns = [
        r"^[-–•·▪◦]\s+(.{20,200})$",         # bullet points
        r"^\d+[\.\)]\s+(.{20,200})$",          # numbered list
        r"^[a-z][\.\)]\s+(.{20,200})$",        # lettered list
        r"^\s*[-–]\s+(.{20,200})$",            # indented bullets
    ]

    # Find sections that likely contain requirements
    req_section_start = None
    lines = text.split("\n")

    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(re.search(p, line_lower, re.IGNORECASE) for p in [
            r"exigences?", r"pr[eé]requis", r"capacit[eé]s?", r"comp[eé]tences?", r"crit[eè]res?"
        ]):
            req_section_start = i
            break

    # Extract from section if found, else from whole document
    search_lines = lines[req_section_start:req_section_start + 60] if req_section_start else lines

    for line in search_lines:
        line = line.strip()
        for pattern in list_patterns:
            m = re.match(pattern, line)
            if m:
                req = _clean(m.group(1))
                if len(req) >= 20 and req not in requirements:
                    requirements.append(req)
                break

    # Also look for "devra / doit / doit disposer" sentences
    must_patterns = [
        r"le\s+(titulaire|prestataire|candidat)\s+(devra|doit|doit\s+disposer)[^.]{15,200}\.",
        r"(doit|devra)\s+(justifier|disposer|pr[eé]senter|fournir)\s+[^.]{15,200}\.",
    ]
    for pattern in must_patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            req = _clean(m.group(0))
            if req and req not in requirements:
                requirements.append(req[:250])

    result.requirements = requirements[:30]  # Cap at 30


def _extract_technical_keywords(result: PDFExtractionResult, text: str) -> None:
    """Detect technical keywords present in the document."""
    text_lower = text.lower()
    found = []
    for kw in TECHNICAL_KEYWORDS:
        if kw.lower() in text_lower:
            found.append(kw)
    result.technical_keywords = found


def _extract_lots(result: PDFExtractionResult, text: str) -> None:
    """Extract lot numbers and titles."""
    lots = []
    for m in re.finditer(r"lot\s*n?[o°]?\s*(\d+)\s*[:\-–]?\s*([^\n]{5,100})", text, re.IGNORECASE):
        lots.append(f"Lot {m.group(1)}: {_clean(m.group(2))}")
    result.detected_lots = lots[:10]


def _clean(text: str) -> str:
    """Normalize whitespace and remove junk characters."""
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s\-.,;:()/'\"€%°]", " ", text)
    return text.strip()


# ── Convenience function ──────────────────────────────────────────────────────

def extract_pdf_from_path(path: Path) -> PDFExtractionResult:
    return extract_pdf(path.read_bytes(), path.name)


def result_to_dict(r: PDFExtractionResult) -> dict:
    """Serialize for API response."""
    return {
        "success":            r.success,
        "total_pages":        r.total_pages,
        "total_chars":        r.total_chars,
        "extraction_method":  r.extraction_method,
        "confidence":         round(r.confidence, 2),
        "objet":              r.objet,
        "organisme":          r.organisme,
        "budget_text":        r.budget_text,
        "delai_text":         r.delai_text,
        "deadline_text":      r.deadline_text,
        "procedure":          r.procedure,
        "requirements":       r.requirements,
        "technical_keywords": r.technical_keywords,
        "detected_lots":      r.detected_lots,
        "sections_found":     list(r.sections.keys()),
        "error":              r.error,
    }
