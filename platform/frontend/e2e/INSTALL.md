# Installation Playwright — Windows / macOS / Linux

## Étape 1 — Installer les dépendances

```bash
# Dans platform/frontend/
npm install
```

## Étape 2 — Installer Playwright et les navigateurs

```bash
# Installe Chromium (le seul nécessaire par défaut)
npx playwright install chromium

# Si des dépendances système manquent (Linux/CI)
npx playwright install --with-deps chromium
```

> Sur **Windows**, `npx playwright install` fonctionne directement depuis PowerShell ou CMD.  
> Pas besoin d'autre chose.

## Étape 3 — Vérifier l'installation

```bash
npx playwright --version
# → Version 1.xx.x
```

## Étape 4 — Lancer les smoke tests

```bash
npm run test:e2e:smoke
```

---

## Commandes Windows (PowerShell ou CMD)

Toutes les commandes fonctionnent identiquement sur Windows grâce à `cross-env` :

```powershell
# Smoke tests (fast, no browser)
npm run test:e2e:smoke

# Voir le browser
npm run test:e2e:headed

# Suite complète
npm run test:e2e

# Rapport HTML
npm run test:e2e:report
```

## Variables d'environnement sur Windows

PowerShell :
```powershell
$env:E2E_ADMIN_EMAIL="admin@datasphere.test"
$env:E2E_API_URL="http://localhost:8000/api/v1"
npm run test:e2e:smoke
```

CMD :
```cmd
set E2E_ADMIN_EMAIL=admin@datasphere.test
set E2E_API_URL=http://localhost:8000/api/v1
npm run test:e2e:smoke
```

Ou créer un fichier `.env.test.local` à la racine de `platform/frontend/` :
```
E2E_API_URL=http://localhost:8000/api/v1
E2E_BASE_URL=http://localhost:5173
E2E_ADMIN_EMAIL=admin@datasphere.test
E2E_ADMIN_PASSWORD=Admin123456!
```

---

## Problème : 'playwright' n'est pas reconnu

Cause : `playwright` n'est pas dans le PATH.  
Solution : utiliser `npx playwright` (toujours disponible si Node.js est installé).

```bash
# ❌ Peut échouer sur Windows
playwright test

# ✅ Fonctionne partout
npx playwright test
```

Tous les scripts `npm run test:e2e:*` utilisent déjà `npx playwright` — pas besoin de configuration supplémentaire.

---

## Problème : 'E2E_HEADLESS' n'est pas reconnu

Cause : syntaxe Unix `VAR=value cmd` non supportée sur Windows.  
Solution : `cross-env` est installé et utilisé dans tous les scripts npm.

```bash
# ❌ Syntaxe Unix (ne marche pas sur Windows)
E2E_HEADLESS=false playwright test

# ✅ Via npm scripts (cross-env gère Windows)
npm run test:e2e:headed
```

---

## Problème : CORS errors dans la console

Voir la section CORS dans `README.md`.

**Résumé rapide** : ajouter dans `platform/backend/.env` :
```
APP_ENV=development
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```
