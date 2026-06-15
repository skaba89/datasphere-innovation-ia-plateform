"""Fix updated_at NULL values on existing users

Revision ID: fix_updated_at_001
Revises: pgvector_001
Create Date: 2026-06-15

Certains comptes créés via bootstrap_admin avant les migrations complètes
ont updated_at = NULL (nullable=False sans server_default en DB).
Cette migration backfille les NULL avec created_at ou NOW().
"""
from alembic import op
import sqlalchemy as sa

revision = 'fix_updated_at_001'
down_revision = 'pgvector_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Backfill updated_at NULL → created_at (ou NOW() si created_at aussi NULL)
    op.execute("""
        UPDATE users
        SET updated_at = COALESCE(created_at, NOW())
        WHERE updated_at IS NULL
    """)
    # Idem pour les autres tables qui pourraient avoir le même problème
    for table in ('organizations', 'opportunities', 'contacts', 'deliverables', 'tenders'):
        try:
            op.execute(f"""
                UPDATE {table}
                SET updated_at = COALESCE(created_at, NOW())
                WHERE updated_at IS NULL
            """)
        except Exception:
            pass  # Table peut ne pas exister encore


def downgrade() -> None:
    pass  # Pas de rollback sur un backfill
