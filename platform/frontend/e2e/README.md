# Tests E2E — DataSphere Innovation IA Platform

## Vue d'ensemble

Suite de tests End-to-End avec [Playwright](https://playwright.dev/) couvrant les 16 parcours obligatoires de la plateforme, de la connexion admin jusqu'à l'export des livrables.

---

## Structure des fichiers

```
platform/frontend/
├── e2e/
│   ├── helpers.ts              # ApiClient, factories, auth, navigation
│   ├── api-smoke.spec.ts       # Smoke tests API (rapides, sans browser)
│   ├── auth.spec.ts            # Login, logout, forgot password, session
│   ├── navigation.spec.ts      # Tous les onglets, tab switcher, search
│   ├── workflow.spec.ts        # Les 16 parcours obligatoires
│   └── ui-robustness.spec.ts   # Empty states, pas de crash, pas de 500
├── playwright.config.ts        # Configuration Playwright
├── .env.e2e.example            # Template variables d'environnement
└── package.json                # Scripts npm
```

---

## Prérequis

```bash
# Backend + PostgreSQL opérationnel
# Variables minimales dans .env ou environnement

# Installer Playwright
cd platform/frontend
npm install
npx playwright install chromium
```

---

## Lancement rapide

```bash
cd platform/frontend

# 1. Smoke tests API (fast, ~20s, no browser)
npm run test:e2e:smoke

# 2. Suite complète (headless)
npm run test:e2e

# 3. Voir les résultats
npm run test:e2e:report
```

---

## Commandes disponibles

| Commande | Description | Durée |
|---|---|---|
| `npm run test:e2e:smoke` | Smoke tests API uniquement | ~20s |
| `npm run test:e2e:auth` | Tests authentification | ~45s |
| `npm run test:e2e:nav` | Tests navigation | ~60s |
| `npm run test:e2e:workflow` | 16 parcours obligatoires | ~3min |
| `npm run test:e2e:robust` | Robustesse UI | ~60s |
| `npm run test:e2e` | Suite complète | ~5min |
| `npm run test:e2e:headed` | Voir le navigateur | — |
| `npm run test:e2e:debug` | Mode debug (PWDEBUG) | — |
| `npm run test:e2e:ui` | Interface Playwright UI | — |
| `npm run test:e2e:report` | Ouvrir le rapport HTML | — |
| `npm run test:e2e:ci` | Mode CI (GitHub reporter) | — |

---

## Variables d'environnement

Copier `.env.e2e.example` → `.env.e2e` et renseigner les valeurs.

| Variable | Défaut | Description |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | URL du frontend |
| `E2E_API_URL` | `http://localhost:8000/api/v1` | URL de l'API backend |
| `E2E_ADMIN_EMAIL` | `admin@datasphere.test` | Email admin pour les tests |
| `E2E_ADMIN_PASSWORD` | `Admin123456!` | Mot de passe admin |
| `E2E_HEADLESS` | `true` | `false` pour voir le browser |
| `E2E_SLOWMO` | `0` | Délai entre actions (ms) |
| `E2E_TIMEOUT` | `90000` | Timeout par test (ms) |

> ⚠ Ne jamais committer `.env.e2e`. Le `.gitignore` l'exclut automatiquement.

---

## Lancement avec docker-compose

```bash
# Démarrer l'infrastructure
docker compose up -d

# Attendre que le backend soit prêt
until curl -sf http://localhost:8000/api/v1/health; do sleep 2; done

# Lancer les tests
cd platform/frontend
E2E_BASE_URL=http://localhost:5173 \
E2E_API_URL=http://localhost:8000/api/v1 \
npm run test:e2e
```

---

## Architecture des tests

### Stratégie

- **API pour le setup** : créer les données (org, opp, tender…) via l'API est plus rapide et fiable que le faire via l'UI.
- **UI pour la vérification** : les tests UI vérifient que les données apparaissent correctement et que les interactions fonctionnent.
- **`injectAuth`** : injecte le JWT directement dans localStorage — évite de tester le formulaire de login à chaque test.
- **`loginUI`** : utilisé uniquement dans les tests qui testent le formulaire de login lui-même.

### Isolation des données

- `buildScenario()` crée un jeu de données complet (org → opp → tender → agents → assignment → action → deliverable).
- Le préfixe `E2E-{timestamp}` dans les noms permet d'identifier les données créées par les tests.
- Les tests utilisent `test.beforeAll` pour créer les données une fois par describe block.

### Pas de reset de base requis

Les tests créent leurs propres données avec des noms uniques. Ils ne dépendent pas d'un état initial particulier et ne nettoient pas après eux-mêmes (pour permettre l'inspection en cas d'échec).

Pour une base propre, relancer avec une DB vierge.

---

## Les 16 parcours couverts

| # | Parcours | Test | Méthode |
|---|---|---|---|
| 1 | Démarrage application | `1-2 · app loads` | UI |
| 2 | Connexion admin | `1-2 · bootstrap and login` | UI + API |
| 3 | Création organisation | `3 · create organisation` | API + UI |
| 4 | Création opportunité | `4 · create opportunity` | API + UI |
| 5 | Création AO | `5 · create tender` | API + UI |
| 6 | Ajout exigences AO | `6 · add requirements` | API |
| 7 | Installation profils consultants | `7 · install profiles` | API + UI |
| 8 | Création affectation agent | `8 · create assignment` | API + UI |
| 9 | Planification actions | `9 · plan actions` | API |
| 10 | Approbation action sensible | `10 · approve action` | API + UI |
| 11 | Lancement action | `11 · launch action` | API |
| 12 | Création livrable | `12 · create deliverable` | API + UI |
| 13 | Review livrable | `13 · review deliverable` | API + UI |
| 14 | Approbation livrable | `14 · approve deliverable` | API + UI |
| 15 | Export document | `15 · export document` | API + UI |
| 16 | Déconnexion | `16 · logout` | UI |

---

## Checklist CI

Avant chaque PR vers `main`, vérifier :

- [ ] `npm run test:e2e:smoke` → tous les smoke tests passent
- [ ] `npm run test:e2e:auth` → login/logout fonctionnent
- [ ] `npm run test:e2e:workflow` → les 16 parcours passent
- [ ] Aucun test `FAILED` dans le rapport HTML
- [ ] Aucune capture d'écran d'erreur dans `test-results/`
- [ ] Le CI GitHub Actions est vert sur la PR

---

## Débogage d'un test qui échoue

```bash
# Mode debug — ouvre l'inspecteur Playwright
npm run test:e2e:debug -- --grep "create organisation"

# Voir le browser
npm run test:e2e:headed -- --grep "login"

# Slowmo — ralentir pour observer
E2E_SLOWMO=500 npm run test:e2e:headed -- --grep "workflow"

# Ouvrir le rapport de la dernière exécution
npm run test:e2e:report
```

Les captures d'écran des tests échoués sont dans `test-results/`.  
Les traces Playwright (sur retry) sont dans `playwright-report/`.

---

## Ajouter un nouveau test

```typescript
// e2e/mon-test.spec.ts
import { test, expect } from '@playwright/test';
import { injectAuth, goToTab, api, createOrg } from './helpers';

test.describe('Ma nouvelle fonctionnalité', () => {
  test.beforeEach(async ({ context }) => {
    await injectAuth(context); // ← inject JWT, skip login form
  });

  test('fait quelque chose', async ({ page }) => {
    // Setup via API (fast)
    const org = await createOrg('Test Org');

    // Interact via UI (what we're testing)
    await page.goto('/');
    await page.waitForSelector('.root-switcher');
    await goToTab(page, 'Organisations');

    // Assert
    await expect(page.locator('body')).toContainText(org.name);
  });
});
```

---

## FAQ

**Q: Les tests échouent à cause du backend non démarré.**  
R: Lancer `docker compose up -d` ou `uvicorn app.main:app --reload` avant les tests.

**Q: `E2E_ADMIN_EMAIL` already bootstrapped (403).**  
R: Normal. `bootstrap()` est idempotent — 403 = admin existe déjà.

**Q: Les tests sont lents localement.**  
R: Utiliser `npm run test:e2e:smoke` pour les vérifications rapides. Ou augmenter `workers` dans `playwright.config.ts`.

**Q: Comment voir ce que le browser fait ?**  
R: `npm run test:e2e:headed` ou `npm run test:e2e:ui` pour l'interface Playwright.

**Q: Un test passe localement mais échoue en CI.**  
R: Vérifier les timings — CI est plus lent. Augmenter `E2E_TIMEOUT=120000`. Regarder les screenshots dans les artifacts GitHub Actions.
