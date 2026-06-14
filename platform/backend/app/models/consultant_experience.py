"""
ConsultantExperience — Expériences professionnelles réelles des consultants

Stocke les vraies expériences de chaque consultant.
Injectées dans le prompt de génération CV pour remplacer les expériences fictives.
"""
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ForeignKey
from app.db.session import Base


class ConsultantExperience(Base):
    __tablename__ = "consultant_experiences"

    id            = Column(Integer, primary_key=True, index=True)

    # Owner — lié à l'utilisateur par email
    owner_email   = Column(String(255), nullable=False, index=True)

    # Expérience
    company       = Column(String(255), nullable=False)           # Nom de l'entreprise
    client_name   = Column(String(255), nullable=True)            # Nom du client final (si ESN)
    role          = Column(String(255), nullable=False)           # Titre du poste / rôle
    sector        = Column(String(120), nullable=True)            # Secteur du client
    location      = Column(String(120), nullable=True)            # Paris, Remote, etc.
    project_type  = Column(String(120), nullable=True)            # Data Lake, Migration, BI, etc.

    # Dates
    start_date    = Column(String(20), nullable=False)            # "2022-01" ou "01/2022"
    end_date      = Column(String(20), nullable=True)             # null = en cours
    is_current    = Column(Boolean, default=False, nullable=False)

    # Contenu
    context       = Column(Text, nullable=True)                   # Contexte mission (1-2 phrases)
    description   = Column(Text, nullable=False)                  # Description détaillée
    achievements  = Column(Text, nullable=True)                   # Réalisations (une par ligne)
    technologies  = Column(Text, nullable=True)                   # Stack séparée par virgules
    methodologies = Column(Text, nullable=True)                   # Agile, Scrum, etc.

    # Métadonnées
    is_highlight  = Column(Boolean, default=True,  nullable=False)  # Inclure dans le CV par défaut
    display_order = Column(Integer,  default=0,    nullable=False)   # Ordre d'affichage

    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
