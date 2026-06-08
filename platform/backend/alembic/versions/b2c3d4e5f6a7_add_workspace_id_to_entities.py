"""Add workspace_id to core entity tables for multi-tenant isolation

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-08

Strategy: nullable FK with index. No NOT NULL constraint initially
so existing data is not broken. Phase 3 will backfill and enforce NOT NULL.

Tables patched: organizations, contacts, opportunities, tenders, deliverables, agent_actions
"""

from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

TABLES = [
    'organizations',
    'contacts',
    'opportunities',
    'tenders',
    'deliverables',
    'agent_actions',
]


def upgrade() -> None:
    for table in TABLES:
        # Add nullable workspace_id column
        op.add_column(
            table,
            sa.Column(
                'workspace_id',
                sa.Integer(),
                sa.ForeignKey('workspaces.id', ondelete='SET NULL'),
                nullable=True,
                index=True,
            )
        )

    # Also add created_by (user email) for audit trail
    audit_tables = ['organizations', 'contacts', 'opportunities', 'tenders', 'deliverables']
    for table in audit_tables:
        op.add_column(
            table,
            sa.Column('created_by_email', sa.String(255), nullable=True),
        )


def downgrade() -> None:
    audit_tables = ['organizations', 'contacts', 'opportunities', 'tenders', 'deliverables']
    for table in reversed(audit_tables):
        op.drop_column(table, 'created_by_email')

    for table in reversed(TABLES):
        # Drop index first
        try:
            op.drop_index(f'ix_{table}_workspace_id', table_name=table)
        except Exception:
            pass
        op.drop_column(table, 'workspace_id')
