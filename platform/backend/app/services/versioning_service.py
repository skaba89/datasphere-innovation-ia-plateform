"""
Deliverable versioning — snapshot + simple line-level diff.
"""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.deliverable import Deliverable
from app.models.deliverable_version import DeliverableVersion


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def snapshot(
    db: Session,
    deliverable: Deliverable,
    created_by: str | None = None,
    change_note: str | None = None,
) -> DeliverableVersion:
    """Save an immutable snapshot of the current deliverable state."""
    v = DeliverableVersion(
        deliverable_id=deliverable.id,
        version=deliverable.version,
        title=deliverable.title,
        content_markdown=deliverable.content_markdown or "",
        status=deliverable.status,
        summary=deliverable.summary,
        created_by=created_by,
        change_note=change_note,
        created_at=datetime.now(timezone.utc),
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def list_versions(db: Session, deliverable_id: int) -> list[DeliverableVersion]:
    return (
        db.query(DeliverableVersion)
        .filter(DeliverableVersion.deliverable_id == deliverable_id)
        .order_by(DeliverableVersion.version.desc())
        .all()
    )


def get_version(db: Session, deliverable_id: int, version_number: int) -> DeliverableVersion | None:
    return (
        db.query(DeliverableVersion)
        .filter(
            DeliverableVersion.deliverable_id == deliverable_id,
            DeliverableVersion.version == version_number,
        )
        .first()
    )


def restore_version(
    db: Session,
    deliverable: Deliverable,
    version: DeliverableVersion,
    restored_by: str,
) -> Deliverable:
    """Restore a deliverable to a previous version, bumping the version number."""
    # Snapshot current state first
    snapshot(db, deliverable, created_by=restored_by, change_note=f"Snapshot avant restauration à v{version.version}")

    deliverable.content_markdown = version.content_markdown
    deliverable.title = version.title
    deliverable.summary = version.summary
    deliverable.status = "draft"
    deliverable.version += 1
    deliverable.approved_by = None
    deliverable.approved_at = None
    deliverable.reviewed_by = None
    deliverable.reviewed_at = None
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)
    return deliverable


# ---------------------------------------------------------------------------
# Diff engine
# ---------------------------------------------------------------------------

def _line_diff(old: str, new: str) -> list[dict]:
    """
    Simple line-level diff.
    Returns list of {type: 'add'|'remove'|'equal', line: str, line_no_old, line_no_new}.
    Uses Myers diff algorithm approximation via Longest Common Subsequence.
    """
    old_lines = old.splitlines()
    new_lines = new.splitlines()

    # Build LCS table
    m, n = len(old_lines), len(new_lines)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m - 1, -1, -1):
        for j in range(n - 1, -1, -1):
            if old_lines[i] == new_lines[j]:
                dp[i][j] = dp[i + 1][j + 1] + 1
            else:
                dp[i][j] = max(dp[i + 1][j], dp[i][j + 1])

    result = []
    i = j = 0
    lo = ln = 1
    while i < m and j < n:
        if old_lines[i] == new_lines[j]:
            result.append({"type": "equal", "line": old_lines[i], "line_no_old": lo, "line_no_new": ln})
            i += 1; j += 1; lo += 1; ln += 1
        elif dp[i + 1][j] >= dp[i][j + 1]:
            result.append({"type": "remove", "line": old_lines[i], "line_no_old": lo, "line_no_new": None})
            i += 1; lo += 1
        else:
            result.append({"type": "add", "line": new_lines[j], "line_no_old": None, "line_no_new": ln})
            j += 1; ln += 1

    while i < m:
        result.append({"type": "remove", "line": old_lines[i], "line_no_old": lo, "line_no_new": None})
        i += 1; lo += 1
    while j < n:
        result.append({"type": "add", "line": new_lines[j], "line_no_old": None, "line_no_new": ln})
        j += 1; ln += 1

    return result


def compute_diff(old_version: DeliverableVersion, new_version: DeliverableVersion) -> dict:
    """Compare two versions and return diff stats + line diff."""
    lines = _line_diff(old_version.content_markdown, new_version.content_markdown)
    added = sum(1 for l in lines if l["type"] == "add")
    removed = sum(1 for l in lines if l["type"] == "remove")
    return {
        "version_old": old_version.version,
        "version_new": new_version.version,
        "lines_added": added,
        "lines_removed": removed,
        "lines_unchanged": sum(1 for l in lines if l["type"] == "equal"),
        "diff": lines[:500],  # cap at 500 lines for API response
    }
