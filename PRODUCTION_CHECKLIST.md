# DataSphere Innovation IA Platform — Production Checklist

Score actuel : **82%** — Version : **v2.3.1**

---

## ✅ Déjà en place (ne pas toucher)

- [x] JWT auth + bcrypt + rate limiting par user
- [x] CORS configuré (CORS_ORIGINS dans Render)
- [x] HTTPS automatique (Render)
- [x] SETUP_ENABLED=false (sécurisé)
- [x] SCHEDULER_ENABLED=true (BOAMP 6h actif)
- [x] GZip compression (économie ~70% bandwidth)
- [x] Cache analytics 60s (PostgreSQL non surchargé)
- [x] 22 index DB (requêtes perf01)
- [x] 1 444 tests unitaires + 16 E2E Playwright
- [x] CI/CD GitHub Actions (auto-test sur push)
- [x] Sentry error tracking (configurer SENTRY_DSN)
- [x] Health endpoint public `/api/v1/health`
- [x] Alembic migrations (1 seul head : user_extra_data_001)
- [x] Fallback login anti-crash (extra_data)
- [x] Endpoint fix-db d'urgence

---

## 🔴 CRITIQUE — Faire avant tout lancement client

### 1. SMTP Email (30 min)

Sans SMTP : le rapport hebdo lundi 8h ne part pas. Les alertes BOAMP > 70 non notifiées.

**Solution recommandée : Brevo (gratuit — 300 emails/jour)**

1. Créer compte sur https://app.brevo.com
2. Settings → SMTP & API → Générer une clé SMTP
3. Dans Render Dashboard → Environment :
   ```
   SMTP_HOST     = smtp-relay.brevo.com
   SMTP_PORT     = 587
   SMTP_USER     = votre@email.com
   SMTP_PASSWORD = votre-cle-smtp-brevo
   SMTP_FROM     = noreply@datasphere-innovation.fr
   ```
4. Tester : `curl -X POST https://datasphere-backend-zl3v.onrender.com/api/v1/reports/weekly/send`

### 2. Backup PostgreSQL (10 min)

Render free plan = pas de backup automatique.

- Render Dashboard → Votre PostgreSQL → **Backups** → Enable daily backups
- OU exporter hebdo avec : `python scripts/admin.py export-data --output backup_$(date +%Y%m%d).json`

### 3. Sentry DSN (15 min)

Les erreurs production ne sont pas trackées sans ça.

1. https://sentry.io → New Project → Python/FastAPI
2. Copier le DSN
3. Render : `SENTRY_DSN = https://xxxxx@sentry.io/yyyyy`

---

## 🟠 IMPORTANT — Faire dans les 7 jours

### 4. Domaine personnalisé

- Acheter `datasphere-innovation.fr` (OVH ~10€/an)
- Render → Custom Domain → Ajouter le domaine
- Mettre à jour `CORS_ORIGINS` et `LINKEDIN_REDIRECT_URI`

### 5. Clé Stripe live mode

Actuellement en mode test. Pour facturer :
- Stripe Dashboard → Switch to live mode
- Remplacer `STRIPE_SECRET_KEY` (sk_test_ → sk_live_)
- Remplacer `STRIPE_WEBHOOK_SECRET`
- Tester un checkout complet

### 6. Sécuriser le SECRET_KEY

Générer une clé forte si pas déjà fait :
```bash
openssl rand -base64 32
```
→ Render : `SECRET_KEY = <résultat>`

---

## 🟡 QUALITÉ — Dans les 30 jours

### 7. ESLint + lint CI
```bash
cd platform/frontend && npm run lint
```
→ Ajouter `npm run lint` dans `.github/workflows/ci.yml`

### 8. Monitoring Uptime
- https://uptimerobot.com (gratuit) → surveiller `/api/v1/health`
- Alert email si down > 5 min

### 9. Performance audit
```bash
# Lighthouse audit
npx lighthouse https://datasphere-frontend-n1mb.onrender.com --view
```
Objectif : Score > 80 performance, > 90 accessibility

### 10. Variables d'env complètes dans Render

Variables à configurer (si pas encore fait) :
```
GROQ_API_KEY          = gsk_...          # LLM gratuit — OBLIGATOIRE
GEMINI_API_KEY        = AIza...          # LLM secondaire gratuit
BOAMP_KEYWORDS        = data informatique numérique IA  # Déjà configuré
BOAMP_SCORE_THRESHOLD = 70               # Déjà configuré
SENTRY_DSN            = https://...      # Error tracking
SMTP_HOST             = smtp-relay.brevo.com
STRIPE_SECRET_KEY     = sk_live_...      # Billing prod
LINKEDIN_CLIENT_ID    = ...              # OAuth LinkedIn
```

---

## 🔧 Commandes utiles en production

```bash
# Stats plateforme
python platform/backend/scripts/admin.py stats

# Reset mot de passe admin
python platform/backend/scripts/admin.py reset-pwd \
  --email admin@datasphere-innovation.fr \
  --password NouveauMotDePasse123!

# Backup JSON
python platform/backend/scripts/admin.py export-data \
  --output backup_$(date +%Y%m%d).json

# Vérifier la DB
python platform/backend/scripts/admin.py check-db

# Installer les agents par défaut
python platform/backend/scripts/admin.py install-agents

# Rapport hebdo manuel
python platform/backend/scripts/admin.py run-report

# Fix DB d'urgence (si migration rate)
curl -X POST https://datasphere-backend-zl3v.onrender.com/api/v1/setup/fix-db

# Diagnostic login
curl https://datasphere-backend-zl3v.onrender.com/api/v1/auth/diagnose-login
```

---

## 📊 État technique v2.3.1

```
Routes API    : 248     Tests         : 1 444+
Pages React   : 20      E2E Playwright : 17 specs
Composants    : 42+     Migrations     : 11
Bundle JS     : 210kB   Index DB       : 22
PRs mergées   : #98→#116 Sprints       : 1→13
Login         : ✅ (hotfix #114 appliqué)
Navigation    : ✅ Sidebar premium + mobile
```

---

## 🚦 Checklist go-live (15 min avant lancement)

- [ ] `curl https://datasphere-backend-zl3v.onrender.com/api/v1/health` → `"status": "ok"`
- [ ] `curl https://datasphere-backend-zl3v.onrender.com/api/v1/auth/diagnose-login` → tous `ok`
- [ ] Login avec admin@datasphere-innovation.fr → succès
- [ ] BOAMP scan visible dans Opérations → Scheduler
- [ ] Rapport hebdo preview → `GET /api/v1/reports/weekly/preview` → HTML valide
- [ ] Au moins 1 email de test reçu (SMTP configuré)
- [ ] Sentry Dashboard → aucune erreur 500 en cours
