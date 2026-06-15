"""Add invoices and quotes tables

Revision ID: invoices_001
Revises: must_change_pwd_001
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'invoices_001'
down_revision = 'must_change_pwd_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'quotes',
        sa.Column('id',             sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column('reference',      sa.String(50),    nullable=False, unique=True),
        sa.Column('title',          sa.String(255),   nullable=False),
        sa.Column('client_name',    sa.String(255),   nullable=False),
        sa.Column('client_email',   sa.String(255),   nullable=True),
        sa.Column('client_address', sa.Text(),        nullable=True),
        sa.Column('client_siret',   sa.String(20),    nullable=True),
        sa.Column('tender_id',      sa.Integer(),     sa.ForeignKey('tenders.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status',         sa.String(30),    nullable=False, default='draft'),
        sa.Column('currency',       sa.String(3),     nullable=False, default='EUR'),
        sa.Column('amount_ht',      sa.Numeric(12,2), nullable=False, default=0),
        sa.Column('tva_rate',       sa.Numeric(5,2),  nullable=False, default=20.0),
        sa.Column('amount_ttc',     sa.Numeric(12,2), nullable=False, default=0),
        sa.Column('daily_rate',     sa.Numeric(10,2), nullable=True),
        sa.Column('days_count',     sa.Numeric(8,1),  nullable=True),
        sa.Column('description',    sa.Text(),        nullable=True),
        sa.Column('notes',          sa.Text(),        nullable=True),
        sa.Column('valid_until',    sa.Date(),        nullable=True),
        sa.Column('issued_at',      sa.Date(),        nullable=True),
        sa.Column('owner_id',       sa.Integer(),     sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at',     sa.DateTime(),    nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',     sa.DateTime(),    nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        'invoices',
        sa.Column('id',             sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column('reference',      sa.String(50),    nullable=False, unique=True),
        sa.Column('quote_id',       sa.Integer(),     sa.ForeignKey('quotes.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title',          sa.String(255),   nullable=False),
        sa.Column('client_name',    sa.String(255),   nullable=False),
        sa.Column('client_email',   sa.String(255),   nullable=True),
        sa.Column('client_address', sa.Text(),        nullable=True),
        sa.Column('client_siret',   sa.String(20),    nullable=True),
        sa.Column('status',         sa.String(30),    nullable=False, default='draft'),
        sa.Column('amount_ht',      sa.Numeric(12,2), nullable=False, default=0),
        sa.Column('tva_rate',       sa.Numeric(5,2),  nullable=False, default=20.0),
        sa.Column('amount_ttc',     sa.Numeric(12,2), nullable=False, default=0),
        sa.Column('payment_terms',  sa.String(100),   nullable=True, default='30 jours net'),
        sa.Column('due_date',       sa.Date(),        nullable=True),
        sa.Column('paid_at',        sa.Date(),        nullable=True),
        sa.Column('notes',          sa.Text(),        nullable=True),
        sa.Column('owner_id',       sa.Integer(),     sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at',     sa.DateTime(),    nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',     sa.DateTime(),    nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_quotes_status',   'quotes',   ['status'])
    op.create_index('idx_invoices_status', 'invoices', ['status'])
    op.create_index('idx_invoices_due',    'invoices', ['due_date'])


def downgrade() -> None:
    op.drop_table('invoices')
    op.drop_table('quotes')
