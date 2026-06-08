"""Create api_keys table for public API access

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-08
"""

from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'api_keys',
        sa.Column('id',           sa.Integer(),     primary_key=True, index=True),
        sa.Column('user_id',      sa.Integer(),     sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('workspace_id', sa.Integer(),     sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('name',         sa.String(100),   nullable=False),
        sa.Column('prefix',       sa.String(20),    nullable=False, index=True),
        sa.Column('key_hash',     sa.String(64),    nullable=False, unique=True),
        sa.Column('scopes',       sa.Text(),        nullable=False, server_default='read:all'),
        sa.Column('is_active',    sa.Boolean(),     nullable=False, server_default='true'),
        sa.Column('last_used_at', sa.DateTime(),    nullable=True),
        sa.Column('expires_at',   sa.DateTime(),    nullable=True),
        sa.Column('created_at',   sa.DateTime(),    nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',   sa.DateTime(),    nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('api_keys')
