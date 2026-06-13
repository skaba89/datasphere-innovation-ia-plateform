# DataSphere Innovation — Checklist Production Ready
# Version : 1.9.0 | Mise à jour : 2026-06-13

## ✅ ÉTAT ACTUEL — Ce qui est prêt

### Backend
- [x] 224 routes API / 36 modules / FastAPI 0.115
- [x] Authentification JWT (bcrypt passwords, expiry configuré)
- [x] Rate limiting (slowapi)
- [x] CORS configuré (env var CORS_ORIGINS)
- [x] ORM SQLAlchemy 2.0 (protection SQL injection)
- [x] 9 migrations Alembic (schéma DB versionné)
- [x] PostgreSQL 16 Frankfurt (Render managed)
- [x] Gunicorn + uvicorn workers (2 workers, plan free)
- [x] Docker multi-stage build (image allégée)
- [x] 1 295 tests (90%+ coverage sur les flux critiques)
- [x] Logging structuré
- [x] Health endpoint (/api/v1/health)
- [x] Webhook outgoing (events : tender, deliverable, opportunity)
- [x] Email notifications (SMTP configurable)
- [x] Audit logs (toutes les actions tracées)

### Frontend
- [x] 17 pages React 18 + TypeScript
- [x] 37 composants
- [x] Build optimisé : bundle principal 210 kB (–65%)
- [x] Code splitting en 10 chunks (vendor-react, i18n, pages-heavy, etc.)
- [x] i18n FR/EN (120 clés, persisté localStorage)
- [x] Headers sécurité (X-Frame-Options, CSP, Cache-Control)
- [x] SPA routing (toutes les routes → index.html)
- [x] CDN Render (assets avec max-age=31536000)

### Infrastructure
- [x] render.yaml Blueprint complet (db + backend + frontend)
- [x] PostgreSQL Frankfurt, plan free (→ starter en prod réelle)
- [x] Toutes les env vars déclarées dans render.yaml
- [x] Healthcheck Docker configuré
- [x] Redéploiement auto sur push main

---

## 🔴 À FAIRE AVANT GO-LIVE

### 1. Env vars Render — À renseigner dans le dashboard

```
SECRET_KEY           → déjà généré par Render (generateValue: true)
GROQ_API_KEY         → gsk_... (depuis console.groq.com)
GEMINI_API_KEY       → AIza... (depuis aistudio.google.com)
CORS_ORIGINS         → https://datasphere-frontend-n1mb.onrender.com
                        (ou votre domaine custom)
```

Optionnel mais recommandé :
```
SMTP_HOST            → smtp.gmail.com (ou Brevo/Sendgrid)
SMTP_PORT            → 587
SMTP_USER            → votre-email@gmail.com
SMTP_PASSWORD        → app password Gmail
STRIPE_SECRET_KEY    → sk_live_... (pour le billing)
```

### 2. Admin initial — Après le premier déploiement

```bash
# Une seule fois après le déploiement initial :
# 1. Activer SETUP_ENABLED=true dans Render
# 2. Appeler l'endpoint avec SETUP_SECRET_KEY :
curl -X POST https://datasphere-backend-zl3v.onrender.com/api/v1/setup/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{
    "token": "VOTRE_SETUP_SECRET_KEY",
    "email": "admin@datasphere-innovation.fr",
    "password": "VotreMotDePasse123!",
    "first_name": "Cheickna",
    "last_name": "KABA"
  }'
# 3. Remettre SETUP_ENABLED=false immédiatement
```

### 3. Base de données — Upgrade plan Render recommandé

Le plan free PostgreSQL Render :
- 1 GB stockage
- Expire après 90 jours d'inactivité
- Pas de backups automatiques

→ Passer à Starter (7$/mois) pour la production :
  - Backups automatiques quotidiens
  - 10 GB stockage
  - Pas d'expiration

### 4. Backend plan — Starter recommandé

Le plan free backend Render :
- Sleep après 15 min d'inactivité (cold start 30s)
- 512 MB RAM

→ Starter (7$/mois) : always-on, 512 MB RAM
→ Standard (25$/mois) : 2 GB RAM, custom domains

---

## 🟡 AMÉLIORATIONS POST GO-LIVE (priorité haute)

### Performance
- [ ] Pagination sur TOUS les endpoints GET (actuellement limit/skip non généralisé)
- [ ] Redis pour le cache des résultats LLM fréquents
- [ ] CDN Cloudflare devant Render (optionnel)

### Sécurité
- [ ] 2FA pour les admins (TOTP via libraire pyotp)
- [ ] Rotation automatique des JWT (refresh tokens)
- [ ] WAF (Web Application Firewall) — Cloudflare gratuit
- [ ] Audit log retention policy (RGPD — purge automatique après X mois)

### Observabilité
- [ ] Sentry (error tracking, ~$26/mois)
  ```python
  import sentry_sdk
  sentry_sdk.init(dsn="https://...", traces_sample_rate=0.1)
  ```
- [ ] Datadog ou Better Uptime (monitoring uptime)
- [ ] Alerts sur les erreurs 5xx (Render → notifications Slack)

### Business
- [ ] Domaine custom (datasphere-innovation.fr → CNAME vers Render)
- [ ] Certificat SSL custom (automatique avec Render + custom domain)
- [ ] Pages légales (CGU, Politique de confidentialité, Mentions légales)
- [ ] RGPD : bannière cookies si tracking actif

---

## 🟢 AMÉLIORATIONS POST GO-LIVE (priorité normale)

- [ ] Tests de charge (k6 ou Locust) — objectif : 100 req/s
- [ ] CI/CD GitHub Actions (lint + tests à chaque PR)
- [ ] Playwright E2E (tests UI automatisés)
- [ ] Storybook (documentation composants React)
- [ ] PWA / Service Worker (mode offline basique)
- [ ] Notifications push (Web Push API)
- [ ] Export PDF livrable (WeasyPrint configuré, vérifier en prod)
- [ ] LinkedIn OAuth2 (pour la publication automatique des posts)

---

## 📊 MÉTRIQUES ACTUELLES

| Métrique | Valeur | Cible prod |
|---|---|---|
| Routes API | 224 | ✅ |
| Tests | 1 295 | ✅ |
| Bundle JS (main) | 210 kB | ✅ (< 300 kB) |
| Bundle JS (charts) | 363 kB | ⚠️ chargé lazy |
| Pages React | 17 | ✅ |
| i18n | FR + EN | ✅ |
| Uptime (Render free) | ~99% | ⚠️ (cold start) |
| Cold start | ~30s | → 0 avec plan Starter |

---

## 🚀 CHECKLIST GO-LIVE (ordre d'exécution)

```
[ ] 1. Renseigner GROQ_API_KEY + GEMINI_API_KEY dans Render dashboard
[ ] 2. Vérifier CORS_ORIGINS correspond au vrai URL frontend
[ ] 3. Redéployer (git push origin main)
[ ] 4. Attendre que le service soit vert (healthcheck)
[ ] 5. Activer SETUP_ENABLED=true → créer l'admin → remettre false
[ ] 6. Tester login admin sur datasphere-frontend-n1mb.onrender.com
[ ] 7. Installer les 5 agents par défaut (POST /api/v1/agents/defaults/install)
[ ] 8. Configurer un provider LLM (Settings → Providers IA)
[ ] 9. Faire un test workflow complet (créer AO → lancer workflow → valider)
[ ] 10. Inviter les premiers utilisateurs (Settings → Équipe → Inviter)
```
