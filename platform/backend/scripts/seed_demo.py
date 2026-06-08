#!/usr/bin/env python3
"""
DataSphere — Script de données démo

Crée un jeu de données réaliste pour :
  - Onboarding de nouveaux clients
  - Tests manuels (sans dépendance à un état manuel)
  - Démo commerciale

Usage :
    cd platform/backend
    python scripts/seed_demo.py              # Crée tout
    python scripts/seed_demo.py --reset      # Supprime et recrée
    python scripts/seed_demo.py --dry-run    # Affiche sans créer
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DEMO_ENV_DEFAULTS = {
    "DATABASE_URL": "postgresql+psycopg2://datasphere:change-me@localhost:5432/datasphere_platform",
    "SECRET_KEY": "demo-seed-script-key",
    "SCHEDULER_ENABLED": "false",
}
for k, v in DEMO_ENV_DEFAULTS.items():
    os.environ.setdefault(k, v)


def run(dry_run: bool = False) -> None:
    from app.db.session import SessionLocal, Base, engine
    from app.models import *  # noqa — register all models

    if not dry_run:
        Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        _seed_users(db, dry_run)
        _seed_organizations(db, dry_run)
        _seed_opportunities(db, dry_run)
        _seed_tenders(db, dry_run)
        _seed_agents(db, dry_run)
        print("\n✅ Données démo créées avec succès")
    finally:
        db.close()


# ── Users ─────────────────────────────────────────────────────────────────────

def _seed_users(db, dry_run: bool) -> None:
    from app.crud.user import count_users, create_user, get_user_by_email
    from app.schemas.user import UserCreate

    users = [
        {"email": "admin@datasphere.demo", "password": "Admin123456!", "first_name": "Cheickna",  "last_name": "KABA",    "role": "admin"},
        {"email": "manager@datasphere.demo","password": "Manager123!",  "first_name": "Mamadou",  "last_name": "Diallo",  "role": "manager"},
        {"email": "consultant@datasphere.demo","password":"Consult123!","first_name": "Fatoumata","last_name": "Bah",     "role": "consultant"},
    ]

    for u in users:
        if dry_run:
            print(f"  [DRY-RUN] Would create user: {u['email']}")
            continue
        if not get_user_by_email(db, u["email"]):
            create_user(db, UserCreate(**u, is_active=True))
            print(f"  ✓ User: {u['email']}")
        else:
            print(f"  → Skip (exists): {u['email']}")


# ── Organizations ─────────────────────────────────────────────────────────────

def _seed_organizations(db, dry_run: bool) -> None:
    from app.crud.organization import create_organization
    from app.schemas.organization import OrganizationCreate

    orgs = [
        {"name": "Ministère du Numérique — Guinée",  "country": "GN", "sector": "Public"},
        {"name": "Banque Centrale de la République de Guinée (BCRG)", "country": "GN", "sector": "Finance"},
        {"name": "Orange Guinée",                     "country": "GN", "sector": "Télécoms"},
        {"name": "Société Générale Guinée",           "country": "GN", "sector": "Finance"},
        {"name": "Total Energies Guinée",             "country": "GN", "sector": "Énergie"},
        {"name": "Groupe Bolloré Africa",             "country": "SN", "sector": "Logistique"},
    ]

    for o in orgs:
        if dry_run:
            print(f"  [DRY-RUN] Would create org: {o['name']}")
            continue
        try:
            create_organization(db, OrganizationCreate(**o))
            print(f"  ✓ Org: {o['name']}")
        except Exception:
            print(f"  → Skip (exists): {o['name']}")


# ── Opportunities ─────────────────────────────────────────────────────────────

def _seed_opportunities(db, dry_run: bool) -> None:
    from sqlalchemy import text
    from app.crud.opportunity import create_opportunity
    from app.schemas.opportunity import OpportunityCreate

    # Get org IDs
    orgs = db.execute(text("SELECT id, name FROM organizations LIMIT 6")).fetchall()
    if not orgs:
        print("  → Skip opportunities: no orgs found")
        return

    opps_data = [
        {"title": "Plateforme Data nationale",  "status": "Qualification", "probability": 75, "potential_value": 800_000},
        {"title": "Migration ERP Oracle → Cloud","status": "Proposition",  "probability": 55, "potential_value": 350_000},
        {"title": "Audit SI & Data Governance",  "status": "Négociation",  "probability": 85, "potential_value": 180_000},
        {"title": "BI & Reporting direction",    "status": "Prospect identifié","probability": 30,"potential_value": 95_000},
        {"title": "Data Lake Télécoms",          "status": "Qualification", "probability": 60, "potential_value": 450_000},
    ]

    for i, opp_d in enumerate(opps_data):
        org = orgs[i % len(orgs)]
        if dry_run:
            print(f"  [DRY-RUN] Would create opp: {opp_d['title']}")
            continue
        try:
            create_opportunity(db, OpportunityCreate(
                organization_id=org.id,
                **opp_d,
            ))
            print(f"  ✓ Opportunity: {opp_d['title']}")
        except Exception as e:
            print(f"  → Skip: {opp_d['title']} ({e})")


# ── Tenders ───────────────────────────────────────────────────────────────────

def _seed_tenders(db, dry_run: bool) -> None:
    from sqlalchemy import text
    from app.crud.tender import create_tender
    from app.schemas.tender import TenderCreate

    opps = db.execute(text("SELECT id FROM opportunities LIMIT 3")).fetchall()
    if not opps:
        print("  → Skip tenders: no opportunities found")
        return

    tenders = [
        {"title": "AO Data Platform BCRG 2026",           "reference": "BCRG-2026-001", "buyer_name": "BCRG", "status": "go"},
        {"title": "Appel d'offres SI Ministère Numérique", "reference": "MN-GN-2026-12", "buyer_name": "Min. Numérique GN", "status": "draft"},
        {"title": "Consultant Data Governance Orange GN",  "reference": "OGN-DG-2026-3", "buyer_name": "Orange Guinée", "status": "submitted"},
    ]

    for i, t in enumerate(tenders):
        opp = opps[i % len(opps)]
        if dry_run:
            print(f"  [DRY-RUN] Would create tender: {t['title']}")
            continue
        try:
            create_tender(db, TenderCreate(opportunity_id=opp.id, **t))
            print(f"  ✓ Tender: {t['title']}")
        except Exception as e:
            print(f"  → Skip: {t['title']} ({e})")


# ── Agents ────────────────────────────────────────────────────────────────────

def _seed_agents(db, dry_run: bool) -> None:
    from app.crud.agent import install_default_profiles

    if dry_run:
        print("  [DRY-RUN] Would install default agent profiles")
        return
    try:
        agents = install_default_profiles(db)
        print(f"  ✓ Agents: {len(agents)} profils installés")
    except Exception as e:
        print(f"  → Skip agents: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DataSphere Demo Seed")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be created without executing")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables first")
    args = parser.parse_args()

    if args.reset:
        print("⚠  Reset mode: cela supprime toutes les données existantes.")
        confirm = input("Confirmer ? (yes/N): ")
        if confirm.lower() != "yes":
            print("Annulé.")
            sys.exit(0)
        from app.db.session import Base, engine
        import app.models  # noqa
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("✓ Tables recréées")

    run(dry_run=args.dry_run)
