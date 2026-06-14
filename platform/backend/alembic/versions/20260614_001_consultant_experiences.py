"""consultant_experiences table

Revision ID: consultant_exp_001
Revises: user_extra_data_001
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'consultant_exp_001'
down_revision = 'user_extra_data_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'consultant_experiences',
        sa.Column('id',           sa.Integer(),     primary_key=True, index=True),
        sa.Column('owner_email',  sa.String(255),   nullable=False,   index=True),
        sa.Column('company',      sa.String(255),   nullable=False),
        sa.Column('client_name',  sa.String(255),   nullable=True),
        sa.Column('role',         sa.String(255),   nullable=False),
        sa.Column('sector',       sa.String(120),   nullable=True),
        sa.Column('location',     sa.String(120),   nullable=True),
        sa.Column('project_type', sa.String(120),   nullable=True),
        sa.Column('start_date',   sa.String(20),    nullable=False),
        sa.Column('end_date',     sa.String(20),    nullable=True),
        sa.Column('is_current',   sa.Boolean(),     default=False, nullable=False),
        sa.Column('context',      sa.Text(),        nullable=True),
        sa.Column('description',  sa.Text(),        nullable=False),
        sa.Column('achievements', sa.Text(),        nullable=True),
        sa.Column('technologies', sa.Text(),        nullable=True),
        sa.Column('methodologies',sa.Text(),        nullable=True),
        sa.Column('is_highlight', sa.Boolean(),     default=True, nullable=False),
        sa.Column('display_order',sa.Integer(),     default=0, nullable=False),
        sa.Column('created_at',   sa.DateTime(),    nullable=False),
        sa.Column('updated_at',   sa.DateTime(),    nullable=True),
    )


def downgrade() -> None:
    op.drop_table('consultant_experiences')
