# Déploiement ARVEXA School

## 1. Créer le dépôt GitHub

Depuis ce dossier :

```powershell
git init
git add .
git commit -m "Initialiser ARVEXA School"
git branch -M main
git remote add origin https://github.com/UTILISATEUR/NOM-DU-DEPOT.git
git push -u origin main
```

Ne jamais ajouter de clé IA, token Telegram ou fichier `.env` au dépôt.

## 2. Connecter Vercel

Dans Vercel :

1. `Add New Project`
2. Importer le dépôt GitHub
3. Framework Preset : `Other`
4. Build Command : laisser vide
5. Output Directory : `.`
6. Deploy

Le site est statique : aucun serveur Node n'est requis pour l'interface actuelle.

## 3. Publier une mise à jour

```powershell
git add .
git commit -m "Décrire la modification"
git push origin main
```

Vercel déploie automatiquement la branche `main`. Chaque Pull Request reçoit normalement une URL Preview.

## 4. Règles Firebase

Vercel héberge les fichiers, mais Firebase garde les données et les règles :

```powershell
firebase deploy --only firestore:rules --project arvexa-fbf10
```

Ne pas déployer Storage avec le forfait Spark.

## 5. Vérifications après déploiement

- ouvrir `https://DOMAINE/index.html` ;
- vérifier inscription, connexion et déconnexion ;
- vérifier les lectures/écritures Firestore ;
- vérifier que `/firestore.rules` et `/firebase.json` renvoient une erreur 404 ;
- vérifier le Service Worker dans DevTools > Application ;
- vérifier les erreurs Console et Network sur mobile ;
- tester hors connexion après une première visite.

## Architecture IA

Les appels IA doivent passer par une fonction backend ou une API Vercel avec variable d'environnement. Une clé IA ne doit jamais être réintroduite dans un fichier HTML ou JavaScript public.

## Notification Telegram

Dans Vercel, ajouter ces variables pour l'environnement Production :

```text
TELEGRAM_BOT_TOKEN = token privé de BotFather
TELEGRAM_CHAT_ID = identifiant numérique du chat
APP_ORIGIN = https://ton-domaine-vercel.vercel.app
```

`TELEGRAM_BOT_TOKEN` doit être de type `Secret`. Après l'ajout ou la modification d'une variable, relancer un déploiement Vercel.

L'endpoint public est `/api/telegram`. Il valide la note, la catégorie et la longueur du message, limite les appels par adresse IP et applique un délai maximal de huit secondes à Telegram. Firestore reste la source de vérité si Telegram est indisponible.

## Mode examen IA

Ajouter dans Vercel, uniquement pour `Production` :

```text
GROQ_API_KEY = nouvelle clé privée Groq
GROQ_MODEL = openai/gpt-oss-120b
OPENROUTER_API_KEY = clé privée OpenRouter de secours
OPENROUTER_MODEL = openai/gpt-oss-120b
MISTRAL_API_KEY = clé privée Mistral de secours
MISTRAL_MODEL = mistral-large-latest
FIREBASE_WEB_API_KEY = clé Web Firebase du projet
FIREBASE_ADMIN_CREDENTIALS = contenu JSON du compte de service Firebase
GROQ_VISION_MODEL = meta-llama/llama-4-scout-17b-16e-instruct
OPENROUTER_VISION_MODEL = google/gemini-2.0-flash-001
MISTRAL_VISION_MODEL = pixtral-large-latest
```

`GROQ_API_KEY`, `OPENROUTER_API_KEY` et `MISTRAL_API_KEY` doivent être des variables `Secret`. L'endpoint `/api/exam` refuse les requêtes sans token Firebase valide, limite la génération, génère les deux sujets en un seul appel puis corrige le sujet choisi. Les sujets respectent cinq exercices et dix questions par exercice.

`FIREBASE_ADMIN_CREDENTIALS` doit également être une variable `Secret`. Colle le contenu complet du fichier de compte de service dans Vercel, sans ajouter ce fichier au dépôt GitHub. Les comptes gratuits sont limités à deux générations réussies par jour ; les comptes Premium actifs ne sont pas limités. Le compteur quotidien est conservé dans `users/{uid}/examUsage/YYYY-MM-DD` côté Firestore.

Les sujets générés sont archivés côté serveur dans `users/{uid}/examCache`. Les corrections sont enregistrées dans `users/{uid}/examResults`. Le planificateur Premium est disponible via `/planificateur.html` et utilise la route `/api/planner` pour analyser ces résultats. Après modification des règles, redéployer avec `firebase deploy --only firestore:rules --project arvexa-fbf10`.

Après chaque changement de variable, lancer un nouveau déploiement Vercel. Ne jamais placer ces valeurs dans `exam.html`.

ARV-SCAN utilise `/api/scan` pour l'analyse d'image et les actions pédagogiques. Les clés restent côté serveur ; ne remets pas de clé dans `scan.html`.
