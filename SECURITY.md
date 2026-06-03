# Politique de sécurité — DataSphere Innovation IA Platform

## Versions supportées

| Version | Support sécurité |
|---|---|
| 1.8.x (current) | ✅ Active |
| < 1.7.0 | ❌ Non supportée |

## Signaler une vulnérabilité

**Ne pas ouvrir d'issue publique GitHub pour une vulnérabilité de sécurité.**

Contacter directement : contact@datasphere-innovation.fr

Nous nous engageons à répondre sous **48h** et à publier un correctif sous **7 jours** pour les vulnérabilités critiques.

## Mesures de sécurité en place

### Authentification
- JWT access tokens (60 min) + refresh tokens (30 jours)
- Passwords hashés avec bcrypt (12 rounds)
- Rate limiting sur le login : 10 tentatives/minute par IP

### Autorisation (RBAC)
- 4 niveaux : admin / manager / consultant / viewer
- Toutes les routes protégées par `get_current_user` ou `_require_admin`
- Seules routes publiques : `/health`, `/contact`, `/auth/login`,
  `/auth/bootstrap-admin`, `/auth/forgot-password`,
  `/auth/reset-password`, `/auth/refresh`

### Protection des données
- Aucun secret dans le code source (tout via `.env`)
- `.env` et `.env.prod` exclus du versioning
- CORS restreint aux origines configurées dans `CORS_ORIGINS`
- Uploads filtrés par extension whitelist + MIME type, 20 MB max
- Aucun SQL brut dans l'application (100% SQLAlchemy ORM)

### Infrastructure
- HTTPS en production (Let's Encrypt)
- Backups PostgreSQL quotidiens avec rotation 14 jours
- HEALTHCHECK Docker sur toutes les images

## Générer une SECRET_KEY sécurisée

```bash
openssl rand -hex 64
```

Ne jamais committer `.env` ou `.env.prod` dans Git.
