# Deploiement ARVEXA School

## Vercel

Importer le dossier `ARVEXA-SCHOOL-FIXED` comme projet Vercel avec le preset `Other`, sans commande de build et avec le dossier de sortie `.`.

Configurer en environnement Production :

- `FIREBASE_ADMIN_CREDENTIALS` : JSON complet du compte de service, jamais dans Git.
- `GROQ_API_KEY`, `GROQ_MODEL`
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- `MISTRAL_API_KEY`, `MISTRAL_MODEL`
- `APP_ORIGIN` : domaine HTTPS exact de production.
- `EXVA_LOCAL_FALLBACK` : ne pas definir en Production.

Redeployer après chaque changement de variable.

## Firebase

1. Activer Email/Password dans Firebase Authentication.
2. Vérifier les domaines autorisés, notamment le domaine Vercel.
3. Déployer les règles :

```powershell
firebase deploy --only firestore:rules --project arvexa-fbf10
```

4. Vérifier que `firestore.rules` et `storage.rules` sont bien ceux du dossier final.
5. Ne jamais copier le JSON Admin dans le site public.

## Routes importantes

- `/api/exam` : génération et correction, token Firebase obligatoire.
- `/api/planner` : planning Premium basé sur les résultats du compte.
- `/api/scan` : analyse IA du document, clés uniquement côté serveur.
- `/api/telegram` : notification serveur protégée par rate limiting.

## Vérifications après déploiement

- ouvrir `index.html` sans session : la page ne redirige pas directement vers login;
- créer un compte : profil Firestore puis onboarding;
- se connecter avec un compte existant;
- recharger et rouvrir le navigateur pour vérifier la persistence;
- couper temporairement le réseau sans déclencher de `signOut()`;
- vérifier qu'un utilisateur normal ne peut pas lire ou écrire le profil d'un autre;
- vérifier que le planificateur refuse un compte non Premium;
- vérifier les appels `/api/exam` avec un token Firebase réel.
