# ARVEXA School - version corrigée

Ce dossier est la livraison finale destinée à Vercel/Firebase. Il contient une seule copie du site, les pages frontend, les routes API, les règles Firebase et les assets nécessaires.

## Points principaux

- Auth Firebase avec persistence locale.
- Page `auth-choice.html` pour distinguer inscription et connexion sans deviner le statut du visiteur.
- Dashboard et pages privées protégés après résolution de l'état Auth.
- API IA côté serveur uniquement.
- Quota et statut Premium vérifiés côté serveur.
- Cache des sujets et résultats dans Firestore.
- Planificateur Premium via `planificateur.html` et `/api/planner`.
- Règles Firestore et Storage incluses.

## Fichiers de référence

- `AUTH-FLOW.md` : parcours Auth et états de session.
- `SECURITY-AUDIT.md` : risques et corrections.
- `CORRECTIONS.md` : liste des modifications.
- `DEPLOYMENT.md` : configuration Vercel/Firebase et tests production.

## Sécurité

Ne committe jamais `.env`, un compte de service Firebase, une clé IA, un fichier `.pem` ou un fichier `.key`. Les secrets doivent rester dans Vercel Environment Variables.
