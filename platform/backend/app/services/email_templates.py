"""
Templates email HTML transactionnels — DataSphere Innovation

Tous les emails utilisent le même design système premium :
- Fond sombre (#060d1a) avec gradient subtil
- Typographie Inter
- Accent gold (#facc15)
- Compatible dark mode + clients email standards (Gmail, Outlook, Apple Mail)
"""
from __future__ import annotations
from datetime import date


# ── Base layout ───────────────────────────────────────────────────────────────

def _base(subject: str, body_html: str, preview: str = "") -> dict:
    """Retourne {subject, html, text} pour n'importe quel email."""

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<title>{subject}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  body {{ margin:0; padding:0; background:#060d1a; font-family:Inter,'Helvetica Neue',Arial,sans-serif; color:#f1f5f9; -webkit-font-smoothing:antialiased; }}
  .wrapper {{ max-width:600px; margin:0 auto; padding:32px 16px; }}
  .card {{ background:#0c1a32; border:1px solid rgba(148,163,184,.1); border-radius:20px; overflow:hidden; }}
  .card-header {{ padding:32px 36px 24px; background:linear-gradient(135deg,rgba(250,204,21,.08),rgba(37,99,235,.06)); border-bottom:1px solid rgba(148,163,184,.08); }}
  .logo {{ display:flex; align-items:center; gap:10px; margin-bottom:24px; }}
  .logo-icon {{ width:36px; height:36px; background:linear-gradient(135deg,rgba(250,204,21,.3),rgba(250,204,21,.08)); border:1.5px solid rgba(250,204,21,.3); border-radius:10px; display:flex; align-items:center; justify-content:center; }}
  .logo-name {{ font-size:16px; font-weight:900; letter-spacing:-.02em; color:#f1f5f9; }}
  .logo-sub  {{ font-size:11px; color:#64748b; letter-spacing:.06em; text-transform:uppercase; }}
  .card-body {{ padding:28px 36px; }}
  .card-footer {{ padding:20px 36px; border-top:1px solid rgba(148,163,184,.06); background:rgba(0,0,0,.2); }}
  h1 {{ font-size:22px; font-weight:900; letter-spacing:-.04em; margin:0 0 8px; color:#f1f5f9; line-height:1.2; }}
  h2 {{ font-size:16px; font-weight:700; margin:0 0 6px; color:#e2e8f0; }}
  p {{ font-size:14px; line-height:1.7; color:#94a3b8; margin:0 0 16px; }}
  .highlight {{ color:#f1f5f9; }}
  .gold {{ color:#facc15; }}
  .btn {{ display:inline-block; background:#facc15; color:#060d1a !important; font-weight:800; font-size:14px; padding:13px 28px; border-radius:10px; text-decoration:none; letter-spacing:-.02em; }}
  .btn-outline {{ display:inline-block; border:1.5px solid rgba(148,163,184,.2); color:#94a3b8 !important; font-weight:600; font-size:13px; padding:10px 22px; border-radius:9px; text-decoration:none; }}
  .badge {{ display:inline-block; padding:4px 12px; border-radius:99px; font-size:12px; font-weight:700; }}
  .badge-gold   {{ background:rgba(250,204,21,.1); color:#facc15; border:1px solid rgba(250,204,21,.2); }}
  .badge-green  {{ background:rgba(34,197,94,.1);  color:#22c55e; border:1px solid rgba(34,197,94,.2);  }}
  .badge-blue   {{ background:rgba(59,130,246,.1); color:#3b82f6; border:1px solid rgba(59,130,246,.2); }}
  .badge-red    {{ background:rgba(239,68,68,.1);  color:#ef4444; border:1px solid rgba(239,68,68,.2);  }}
  .info-box {{ background:rgba(255,255,255,.03); border:1px solid rgba(148,163,184,.08); border-radius:12px; padding:18px 20px; margin:16px 0; }}
  .info-row {{ display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid rgba(148,163,184,.05); font-size:13px; }}
  .info-row:last-child {{ border-bottom:none; }}
  .info-label {{ color:#475569; }}
  .info-value {{ color:#e2e8f0; font-weight:600; }}
  .divider {{ height:1px; background:rgba(148,163,184,.06); margin:20px 0; }}
  .footer-text {{ font-size:12px; color:#334155; line-height:1.6; }}
  .footer-link {{ color:#475569; text-decoration:underline; }}
</style>
</head>
<body>
{'<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">' + preview + '</div>' if preview else ''}
<div class="wrapper">
  <div class="card">
    <div class="card-header">
      <div class="logo">
        <div class="logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div>
          <div class="logo-name">DataSphere Innovation</div>
          <div class="logo-sub">IA Platform</div>
        </div>
      </div>
    </div>
    <div class="card-body">
      {body_html}
    </div>
    <div class="card-footer">
      <p class="footer-text">
        Cet email a été envoyé par <strong style="color:#64748b">DataSphere Innovation IA Platform</strong>.<br>
        Vous recevez cet email car vous êtes membre de la plateforme.<br>
        <a href="#" class="footer-link">Se désabonner</a> · <a href="#" class="footer-link">Politique de confidentialité</a>
      </p>
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#1e293b;margin-top:20px">
    © {date.today().year} DataSphere Innovation · Paris, France
  </p>
</div>
</body>
</html>"""
    return {"subject": subject, "html": html}


# ── Templates ─────────────────────────────────────────────────────────────────

def invitation_email(first_name: str, email: str, temp_password: str,
                     role: str, platform_url: str = "https://datasphere-frontend-n1mb.onrender.com") -> dict:
    """Email d'invitation pour un nouveau membre (avec MDP provisoire)."""
    role_labels = {"admin": "Administrateur", "manager": "Manager", "consultant": "Consultant", "viewer": "Observateur"}
    role_label = role_labels.get(role, role.capitalize())
    body = f"""
<h1>Bienvenue sur DataSphere, {first_name} 👋</h1>
<p>Votre compte a été créé. Voici vos informations de connexion :</p>
<div class="info-box">
  <div class="info-row"><span class="info-label">Email</span><span class="info-value">{email}</span></div>
  <div class="info-row"><span class="info-label">Mot de passe provisoire</span><span class="info-value" style="font-family:monospace;background:rgba(250,204,21,.08);padding:2px 8px;border-radius:5px;color:#facc15">{temp_password}</span></div>
  <div class="info-row"><span class="info-label">Rôle</span><span class="info-value"><span class="badge badge-gold">{role_label}</span></span></div>
</div>
<p>⚠️ <strong class="highlight">Vous devrez changer ce mot de passe</strong> dès votre première connexion — c'est obligatoire avant d'accéder à la plateforme.</p>
<div style="margin:24px 0">
  <a href="{platform_url}" class="btn">Accéder à la plateforme →</a>
</div>
<div class="divider"></div>
<p style="font-size:13px;color:#334155">Si vous n'attendiez pas cet email, contactez votre administrateur.</p>
"""
    return _base(
        f"Bienvenue sur DataSphere Innovation — Votre compte est prêt",
        body,
        f"Votre compte DataSphere a été créé. Connectez-vous avec le mot de passe provisoire."
    )


def password_reset_email(first_name: str, reset_url: str) -> dict:
    """Email de réinitialisation de mot de passe."""
    body = f"""
<h1>Réinitialisation du mot de passe</h1>
<p>Bonjour {first_name},</p>
<p>Nous avons reçu une demande de réinitialisation de votre mot de passe DataSphere. Cliquez sur le bouton ci-dessous :</p>
<div style="margin:28px 0">
  <a href="{reset_url}" class="btn">Réinitialiser mon mot de passe →</a>
</div>
<div class="info-box">
  <p style="margin:0;font-size:13px;color:#64748b">⏰ Ce lien est valable <strong style="color:#e2e8f0">30 minutes</strong>. Après expiration, vous devrez faire une nouvelle demande.</p>
</div>
<div class="divider"></div>
<p style="font-size:13px;color:#334155">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe reste inchangé.</p>
"""
    return _base("Réinitialisation de votre mot de passe DataSphere", body)


def deliverable_approved_email(first_name: str, deliverable_title: str,
                                approver_name: str, platform_url: str = "") -> dict:
    """Notification d'approbation d'un livrable."""
    body = f"""
<h1>Livrable approuvé ✅</h1>
<p>Bonjour {first_name},</p>
<p>Votre livrable a été <strong class="highlight">approuvé</strong> par <span class="gold">{approver_name}</span>.</p>
<div class="info-box">
  <div class="info-row"><span class="info-label">Livrable</span><span class="info-value">{deliverable_title}</span></div>
  <div class="info-row"><span class="info-label">Statut</span><span class="info-value"><span class="badge badge-green">Approuvé</span></span></div>
  <div class="info-row"><span class="info-label">Approuvé par</span><span class="info-value">{approver_name}</span></div>
</div>
<p>Le livrable est maintenant disponible pour export PDF/DOCX et peut être référencé dans vos prochaines propositions.</p>
{'<div style="margin:20px 0"><a href="' + platform_url + '" class="btn-outline">Voir le livrable →</a></div>' if platform_url else ''}
"""
    return _base(f"✅ Livrable approuvé — {deliverable_title}", body)


def workflow_approval_needed_email(first_name: str, tender_title: str,
                                    step_name: str, platform_url: str = "") -> dict:
    """Alerte : une étape workflow nécessite une validation humaine."""
    body = f"""
<h1>Validation requise ⏳</h1>
<p>Bonjour {first_name},</p>
<p>Une étape du workflow nécessite <strong class="highlight">votre approbation</strong> avant de continuer.</p>
<div class="info-box">
  <div class="info-row"><span class="info-label">Appel d'offres</span><span class="info-value">{tender_title}</span></div>
  <div class="info-row"><span class="info-label">Étape en attente</span><span class="info-value"><span class="badge badge-gold">{step_name}</span></span></div>
</div>
<p>Connectez-vous à la plateforme pour examiner et valider cette étape.</p>
<div style="margin:24px 0">
  <a href="{platform_url or '#'}" class="btn">Approuver maintenant →</a>
</div>
"""
    return _base(f"⏳ Validation requise — {tender_title}", body)


def weekly_report_email(data: dict) -> dict:
    """Rapport hebdomadaire automatique."""
    tenders     = data.get("tenders", {})
    deliverables = data.get("deliverables", {})
    agents      = data.get("agents", {})
    week_str    = date.today().strftime("%d/%m/%Y")

    body = f"""
<h1>Rapport hebdomadaire 📊</h1>
<p style="color:#64748b">Semaine du {week_str} · DataSphere Innovation IA Platform</p>

<h2 style="margin-top:24px">🎯 Appels d'offres</h2>
<div class="info-box">
  <div class="info-row"><span class="info-label">Total AOs</span><span class="info-value">{tenders.get('total',0)}</span></div>
  <div class="info-row"><span class="info-label">Go décidés</span><span class="info-value"><span class="badge badge-gold">{tenders.get('go_count',0)}</span></span></div>
  <div class="info-row"><span class="info-label">Deadlines cette semaine</span><span class="info-value" style="color:{'#ef4444' if tenders.get('deadlines_this_week',0)>0 else '#22c55e'}">{tenders.get('deadlines_this_week',0)}</span></div>
</div>

<h2 style="margin-top:20px">📄 Livrables</h2>
<div class="info-box">
  <div class="info-row"><span class="info-label">Total</span><span class="info-value">{deliverables.get('total',0)}</span></div>
  <div class="info-row"><span class="info-label">En révision</span><span class="info-value"><span class="badge badge-blue">{deliverables.get('in_review',0)}</span></span></div>
  <div class="info-row"><span class="info-label">Approuvés</span><span class="info-value"><span class="badge badge-green">{deliverables.get('approved',0)}</span></span></div>
</div>

<h2 style="margin-top:20px">🤖 Agents IA</h2>
<div class="info-box">
  <div class="info-row"><span class="info-label">Actions totales</span><span class="info-value">{agents.get('total_actions',0)}</span></div>
  <div class="info-row"><span class="info-label">En attente d'approbation</span><span class="info-value" style="color:{'#f59e0b' if agents.get('actions_pending_approval',0)>0 else '#22c55e'}">{agents.get('actions_pending_approval',0)}</span></div>
  <div class="info-row"><span class="info-label">Taux de complétion</span><span class="info-value">{agents.get('completion_rate',0):.0f}%</span></div>
</div>

<div style="margin:24px 0">
  <a href="https://datasphere-frontend-n1mb.onrender.com" class="btn">Accéder au dashboard →</a>
</div>
"""
    return _base(f"📊 Rapport hebdomadaire DataSphere — {week_str}", body)


def deadline_alert_email(first_name: str, tenders_near: list[dict]) -> dict:
    """Alerte deadline AOs imminents."""
    items_html = ""
    for t in tenders_near[:5]:
        days = t.get("days_left", 0)
        color = "#ef4444" if days <= 3 else "#f59e0b"
        items_html += f"""
        <div class="info-row">
          <span class="info-label" style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t.get('title','')[:60]}</span>
          <span class="info-value" style="color:{color}">J-{days}</span>
        </div>"""

    body = f"""
<h1>⚠️ Deadlines AOs imminentes</h1>
<p>Bonjour {first_name},</p>
<p>Les appels d'offres suivants arrivent à échéance prochainement :</p>
<div class="info-box">{items_html}</div>
<p>Vérifiez l'état de vos dossiers et finalisez vos réponses dans les temps.</p>
<div style="margin:20px 0">
  <a href="https://datasphere-frontend-n1mb.onrender.com" class="btn">Voir les AOs →</a>
</div>
"""
    return _base(f"⚠️ {len(tenders_near)} deadline(s) AO imminente(s)", body)

# ── Resend fallback (alternative à SMTP) ─────────────────────────────────────
# Si RESEND_API_KEY est défini, utiliser l'API Resend (gratuit 3000 emails/mois)
# https://resend.com → créer un compte → copier l'API key dans Render env vars
#
# Pour activer: ajouter RESEND_API_KEY=re_xxxx dans Render environment variables
# Pas besoin de configurer SMTP_HOST/USER/PASSWORD

def _send_via_resend(to: str, subject: str, html: str) -> bool:
    """Envoie un email via l'API Resend si RESEND_API_KEY est configuré."""
    import os, urllib.request, json
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return False
    try:
        payload = json.dumps({
            "from": "DataSphere Innovation <noreply@datasphere-innovation.fr>",
            "to": [to],
            "subject": subject,
            "html": html,
        }).encode()
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        import logging
        logging.getLogger("datasphere.email").warning("Resend failed: %s", e)
        return False
