# Corrections appliquees

- Ajout de `auth-choice.html` pour separer proprement inscription et connexion.
- Attente de l'etat Firebase avant les decisions de navigation.
- Preservation de la destination apres connexion avec validation de chemin relatif.
- Blocage du fallback utilisateur fictif en production dans `/api/exam`.
- Ajout de la persistence Firestore des sujets dans `users/{uid}/examCache`.
- Ajout de la persistence des corrections dans `users/{uid}/examResults`.
- Ajout de `/api/planner` avec verification Premium côté serveur.
- Ajout de `planificateur.html` et de son acces depuis `outils.html`.
- Protection des collections `examCache` et `examResults` dans Firestore Rules.
- Conservation des secrets IA et Firebase Admin uniquement dans les variables Vercel.
- Conservation du support QCM mixte pour les questions de calcul et saisie libre pour les questions ouvertes.
- Suppression du délai de redirection de secours de l'accueil : la décision dépend désormais du callback Firebase.
- Protection de `/api/scan` par ID token Firebase ; les credentials IA restent côté serveur.

## Non-modifications volontaires

- La clé Web Firebase reste dans le frontend car elle identifie l'application; elle ne remplace jamais les règles Firebase.
- Le Storage reste ferme tant qu'aucun flux d'upload serveur valide n'est necessaire.
- Les copies de travail `arvexa`, `arvexa/arvexa` et `exva-clean` ne sont pas incluses dans la livraison finale.
