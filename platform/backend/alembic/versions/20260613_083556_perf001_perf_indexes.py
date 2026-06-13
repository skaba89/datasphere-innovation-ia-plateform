"""perf: add missing indexes for FK and status columns

Revision ID: perf001
Revises: f6804d861268
Create Date: 2026-06-13T08:35:56.355944
"""

from alembic import op
import sqlalchemy as sa

revision = 'perf001'
down_revision = 'f6804d861268'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add missing indexes on high-frequency query columns."""
    # Use try/except per index — safe to run multiple times (idempotent)
    indexes = [
        # opportunities
        ('ix_opportunities_status',         'opportunities',       'status'),
        ('ix_opportunities_organization_id', 'opportunities',      'organization_id'),
        ('ix_opportunities_created_at',      'opportunities',      'created_at'),
        # contacts
        ('ix_contacts_organization_id',      'contacts',           'organization_id'),
        ('ix_contacts_created_at',           'contacts',           'created_at'),
        # deliverables
        ('ix_deliverables_status',           'deliverables',       'status'),
        ('ix_deliverables_tender_id',        'deliverables',       'tender_id'),
        ('ix_deliverables_created_at',       'deliverables',       'created_at'),
        # tenders
        ('ix_tenders_status',               'tenders',             'status'),
        ('ix_tenders_created_at',           'tenders',             'created_at'),
        # workflow
        ('ix_workflow_instances_status',     'workflow_instances',  'status'),
        ('ix_workflow_instances_tender_id',  'workflow_instances',  'tender_id'),
        ('ix_workflow_steps_status',         'workflow_steps',      'status'),
        ('ix_workflow_steps_instance_id',    'workflow_steps',      'instance_id'),
        # agents
        ('ix_agent_actions_status',          'agent_actions',       'status'),
        ('ix_agent_actions_tender_id',       'agent_actions',       'tender_id'),
        # audit_logs
        ('ix_audit_logs_created_at',         'audit_logs',         'created_at'),
        ('ix_audit_logs_action',             'audit_logs',         'action'),
        # notifications
        ('ix_notifications_user_id',         'notifications',      'user_id'),
        ('ix_notifications_created_at',      'notifications',      'created_at'),
        # organizations
        ('ix_organizations_status',          'organizations',      'status'),
        ('ix_organizations_created_at',      'organizations',      'created_at'),
    ]

    for index_name, table, column in indexes:
        try:
            op.create_index(index_name, table, [column])
        except Exception:
            pass  # Index already exists — skip silently


def downgrade() -> None:
    """Drop the performance indexes."""
    index_names = [
        'ix_opportunities_status', 'ix_opportunities_organization_id', 'ix_opportunities_created_at',
        'ix_contacts_organization_id', 'ix_contacts_created_at',
        'ix_deliverables_status', 'ix_deliverables_tender_id', 'ix_deliverables_created_at',
        'ix_tenders_status', 'ix_tenders_created_at',
        'ix_workflow_instances_status', 'ix_workflow_instances_tender_id',
        'ix_workflow_steps_status', 'ix_workflow_steps_instance_id',
        'ix_agent_actions_status', 'ix_agent_actions_tender_id',
        'ix_audit_logs_created_at', 'ix_audit_logs_action',
        'ix_notifications_user_id', 'ix_notifications_created_at',
        'ix_organizations_status', 'ix_organizations_created_at',
    ]
    for name in index_names:
        try:
            op.drop_index(name)
        except Exception:
            pass
