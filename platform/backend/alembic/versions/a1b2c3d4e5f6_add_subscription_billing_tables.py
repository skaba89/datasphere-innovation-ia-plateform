"""Add subscription and billing_events tables

Revision ID: a1b2c3d4e5f6
Revises: f6804d861268
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f6804d861268'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'subscriptions',
        sa.Column('id',                     sa.Integer(),     primary_key=True, index=True),
        sa.Column('workspace_id',           sa.Integer(),     sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False, unique=True, index=True),
        sa.Column('stripe_customer_id',     sa.String(255),   nullable=True, unique=True, index=True),
        sa.Column('stripe_subscription_id', sa.String(255),   nullable=True, unique=True, index=True),
        sa.Column('stripe_price_id',        sa.String(255),   nullable=True),
        sa.Column('plan',                   sa.String(50),    nullable=False, server_default='free'),
        sa.Column('status',                 sa.String(50),    nullable=False, server_default='active'),
        sa.Column('billing_cycle',          sa.String(20),    nullable=False, server_default='monthly'),
        sa.Column('trial_end',              sa.DateTime(),    nullable=True),
        sa.Column('current_period_start',   sa.DateTime(),    nullable=True),
        sa.Column('current_period_end',     sa.DateTime(),    nullable=True),
        sa.Column('canceled_at',            sa.DateTime(),    nullable=True),
        sa.Column('ai_actions_used',        sa.Integer(),     nullable=False, server_default='0'),
        sa.Column('ai_actions_reset_at',    sa.DateTime(),    nullable=True),
        sa.Column('customer_email',         sa.String(255),   nullable=True),
        sa.Column('customer_name',          sa.String(255),   nullable=True),
        sa.Column('notes',                  sa.Text(),        nullable=True),
        sa.Column('created_at',             sa.DateTime(),    nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',             sa.DateTime(),    nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        'billing_events',
        sa.Column('id',               sa.Integer(),     primary_key=True, index=True),
        sa.Column('workspace_id',     sa.Integer(),     sa.ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('stripe_event_id',  sa.String(255),   nullable=False, unique=True, index=True),
        sa.Column('event_type',       sa.String(100),   nullable=False),
        sa.Column('payload',          sa.Text(),        nullable=True),
        sa.Column('processed',        sa.Boolean(),     nullable=False, server_default='false'),
        sa.Column('error',            sa.Text(),        nullable=True),
        sa.Column('created_at',       sa.DateTime(),    nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('billing_events')
    op.drop_table('subscriptions')
