"""
Modèle ApiKey — gestion des clés d'API publique.

Permet aux utilisateurs de créer des clés d'API pour intégrer
DataSphere avec des outils tiers (Zapier, Make, scripts Python…).

Champs :
  - key_hash : SHA-256 du secret (jamais stocké en clair)
  - prefix   : ds_live_xxxx (visible pour identifier la clé)
  - scopes   : permissions (read:all, write:tenders, etc.)
  - last_used_at : pour détecter les clés inutilisées
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.db.session import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"),
                          nullable=True, index=True)

    name         = Column(String(100), nullable=False)           # "Zapier integration"
    prefix       = Column(String(20),  nullable=False, index=True)  # "ds_live_a1b2c3"
    key_hash     = Column(String(64),  nullable=False, unique=True)  # SHA-256 hex

    scopes       = Column(Text, nullable=False, default="read:all")
    # Space-separated scopes: read:all write:tenders write:deliverables

    is_active    = Column(Boolean, nullable=False, default=True)
    last_used_at = Column(DateTime, nullable=True)
    expires_at   = Column(DateTime, nullable=True)  # None = never expires

    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at   = Column(DateTime, default=datetime.utcnow,
                          onupdate=datetime.utcnow, nullable=False)
