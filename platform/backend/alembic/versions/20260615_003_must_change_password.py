"""Add must_change_password column to users

Revision ID: must_change_pwd_001
Revises: fix_updated_at_001
Create Date: 2026-06-15

Permet à l'admin de créer un compte avec un MDP provisoire.
L'user est forcé de le changer à sa première connexion.
"""
from alembic import op
import sqlalchemy as sa

revision = 'must_change_pwd_001'
down_revision = 'fix_updated_at_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'must_change_password',
            sa.Boolean(),
            nullable=False,
            server_default='false',
        ),
    )
    # Index pour les requêtes de monitoring
    op.create_index(
        'idx_users_must_change_password',
        'users',
        ['must_change_password'],
        postgresql_where=sa.text('must_change_password = true'),
    )


def downgrade() -> None:
    op.drop_index('idx_users_must_change_password', table_name='users')
    op.drop_column('users', 'must_change_password')
