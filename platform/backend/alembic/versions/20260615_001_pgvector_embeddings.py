"""Add pgvector extension and deliverable_embeddings table

Revision ID: pgvector_001
Revises: consultant_exp_001
Create Date: 2026-06-15

Ajoute l'extension pgvector et la table deliverable_embeddings pour le RAG vectoriel.
Nécessite que l'extension vector soit disponible sur le serveur PostgreSQL (Render: oui par défaut).
Fallback gracieux si l'extension n'est pas disponible (TF-IDF reste actif).
"""
from alembic import op
import sqlalchemy as sa

revision = 'pgvector_001'
down_revision = 'consultant_exp_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Activer pgvector — gracieux si indisponible (PostgreSQL sans extension)
    try:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    except Exception as e:
        import warnings
        warnings.warn(
            f"pgvector extension unavailable ({e}). "
            "RAG fallback to TF-IDF will remain active. "
            "To enable vector search, use PostgreSQL with pgvector support."
        )
        return  # Table pas créée si pas d'extension

    # Table principale des embeddings
    op.create_table(
        'deliverable_embeddings',
        sa.Column('id',           sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('deliverable_id', sa.Integer(), sa.ForeignKey('deliverables.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('chunk_index',  sa.Integer(), nullable=False, default=0),
        sa.Column('chunk_text',   sa.Text(),    nullable=False),
        sa.Column('provider',     sa.String(50), nullable=False, default='openai'),
        sa.Column('model',        sa.String(100), nullable=False, default='text-embedding-3-small'),
        sa.Column('embedding',    sa.Text(), nullable=True),  # JSON fallback si pas de pgvector
        sa.Column('created_at',   sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Essai d'ajout colonne vector native (Render PostgreSQL a pgvector)
    try:
        op.execute("""
            ALTER TABLE deliverable_embeddings
            ADD COLUMN IF NOT EXISTS embedding_vector vector(1536)
        """)
        # Index HNSW pour recherche approximate nearest neighbor
        op.execute("""
            CREATE INDEX IF NOT EXISTS idx_deliverable_embeddings_vector
            ON deliverable_embeddings
            USING hnsw (embedding_vector vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        """)
    except Exception:
        pass  # Reste sans index vectoriel natif

    # Index standard
    try:
        op.create_index('idx_emb_deliverable_id', 'deliverable_embeddings', ['deliverable_id'])
        op.create_index('idx_emb_provider', 'deliverable_embeddings', ['provider'])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_table('deliverable_embeddings')
    except Exception:
        pass
    try:
        op.execute("DROP EXTENSION IF EXISTS vector")
    except Exception:
        pass
