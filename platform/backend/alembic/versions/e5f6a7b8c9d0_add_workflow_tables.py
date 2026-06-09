"""Add workflow_instances and workflow_steps tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'workflow_instances',
        sa.Column('id',           sa.Integer(),  primary_key=True, index=True),
        sa.Column('tender_id',    sa.Integer(),  sa.ForeignKey('tenders.id', ondelete='CASCADE'), nullable=False, unique=True, index=True),
        sa.Column('status',       sa.String(50), nullable=False, server_default='idle'),
        sa.Column('current_step', sa.String(80), nullable=True),
        sa.Column('started_by',   sa.String(255), nullable=True),
        sa.Column('started_at',   sa.DateTime(),  nullable=True),
        sa.Column('completed_at', sa.DateTime(),  nullable=True),
        sa.Column('error_message',sa.Text(),      nullable=True),
        sa.Column('created_at',   sa.DateTime(),  nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',   sa.DateTime(),  nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'workflow_steps',
        sa.Column('id',               sa.Integer(),  primary_key=True, index=True),
        sa.Column('instance_id',      sa.Integer(),  sa.ForeignKey('workflow_instances.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('step_key',         sa.String(80), nullable=False),
        sa.Column('step_label',       sa.String(200),nullable=False),
        sa.Column('order_index',      sa.Integer(),  nullable=False),
        sa.Column('status',           sa.String(50), nullable=False, server_default='pending'),
        sa.Column('requires_approval',sa.Boolean(),  nullable=False, server_default='false'),
        sa.Column('started_at',       sa.DateTime(), nullable=True),
        sa.Column('completed_at',     sa.DateTime(), nullable=True),
        sa.Column('agent_result',     sa.Text(),     nullable=True),
        sa.Column('result_summary',   sa.Text(),     nullable=True),
        sa.Column('approved_by',      sa.String(255),nullable=True),
        sa.Column('approved_at',      sa.DateTime(), nullable=True),
        sa.Column('rejection_reason', sa.Text(),     nullable=True),
        sa.Column('artifact_type',    sa.String(80), nullable=True),
        sa.Column('artifact_id',      sa.Integer(),  nullable=True),
        sa.Column('created_at',       sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',       sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('workflow_steps')
    op.drop_table('workflow_instances')
