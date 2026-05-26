# Politique de securite

## Principes

- Aucun secret ne doit etre stocke dans le depot.
- Les fichiers .env reels sont interdits dans Git.
- Les exemples de variables doivent etre documentes dans .env.example.
- Les livrables clients doivent etre relus par un humain avant envoi.
- Les agents IA sont des assistants supervises, pas des decideurs autonomes.

## Donnees sensibles

Ne jamais commiter :

- mots de passe ;
- cles API ;
- tokens GitHub ;
- cles cloud ;
- donnees personnelles client ;
- documents confidentiels non anonymises.

## Validation

Toute evolution importante doit passer par :

1. une branche dediee ;
2. une Pull Request ;
3. une revue qualite ;
4. une validation humaine.
