# Guide de contribution — DataSphere Innovation IA Platform

## Workflow

```
main  ←  PR  ←  feature/branch  ←  local development
```

1. **Créer une branche** depuis `main` : `git checkout -b platform/ma-feature`
2. **Développer** en small commits
3. **Tester** localement avant push
4. **Ouvrir une PR** vers `main`
5. **CI doit passer** avant merge

---

## Standards de code

### Backend (Python)

- Python 3.12+
- Formater avec `ruff format` et linter avec `ruff check`
- Typage complet (pas de `Any` implicite)
- Chaque endpoint doit avoir :
  - `response_model=` explicite
  - `status_code=` explicite (201 pour création, 200 pour lecture, etc.)
  - `Depends(get_current_user)` ou `Depends(_require_admin)` (pas de route publique accidentelle)
- Chaque CRUD function → un test dans `tests/`

### Frontend (TypeScript/React)

- TypeScript strict (pas de `any` sauf justification)
- Chaque composant avec appel API doit avoir :
  - State `loading` + `error`
  - Empty state si liste vide
  - Message d'erreur visible si la requête échoue
- Utiliser `getUserName()` depuis `api/userContext.ts` (jamais de noms hardcodés)

---

## Tests

### Règles

- Tout bug corrigé → test ajouté qui reproduit le bug
- Nouveau endpoint → test dans `test_platform.py` ou fichier dédié
- Couvrir les cas d'erreur : 401, 403, 404, 422

### Lancer les tests

```bash
cd platform/backend
python -m pytest tests/ -q          # Tous les tests
python -m pytest tests/ -k auth     # Tests auth uniquement
python -m pytest tests/ --tb=short  # Verbose errors
```

---

## PR checklist

Avant d'ouvrir une PR, vérifier :

- [ ] `python -m pytest tests/ -q` → tous les tests passent
- [ ] `cd platform/frontend && npm run build` → build sans erreur TypeScript
- [ ] Aucun nom hardcodé (Sekouna, admin@example.com, changeme)
- [ ] Aucune clé API hardcodée
- [ ] Les nouvelles routes ont `status_code=` explicite
- [ ] Les nouvelles routes ont `Depends(get_current_user)` ou sont explicitement publiques
- [ ] Les nouveaux composants React ont error + loading + empty states
- [ ] Le CHANGELOG est mis à jour si fonctionnalité majeure

---

## Architecture décisionnelle

### Gouvernance IA (immuable)

`AgentAction.requires_human_approval=True` → **jamais exécuté automatiquement**.  
Les suggestions IA ont `validation_status="pending"` → **invisibles du CRM normal**.

### Pas de features gadget

Chaque fonctionnalité doit répondre à un vrai besoin business.  
Priorité : stabilité > performance > nouvelles fonctionnalités.

### Base de données

- Toujours passer par SQLAlchemy ORM
- Toujours créer une migration Alembic pour les changements de schéma
- Jamais de `db.execute("raw SQL...")` dans l'application

---

## Signaler un bug

Ouvrir une issue GitHub avec :
1. Description du comportement observé
2. Comportement attendu
3. Steps to reproduce
4. Logs backend / screenshot frontend
