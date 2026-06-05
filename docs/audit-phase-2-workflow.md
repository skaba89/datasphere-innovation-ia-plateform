# Audit Phase 2 — Workflow métier DataSphere

Branche de travail : `fix/responsive-stability-ui`

## Corrections déjà appliquées

- Stabilisation des versions frontend.
- Ajout de la couche responsive globale.
- Dashboard rendu adaptatif.
- CRM rendu plus robuste.
- Protection anti double soumission sur organisations.
- Protection anti double soumission sur opportunités.
- API client renforcé : refresh token, upload avec retry, erreurs FastAPI normalisées.
- Automatisation AO : validation de l'identifiant tender avant appel API.

## Points restants à appliquer sur `TenderWorkspace.tsx`

Le remplacement complet du fichier a été refusé par l'outil de patch. Les modifications à appliquer sont donc documentées ici pour exécution en petits commits.

### 1. Ajouter les états de soumission

```ts
const [isCreatingTender, setIsCreatingTender] = useState(false);
const [isCreatingRequirement, setIsCreatingRequirement] = useState(false);
const [isCreatingCriterion, setIsCreatingCriterion] = useState(false);
const [isCreatingCompliance, setIsCreatingCompliance] = useState(false);
```

### 2. Protéger `createTender`

```ts
if (isCreatingTender) return;
setIsCreatingTender(true);
...
finally { setIsCreatingTender(false); }
```

### 3. Protéger `createRequirement`

```ts
if (!selectedTenderId || isCreatingRequirement) return;
setIsCreatingRequirement(true);
...
finally { setIsCreatingRequirement(false); }
```

### 4. Protéger `createCriterion`

```ts
if (!selectedTenderId || isCreatingCriterion) return;
setIsCreatingCriterion(true);
...
finally { setIsCreatingCriterion(false); }
```

### 5. Protéger `createComplianceItem`

```ts
if (!selectedTenderId || isCreatingCompliance) return;
setIsCreatingCompliance(true);
...
finally { setIsCreatingCompliance(false); }
```

### 6. Désactiver les formulaires pendant les enregistrements

Chaque champ du formulaire concerné doit recevoir :

```tsx
disabled={isCreatingTender}
disabled={isCreatingRequirement}
disabled={isCreatingCriterion}
disabled={isCreatingCompliance}
```

Les boutons doivent afficher :

```tsx
{isCreatingTender ? 'Création…' : "Créer appel d'offres"}
{isCreatingRequirement ? 'Ajout…' : 'Ajouter exigence'}
{isCreatingCriterion ? 'Ajout…' : 'Ajouter critère'}
{isCreatingCompliance ? 'Ajout…' : 'Ajouter conformité'}
```

## Points restants sur `FileAttachments.tsx`

### Upload

Ajouter une garde en haut de `handleUpload` :

```ts
if (uploading) return;
```

Désactiver l'input :

```tsx
disabled={uploading}
```

Ajouter `aria-busy={uploading}` sur le wrapper principal.

## Prochaines améliorations recommandées

- Extraire les formulaires AO en composants dédiés.
- Ajouter React Hook Form + Zod.
- Ajouter TanStack Query pour cache, invalidation et retry.
- Ajouter recherche, tri et pagination sur organisations, opportunités, appels d'offres, exigences et conformité.
