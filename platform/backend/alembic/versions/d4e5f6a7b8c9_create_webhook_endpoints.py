"""Create webhook_endpoints table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'webhook_endpoints',
        sa.Column('id',           sa.Integer(),    primary_key=True, index=True),
        sa.Column('user_id',      sa.Integer(),    sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('workspace_id', sa.Integer(),    sa.ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('url',          sa.String(500),  nullable=False),
        sa.Column('secret',       sa.String(64),   nullable=False),
        sa.Column('name',         sa.String(100),  nullable=False),
        sa.Column('events',       sa.Text(),       nullable=False, server_default='*'),
        sa.Column('is_active',    sa.Boolean(),    nullable=False, server_default='true'),
        sa.Column('last_delivery_at',     sa.DateTime(), nullable=True),
        sa.Column('last_delivery_status', sa.String(10), nullable=True),
        sa.Column('created_at',   sa.DateTime(),   nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',   sa.DateTime(),   nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('webhook_endpoints')
