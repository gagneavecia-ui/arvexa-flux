# ARVEXA School - Flux d'authentification

## Etats

- `AUTH_LOADING` : Firebase initialise et restaure la session. Aucune redirection n'est déclenchée.
- `AUTHENTICATED` : Firebase confirme un utilisateur. Les pages privées chargent son profil.
- `UNAUTHENTICATED` : Firebase confirme l'absence de session. Une page publique de choix propose inscription ou connexion.
- `OFFLINE/NETWORK_ERROR` : l'application conserve la session Firebase locale lorsque possible et affiche un état réseau. Une erreur réseau ne provoque pas de `signOut()`.

## Parcours visiteur

NOUVEAU VISITEUR -> `index.html` -> `auth-choice.html` -> `register.html` -> Firebase Authentication -> profil Firestore -> `onboarding.html` -> accueil.

## Parcours utilisateur existant

UTILISATEUR EXISTANT -> `index.html` -> `auth-choice.html` -> `login.html` -> Firebase Authentication -> accueil.

## Parcours utilisateur déjà connecté

UTILISATEUR CONNECTE -> `index.html` -> Firebase restaure la session -> profil utilisateur -> accueil connecté.

## Règles importantes

- La décision de navigation attend `onAuthStateChanged`.
- La persistence Auth utilise `browserLocalPersistence`.
- Les mots de passe ne sont jamais écrits dans localStorage, sessionStorage ou Firestore.
- Les redirections après connexion acceptent uniquement des chemins relatifs du site.
- `signOut()` est réservé à une action volontaire de l'utilisateur.
