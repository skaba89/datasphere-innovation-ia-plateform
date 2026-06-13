"""add extra_data column to users

Revision ID: user_extra_data_001
Revises: f6804d861268
Create Date: 2026-06-13T14:44:07.583951
"""
from alembic import op
import sqlalchemy as sa

revision = 'user_extra_data_001'
down_revision = 'perf001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        op.add_column('users', sa.Column('extra_data', sa.Text(), nullable=True))
    except Exception:
        pass  # Column may already exist


def downgrade() -> None:
    try:
        op.drop_column('users', 'extra_data')
    except Exception:
        pass
