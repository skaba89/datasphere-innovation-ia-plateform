"""Add missing indexes on status columns

Revision ID: status_idx_001
Revises: linkedin_schedule_001
Create Date: 2026-06-30
"""
from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "status_idx_001"
down_revision: str | None = "linkedin_schedule_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_subscriptions_status", "subscriptions", ["status"],
        unique=False, if_not_exists=True,
    )
    op.create_index(
        "ix_deliverable_versions_status", "deliverable_versions", ["status"],
        unique=False, if_not_exists=True,
    )
    op.create_index(
        "ix_workflow_instances_status", "workflow_instances", ["status"],
        unique=False, if_not_exists=True,
    )
    op.create_index(
        "ix_workflow_steps_status", "workflow_steps", ["status"],
        unique=False, if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_workflow_steps_status", table_name="workflow_steps")
    op.drop_index("ix_workflow_instances_status", table_name="workflow_instances")
    op.drop_index("ix_deliverable_versions_status", table_name="deliverable_versions")
    op.drop_index("ix_subscriptions_status", table_name="subscriptions")
