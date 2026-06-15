"""Add linkedin_scheduled_posts table

Revision ID: linkedin_schedule_001
Revises: invoices_001
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'linkedin_schedule_001'
down_revision = 'invoices_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'linkedin_scheduled_posts',
        sa.Column('id',            sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column('owner_id',      sa.Integer(),     sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('topic_type',    sa.String(50),    nullable=False, default='data_engineering'),
        sa.Column('topic',         sa.String(255),   nullable=True),
        sa.Column('content',       sa.Text(),        nullable=True),
        sa.Column('hashtags',      sa.Text(),        nullable=True),   # JSON array
        sa.Column('status',        sa.String(30),    nullable=False, default='pending'),
        # pending | generated | published | failed | cancelled
        sa.Column('scheduled_at',  sa.DateTime(),    nullable=False),
        sa.Column('published_at',  sa.DateTime(),    nullable=True),
        sa.Column('error_msg',     sa.Text(),        nullable=True),
        sa.Column('provider',      sa.String(50),    nullable=True),
        sa.Column('linkedin_post_id', sa.String(100), nullable=True),
        sa.Column('created_at',    sa.DateTime(),    nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_linkedin_posts_status',    'linkedin_scheduled_posts', ['status'])
    op.create_index('idx_linkedin_posts_scheduled', 'linkedin_scheduled_posts', ['scheduled_at'])


def downgrade() -> None:
    op.drop_table('linkedin_scheduled_posts')
