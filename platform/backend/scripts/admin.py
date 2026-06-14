#!/usr/bin/env python3
"""
DataSphere Innovation — CLI Admin Utilitaires
Usage : python scripts/admin.py <commande> [options]

Commandes :
  stats        Statistiques complètes de la plateforme
  reset-pwd    Réinitialiser le mot de passe d'un utilisateur
  list-users   Lister tous les utilisateurs actifs
  set-role     Changer le rôle d'un utilisateur
  check-db     Vérifier l'état de la base de données
  run-report   Générer et afficher le rapport hebdomadaire
  install-agents  Installer les agents par défaut
  export-data  Exporter les données en JSON (backup)

Exemple :
  python scripts/admin.py stats
  python scripts/admin.py reset-pwd --email admin@example.com --password Nouveau123!
  python scripts/admin.py set-role --email user@example.com --role manager
"""

import sys
import os
import argparse
import json
from datetime import datetime

# Bootstrap environment
os.environ.setdefault("APP_ENV", "production")
os.environ.setdefault("SCHEDULER_ENABLED", "false")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_db():
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        return db
    except Exception as e:
        print(f"❌ DB connection failed: {e}")
        sys.exit(1)


# ── Commande: stats ─────────────────────────────────────────────────────────

def cmd_stats(args):
    db = get_db()
    try:
        from app.models.user import User
        from app.models.tender import Tender
        from app.models.deliverable import Deliverable
        from app.models.agent import AgentProfile, AgentAction
        from app.models.opportunity import Opportunity
        from app.models.organization import Organization
        from app.models.workflow import WorkflowInstance

        users        = db.query(User).count()
        active_users = db.query(User).filter(User.is_active == True).count()
        tenders      = db.query(Tender).count()
        deliverables = db.query(Deliverable).count()
        approved_d   = db.query(Deliverable).filter(Deliverable.status == "approved").count()
        agents       = db.query(AgentProfile).count()
        actions      = db.query(AgentAction).count()
        opps         = db.query(Opportunity).count()
        orgs         = db.query(Organization).count()
        workflows    = db.query(WorkflowInstance).count()

        print("\n" + "="*50)
        print("  DataSphere Innovation — Statistiques")
        print("="*50)
        print(f"  👥 Utilisateurs       : {active_users}/{users} actifs")
        print(f"  🏢 Organisations      : {orgs}")
        print(f"  🎯 Opportunités       : {opps}")
        print(f"  📋 Appels d'offres    : {tenders}")
        print(f"  📝 Livrables          : {deliverables} ({approved_d} approuvés)")
        print(f"  🤖 Agents             : {agents}")
        print(f"  ⚡ Actions agents     : {actions}")
        print(f"  🔄 Workflows          : {workflows}")
        print("="*50)

        # LLM provider info
        try:
            from app.services.llm_service import provider_label
            print(f"  🧠 Provider actif     : {provider_label()}")
        except Exception:
            print("  🧠 Provider actif     : non configuré")

        print(f"  ⏰ Heure              : {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        print("="*50 + "\n")
    finally:
        db.close()


# ── Commande: reset-pwd ──────────────────────────────────────────────────────

def cmd_reset_pwd(args):
    db = get_db()
    try:
        from app.models.user import User
        from app.core.security import get_password_hash

        user = db.query(User).filter(User.email == args.email).first()
        if not user:
            print(f"❌ Utilisateur '{args.email}' non trouvé")
            sys.exit(1)

        user.hashed_password = get_password_hash(args.password)
        db.commit()
        print(f"✅ Mot de passe réinitialisé pour {args.email}")
    finally:
        db.close()


# ── Commande: list-users ─────────────────────────────────────────────────────

def cmd_list_users(args):
    db = get_db()
    try:
        from app.models.user import User
        users = db.query(User).order_by(User.created_at.desc()).all()
        print(f"\n{'Email':<40} {'Rôle':<15} {'Actif':<8} {'Créé'}")
        print("-" * 80)
        for u in users:
            created = u.created_at.strftime('%d/%m/%Y') if u.created_at else '?'
            print(f"  {u.email:<38} {u.role:<15} {'✅' if u.is_active else '❌':<8} {created}")
        print(f"\nTotal : {len(users)} utilisateur(s)\n")
    finally:
        db.close()


# ── Commande: set-role ───────────────────────────────────────────────────────

def cmd_set_role(args):
    VALID_ROLES = ["admin", "manager", "consultant", "viewer"]
    if args.role not in VALID_ROLES:
        print(f"❌ Rôle invalide. Valeurs acceptées : {', '.join(VALID_ROLES)}")
        sys.exit(1)

    db = get_db()
    try:
        from app.models.user import User
        user = db.query(User).filter(User.email == args.email).first()
        if not user:
            print(f"❌ Utilisateur '{args.email}' non trouvé")
            sys.exit(1)

        old_role = user.role
        user.role = args.role
        db.commit()
        print(f"✅ Rôle de {args.email} : {old_role} → {args.role}")
    finally:
        db.close()


# ── Commande: check-db ───────────────────────────────────────────────────────

def cmd_check_db(args):
    db = get_db()
    try:
        from sqlalchemy import text
        result = db.execute(text("SELECT 1")).scalar()
        assert result == 1
        print("✅ Connexion DB : OK")

        # Check migrations
        try:
            from alembic.runtime.migration import MigrationContext
            from alembic.script import ScriptDirectory
            from alembic.config import Config
            cfg = Config("alembic.ini")
            script = ScriptDirectory.from_config(cfg)
            ctx = MigrationContext.configure(db.bind)
            current = set(ctx.get_current_heads())
            head = set(script.get_heads())
            if current == head:
                print(f"✅ Migrations : à jour ({', '.join(current)})")
            else:
                print(f"⚠️  Migrations : en retard\n   Current: {current}\n   Head: {head}")
        except Exception as e:
            print(f"⚠️  Check migrations : {e}")

        # Tables count
        result = db.execute(text(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
            if "postgresql" in str(db.bind.url) else
            "SELECT count(*) FROM sqlite_master WHERE type='table'"
        )).scalar()
        print(f"✅ Tables : {result}")
    finally:
        db.close()


# ── Commande: install-agents ─────────────────────────────────────────────────

def cmd_install_agents(args):
    db = get_db()
    try:
        from app.models.agent import AgentProfile
        existing = db.query(AgentProfile).count()
        print(f"Agents existants : {existing}")

        from app.api.v1.endpoints.agents import install_default_agents_endpoint
        # Simpler: use the CRUD directly
        from app.crud.agent import get_default_agents_config
        configs = get_default_agents_config()
        created = 0
        for cfg in configs:
            exists = db.query(AgentProfile).filter(AgentProfile.slug == cfg["slug"]).first()
            if not exists:
                agent = AgentProfile(**cfg)
                db.add(agent)
                created += 1
        db.commit()
        print(f"✅ {created} agent(s) créé(s) (total : {existing + created})")
    except Exception as e:
        print(f"❌ Erreur : {e}")
    finally:
        db.close()


# ── Commande: export-data ────────────────────────────────────────────────────

def cmd_export_data(args):
    db = get_db()
    try:
        from app.models.tender import Tender
        from app.models.deliverable import Deliverable
        from app.models.organization import Organization

        data = {
            "exported_at": datetime.now().isoformat(),
            "organizations": [
                {"id": o.id, "name": o.name, "created_at": str(o.created_at)}
                for o in db.query(Organization).all()
            ],
            "tenders": [
                {"id": t.id, "title": t.title, "status": t.status,
                 "buyer_name": t.buyer_name, "created_at": str(t.created_at)}
                for t in db.query(Tender).all()
            ],
            "deliverables": [
                {"id": d.id, "title": d.title, "status": d.status,
                 "deliverable_type": d.deliverable_type, "created_at": str(d.created_at)}
                for d in db.query(Deliverable).all()
            ],
        }

        output_file = args.output or f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        total = len(data["organizations"]) + len(data["tenders"]) + len(data["deliverables"])
        print(f"✅ Export : {total} enregistrements → {output_file}")
    finally:
        db.close()


# ── Commande: run-report ─────────────────────────────────────────────────────

def cmd_run_report(args):
    db = get_db()
    try:
        from app.services.weekly_report import generate_weekly_report_html
        html = generate_weekly_report_html(db)
        output = args.output or "rapport_hebdo.html"
        with open(output, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"✅ Rapport généré → {output} ({len(html)} chars)")
    finally:
        db.close()


# ── CLI entrypoint ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="DataSphere Admin CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command")

    # stats
    sub.add_parser("stats", help="Statistiques de la plateforme")

    # reset-pwd
    p = sub.add_parser("reset-pwd", help="Réinitialiser mot de passe")
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)

    # list-users
    sub.add_parser("list-users", help="Lister les utilisateurs")

    # set-role
    p = sub.add_parser("set-role", help="Changer le rôle d'un utilisateur")
    p.add_argument("--email", required=True)
    p.add_argument("--role", required=True, choices=["admin","manager","consultant","viewer"])

    # check-db
    sub.add_parser("check-db", help="Vérifier l'état de la DB")

    # install-agents
    sub.add_parser("install-agents", help="Installer les agents IA par défaut")

    # export-data
    p = sub.add_parser("export-data", help="Exporter les données en JSON")
    p.add_argument("--output", help="Fichier de sortie (défaut: export_TIMESTAMP.json)")

    # run-report
    p = sub.add_parser("run-report", help="Générer le rapport hebdomadaire")
    p.add_argument("--output", help="Fichier de sortie (défaut: rapport_hebdo.html)")

    args = parser.parse_args()

    commands = {
        "stats":          cmd_stats,
        "reset-pwd":      cmd_reset_pwd,
        "list-users":     cmd_list_users,
        "set-role":       cmd_set_role,
        "check-db":       cmd_check_db,
        "install-agents": cmd_install_agents,
        "export-data":    cmd_export_data,
        "run-report":     cmd_run_report,
        "test-smtp":      cmd_test_smtp,
    }

    if not args.command or args.command not in commands:
        parser.print_help()
        sys.exit(0)

    commands[args.command](args)


if __name__ == "__main__":
    main()


# ── Commande: test-smtp ──────────────────────────────────────────────────────

def cmd_test_smtp(args):
    """Test la configuration SMTP en envoyant un email de test."""
    from app.core.config import get_settings
    settings = get_settings()

    if not settings.smtp_host:
        print("❌ SMTP_HOST non configuré dans les variables d'environnement")
        print("   Guide : https://github.com/skaba89/datasphere-innovation-ia-plateform/blob/main/PRODUCTION_CHECKLIST.md")
        return

    print(f"  SMTP Host     : {settings.smtp_host}")
    print(f"  SMTP Port     : {settings.smtp_port}")
    print(f"  SMTP User     : {settings.smtp_user}")
    print(f"  SMTP From     : {getattr(settings, 'smtp_from', '?')}")

    try:
        import smtplib
        from email.mime.text import MIMEText
        to = args.to or settings.smtp_user
        msg = MIMEText("<h1>✅ DataSphere SMTP Test</h1><p>Configuration email fonctionnelle !</p>", "html", "utf-8")
        msg["Subject"] = "[DataSphere] Test SMTP — Configuration OK"
        msg["From"]    = getattr(settings, 'smtp_from', settings.smtp_user)
        msg["To"]      = to

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port or 587) as s:
            s.starttls()
            if settings.smtp_user and settings.smtp_password:
                s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)

        print(f"✅ Email de test envoyé à {to}")
    except Exception as e:
        print(f"❌ Erreur SMTP : {e}")
        print("   Vérifiez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD dans Render")

