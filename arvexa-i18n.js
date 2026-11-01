/* ═══════════════════════════════════════════════════════════════════
   ARVEXA SCHOOL — ARVEXA-I18N.JS
   Bilingue français / anglais, réglage « Langue » dans Profil.
   Rôle :
     1. Traduire l'interface FR → EN par correspondance de contenu
        (dictionnaire intégré) — aucun marquage data-i18n nécessaire.
     2. Couvrir le contenu dynamique via un MutationObserver
        (toasts, listes Firebase, tutoriels, modales…).
     3. Mémoriser le choix (localStorage 'arvexa-lang'), synchroniser
        les onglets ouverts et tenir <html lang> à jour.
     4. Exposer window.ARVEXA_LANG { get, set, t } pour les réglages.
   Note : le français est la langue source de l'application. En mode
   « fr » le DOM reste intact ; en mode « en » les textes traduits
   conservent leur original (__arvexaOrig) pour un retour FR fidèle.
   Le contenu pédagogique (cours, chapitres) et le texte légal restent
   en français : le site sert l'Afrique francophone (BAC francophone).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'arvexa-lang';
  var DEFAULT_LANG = 'fr';

  /* ─────────────────────────────────────────────────────────────────
     DICTIONNAIRE FR → EN (clés = textes réels des pages, normalisés)
     ───────────────────────────────────────────────────────────────── */
  var DICT_RAW = {
    /* ── Navigation & commun ── */
    "Accueil": "Home",
    "Retour": "Back",
    "Retour à l'accueil": "Back to home",
    "🏠 Retour à l'accueil": "🏠 Back to home",
    "Retour au tableau de bord": "Back to dashboard",
    "Retour à la connexion": "Back to login",
    "Fermer": "Close",
    "Annuler": "Cancel",
    "Confirmer": "Confirm",
    "Confirmer et envoyer": "Confirm and send",
    "Confirmation": "Confirmation",
    "Valider": "Confirm",
    "Valider mes réponses": "Submit my answers",
    "Continuer": "Continue",
    "Terminer": "Finish",
    "Terminer l'examen ?": "Finish the exam?",
    "Voulez-vous vraiment terminer votre examen ? Vos réponses seront envoyées pour correction.": "Do you really want to finish your exam? Your answers will be sent for grading.",
    "Supprimer": "Delete",
    "Supprimer ce cahier ?": "Delete this notebook?",
    "Supprimer cet examen ?": "Delete this exam?",
    "Supprimer cette notion": "Delete this notion",
    "Copier": "Copy",
    "Copier le plan en texte": "Copy the plan as text",
    "modifier": "edit",
    "Rechercher": "Search",
    "Envoyer": "Send",
    "Chargement...": "Loading...",
    "Mise à jour en arrière-plan...": "Updating in the background...",
    "Préparation...": "Preparing...",
    "Vérification...": "Checking...",
    "Vérification en cours...": "Checking...",
    "Vérification": "Checking",
    "Réessayer": "Try again",
    "Rafraîchir": "Refresh",
    "Rafraîchir les données": "Refresh data",
    "Rafraîchir depuis l'IA (ignorer le cache)": "Refresh from AI (ignore cache)",
    "Menu": "Menu",
    "Ouvrir le menu": "Open menu",
    "Fermer le menu": "Close menu",
    "Navigation principale": "Main navigation",
    "Navigation rapide": "Quick navigation",
    "Liens légaux": "Legal links",
    "Aller au contenu": "Skip to content",
    "Retour en haut": "Back to top",
    "ARVEXA School, retour en haut": "ARVEXA School, back to top",
    "Page précédente": "Previous page",
    "Page": "Page",
    "Aide": "Help",
    "Contact": "Contact",
    "Support": "Support",
    "Contacter le support": "Contact support",
    "Une question ? Notre équipe est là pour t'aider": "A question? Our team is here to help",
    "Tout voir →": "See all →",
    "Explorer →": "Explore →",
    "À découvrir": "Discover",
    "Accéder": "Open",
    "Voir les offres": "See plans",
    "Voir les offres Premium": "See Premium plans",
    "Découvrir Premium": "Discover Premium",
    "Découvrir Premium — 2 000 FCFA/mois": "Discover Premium — 2 000 FCFA/month",
    "Découvrir les outils et les matières": "Discover the tools and subjects",
    "Es-tu sûr de vouloir continuer ?": "Are you sure you want to continue?",
    "Es-tu sûr ?": "Are you sure?",
    "Quitter": "Leave",
    "Quitter la partie": "Quit the game",
    "Vérifie les informations avant de confirmer.": "Check the information before confirming.",
    "ou": "or",
    "et": "and",
    "et la": "and the",
    "Tous": "All",
    "Toutes": "All",
    "Tous les chapitres": "All chapters",
    "Tous les outils": "All tools",
    "Toutes les matières": "All subjects",
    "Toutes les corrections": "All corrections",
    "Tous les exercices": "All exercises",
    "Tous les exercices avec corrections": "All exercises with solutions",
    "Tous les exercices et corrections": "All exercises and solutions",
    "Toutes les formules": "All formulas",
    "Tous les chapitres de toutes les matières": "All chapters of all subjects",
    "de :": "of:",
    "sur": "on",
    "En cours": "In progress",
    "Commencer": "Start",
    "commencer": "start",
    "Fin": "End",
    "Début": "Start",
    "Résultat": "Result",
    "Catégorie": "Category",
    "Valeur": "Value",
    "Contacte le support si le problème persiste": "Contact support if the problem persists",

    /* ── Auth & compte ── */
    "Se connecter": "Log in",
    "Me connecter": "Log in",
    "Connexion": "Log in",
    "Créer mon compte": "Create my account",
    "Créer un nouveau compte": "Create a new account",
    "Créer son compte ou se connecter": "Create an account or log in",
    "Crée ton compte": "Create your account",
    "Inscription": "Sign up",
    "Inscription gratuite": "Free sign-up",
    "Mode nuit": "Night mode",
    "Mode jour": "Day mode",
    "Avant de commencer, réglez vos préférences": "Before you start, set your preferences",
    "Modifiable à tout moment dans Mon profil.": "You can change this anytime in My profile.",
    "Activer le mode sombre": "Turn on dark mode",
    "Mot de passe": "Password",
    "Confirmer le mot de passe": "Confirm password",
    "Mot de passe oublié ?": "Forgot your password?",
    "Adresse e-mail": "Email address",
    "Adresse email": "Email address",
    "E-mail": "Email",
    "Email": "Email",
    "Se souvenir de moi": "Remember me",
    "Déconnexion": "Log out",
    "Se déconnecter": "Log out",
    "Se déconnecter ?": "Log out?",
    "Déjà membre ?": "Already a member?",
    "Pas encore membre ?": "Not a member yet?",
    "Bienvenue": "Welcome",
    "Bon retour parmi nous": "Welcome back",
    "Bonjour": "Hello",
    "Bonsoir": "Good evening",
    "Content de te": "Happy to",
    "revoir": "see you again",
    "Élève": "Student",
    "Classe": "Class",
    "Établissement": "School",
    "Établissement scolaire": "School",
    "Membre depuis": "Member since",
    "Statut": "Status",
    "Nom": "Name",
    "Prénom": "First name",
    "Nom et prénom": "Full name",
    "Prénom et nom": "Full name",
    "👤 Nom complet": "👤 Full name",
    "Numéro WhatsApp": "WhatsApp number",
    "📱 Numéro WhatsApp": "📱 WhatsApp number",
    "Force du mot de passe": "Password strength",
    "Authentification sécurisée": "Secure authentication",
    "Inscription sécurisée par Firebase": "Sign-up secured by Firebase",
    "Connexion sécurisée par Firebase": "Login secured by Firebase",
    "Accès immédiat après création": "Instant access after creation",
    "Compte actif": "Active account",
    "Inscription et compte": "Sign-up and account",
    "Récupération de compte": "Account recovery",
    "Choisis un nouveau mot de passe": "Choose a new password",
    "Connecte-toi avec ton nouveau mot de passe": "Log in with your new password",
    "Un lien de réinitialisation a été envoyé à": "A reset link has been sent to",
    "Email à l'adresse associée à ton compte": "Email sent to your account address",
    "Ouvre ta boîte mail (Gmail, Outlook, etc.)": "Open your inbox (Gmail, Outlook, etc.)",
    "Cherche un e-mail de": "Look for an email from",
    "Pas reçu ?": "Didn't receive it?",
    "Attends 5 minutes (le mail peut prendre du temps)": "Wait 5 minutes (email can take a while)",
    "Vérifie que l'adresse est correcte": "Check the address is correct",
    "Vérifie tes": "Check your",
    "spams": "spam folder",
    "spam": "spam",
    "si tu ne le vois pas.": "if you don't see it.",
    "Renvoyer le lien": "Resend the link",
    "Envoyer le lien": "Send the link",
    "Tu as utilisé tes": "You have used your",
    "aujourd'hui. Passe à Premium pour réviser sans limite.": "today. Go Premium to revise with no limits.",
    "Ton compte est sécurisé par Firebase": "Your account is secured by Firebase",
    "J'accepte les": "I accept the",
    "J'accepte et je continue": "I accept and continue",
    "Tu dois accepter les conditions pour continuer.": "You must accept the terms to continue.",
    "Tu acceptes ces conditions ?": "Do you accept these terms?",
    "Être": "Be",
    "âgé d'au moins 13 ans": "at least 13 years old",
    "(ou avoir l'accord parental)": "(or have parental consent)",
    "Les utilisateurs de moins de 13 ans doivent obtenir l'": "Users under 13 must obtain",
    "accord explicite": "explicit consent",
    "d'un parent ou tuteur légal.": "from a parent or legal guardian.",
    "En créant un compte et en utilisant l'application": "By creating an account and using the app",
    "Tu devras te": "You will have to",
    "reconnecter": "log in again",
    "pour accéder à ton compte.": "to access your account.",
    "Tu es banni": "You are banned",
    "Tu es à un clic de commencer ton parcours vers la réussite au BAC.": "You are one click away from starting your journey to BAC success.",
    "Rejoins les étudiants qui réussissent": "Join the students who succeed",

    /* ── Réseau & hors ligne ── */
    "Hors ligne": "Offline",
    "Il semble que tu sois hors ligne. Vérifie ta connexion internet et réessaie.": "You seem to be offline. Check your internet connection and try again.",
    "Essaie de te rapprocher de ta box ou de changer de réseau": "Try moving closer to your router or switching networks",
    "Mode avion désactivé ? Vérifie dans tes réglages": "Airplane mode off? Check your settings",
    "Vérifie que ton Wi-Fi ou tes données mobiles sont activés": "Check that your Wi-Fi or mobile data is on",
    "✅ Connexion rétablie": "✅ Connection restored",
    "📶 Mode hors ligne activé": "📶 Offline mode enabled",
    "📶 Impossible de synchroniser hors ligne": "📶 Cannot sync while offline",
    "📶 Connecte-toi pour télécharger": "📶 Log in to download",
    "📶 Réviser sans Internet": "📶 Study without internet",
    "Progression sauvegardée localement.": "Progress saved locally.",
    "🔍 Recherche du contenu disponible...": "🔍 Searching available content...",
    "🔍 Vérification des fichiers...": "🔍 Checking files...",
    "⚠️ Service Worker non prêt, recharge la page": "⚠️ Service Worker not ready, reload the page",
    "Erreur de téléchargement": "Download error",
    "ℹ️ Aucun fichier disponible pour le moment": "ℹ️ No files available at the moment",
    "Télécharger tout hors ligne": "Download everything offline",

    /* ── Profil & réglages ── */
    "Mon profil": "My profile",
    "Profil": "Profile",
    "🏆 Mes réalisations": "🏆 My achievements",
    "🏆 Tes réalisations": "🏆 Your achievements",
    "Temps d'étude": "Study time",
    "⏱️ Temps d'étude": "⏱️ Study time",
    "📈 Niveau": "📈 Level",
    "Niveau": "Level",
    "Niv. 1": "Lv. 1",
    "Ma progression": "My progress",
    "Progression": "Progress",
    "progression": "progress",
    "Mes examens passés": "My past exams",
    "Moyenne": "Average",
    "Meilleure note": "Best grade",
    "Note": "Grade",
    "Note globale": "Overall grade",
    "Score": "Score",
    "Maîtrisés": "Mastered",
    "33 étoiles": "33 stars",
    "0 / 33 étoiles": "0 / 33 stars",
    "étoiles / 33": "stars / 33",
    "Curieux": "Curious",
    "Mes cahiers de révision": "My revision notebooks",
    "Cahiers": "Notebooks",
    "Mon cahier": "My notebook",
    "Nouveau cahier": "New notebook",
    "Mes notions": "My notions",
    "Notion": "Notion",
    "Notions générées": "Generated notions",
    "Notions totales": "Total notions",
    "Voir mes notions": "See my notions",
    "Photo de profil": "Profile photo",
    "Changer la photo": "Change photo",
    "Clique pour changer la photo": "Tap to change photo",
    "Mode clair": "Light mode",
    "Écran plus lumineux, idéal en plein jour": "Brighter screen, ideal in daylight",
    "Activer le mode clair": "Turn on light mode",
    "Désactiver le mode clair": "Turn off light mode",
    "Changer de thème": "Change theme",
    "XP total": "Total XP",
    "🏅 Trophées": "🏅 Trophies",
    "⏳ Abonnement expiré": "⏳ Subscription expired",
    "Ton abonnement a expiré le": "Your subscription expired on",
    "Renouveler mon abonnement": "Renew my subscription",
    "Mon abonnement": "My subscription",
    "Abonnement": "Subscription",
    "Abonnement Premium": "Premium subscription",
    "Gérer Premium": "Manage Premium",
    "💡 Ton prochain objectif": "💡 Your next goal",
    "💾 Enregistrer": "💾 Save",
    "Mes notes": "My notes",
    "Notes enregistrées !": "Notes saved!",
    "Écris ici ce que tu as compris, des points importants, des questions...": "Write here what you understood, key points, questions...",
    "Sauvegarder tes chapitres lus et ton temps d'étude": "Save your chapters read and study time",
    "(chapitres lus, temps d'étude)": "(chapters read, study time)",
    "📚 Chapitres lus": "📚 Chapters read",
    "🖼️ Photo de profil": "🖼️ Profile photo",
    "Badges débloqués": "Unlocked badges",
    "Fermer la fiche": "Close the sheet",
    "Temps restant": "Time remaining",
    "Émojis": "Emojis",
    "Annuler la réponse": "Cancel the reply",
    "Réinitialiser la progression": "Reset progress",
    "🔄 Réinitialiser et relancer le tutoriel": "🔄 Reset and restart the tutorial",

    /* ── Outils ── */
    "Outils": "Tools",
    "outils": "tools",
    "Les outils": "Tools",
    "les outils": "the tools",
    "Outils essentiels": "Essential tools",
    "Outils intelligents": "Smart tools",
    "Plus d'outils": "More tools",
    "🛠️ Outils & Ressources": "🛠️ Tools & Resources",
    "Calculatrice": "Calculator",
    "Calculatrice scientifique": "Scientific calculator",
    "Ouvrir la calculatrice": "Open the calculator",
    "Formulaires": "Formula sheets",
    "Tableau périodique": "Periodic table",
    "Explorer les éléments": "Explore the elements",
    "Constantes": "Constants",
    "Convertir": "Convert",
    "Conversions": "Conversions",
    "Rechercher une constante...": "Search a constant...",
    "Rechercher un élément...": "Search an element...",
    "Rechercher une formule...": "Search a formula...",
    "Rechercher une formule, un chapitre…": "Search a formula, a chapter…",
    "Rechercher dans la bibliothèque": "Search the library",
    "Inverser": "Invert",
    "Ajouter à la mémoire (M+)": "Add to memory (M+)",
    "Soustraire de la mémoire (M−)": "Subtract from memory (M−)",
    "Vider la mémoire": "Clear memory",
    "Insérer le dernier résultat (Ans)": "Insert last result (Ans)",
    "Mémoire :": "Memory:",
    "Aucun calcul pour le moment": "No calculation yet",
    "Bibliothèque": "Library",
    "Bibliothèque de fiches": "Sheet library",
    "📚 Bibliothèque de fiches": "📚 Sheet library",
    "Fiche de révision": "Revision sheet",
    "Fiches": "Sheets",
    "Fiche éclair · chapitre 01": "Flash sheet · chapter 01",
    "Degrés / Radians": "Degrees / Radians",
    "Métaux alcalins": "Alkali metals",
    "Métaux alcalino-terreux": "Alkaline earth metals",
    "Métaux de transition": "Transition metals",
    "Métaux pauvres": "Post-transition metals",
    "Métalloïdes": "Metalloids",
    "Non-métaux": "Nonmetals",
    "Halogènes": "Halogens",
    "Gaz nobles": "Noble gases",
    "Lanthanides": "Lanthanides",
    "Actinides": "Actinides",
    "Donnée": "Data",
    "Ajouter mon cours": "Add my lesson",

    /* ── Matières ── */
    "Mathématiques": "Mathematics",
    "Physique": "Physics",
    "Chimie": "Chemistry",
    "SVT": "Biology",
    "Histoire": "History",
    "Géographie": "Geography",
    "Philosophie": "Philosophy",
    "Matières": "Subjects",
    "Matière": "Subject",
    "Matières disponibles": "Available subjects",
    "Nombres complexes": "Complex numbers",
    "Fonctions exponentielles — notions clés": "Exponential functions — key notions",
    "📐 Mes matières": "📐 My subjects",
    "📐 Mes chapitres": "📐 My chapters",
    "📚 Tes matières": "📚 Your subjects",
    "📖 Chapitres": "📖 Chapters",
    "Chapitres": "Chapters",
    "Chapitre": "Chapter",
    "chapitres": "chapters",
    "Chapitre en cours": "Current chapter",
    "Chapitre terminé": "Chapter completed",
    "Les chapitres": "Chapters",
    "des chapitres": "of chapters",
    "11 chapitres": "11 chapters",
    "17 chapitres": "17 chapters",
    "20 chapitres": "20 chapters",
    "9 chapitres": "9 chapters",
    "Les 11 chapitres": "The 11 chapters",
    "📖 Progression du chapitre": "📖 Chapter progress",
    "Retour au chapitre": "Back to the chapter",
    "Filtrer les chapitres": "Filter chapters",

    /* ── Accueil ── */
    "⏳ Compte à rebours BAC": "⏳ BAC countdown",
    "🌿 Conseil du jour": "🌿 Tip of the day",
    "Conseil du jour": "Tip of the day",
    "Chargement du conseil…": "Loading the tip…",
    "Commencer l'aventure": "Start the journey",
    "Commencer un examen": "Start an exam",
    "Préparation du BAC": "BAC preparation",
    "Une plateforme éducative": "An educational platform",
    "Plateforme éducative panafricaine": "Pan-African learning platform",
    "Une aide intelligente": "Smart assistance",
    "Propulsé par IA": "Powered by AI",
    "Pose 3 questions/jour à l'IA": "Ask the AI 3 questions a day",
    "Prépare ton": "Prepare your",
    "Construis ton": "Build your",
    "Commence à construire": "Start building",
    "ton avenir": "your future",
    "avenir": "future",
    "Garder ton": "Keep your",
    "Ton arsenal complet pour réussir le": "Your complete arsenal to ace the",
    "Ta progression en un coup d’œil": "Your progress at a glance",
    "Rejoins la communauté des élèves qui préparent leur BAC avec méthode et sérénité.": "Join the community of students preparing for their BAC with method and peace of mind.",
    "Trois étapes pour": "Three steps to",
    "Quatre familles d’outils,": "Four families of tools,",
    "La démarche s’articule autour de trois idées :": "The approach is built around three ideas:",
    "« Chaque jour compte vers ton BAC. »": "“Every day counts toward your BAC.”",
    "— chaque jour compte vers ton BAC.": "— every day counts toward your BAC.",
    "Pour réviser mieux": "To revise smarter",
    "Pourquoi": "Why",
    "pourquoi": "why",
    "comment": "how",
    "Comprendre": "Understand",
    "Progresser": "Progress",
    "Réviser régulièrement": "Revise regularly",
    "Réviser avec des supports clairs": "Revise with clear materials",
    "Revoir les cours à son rythme et consolider les notions essentielles.": "Review lessons at your own pace and consolidate the essential notions.",
    "Réviser un chapitre": "Revise a chapter",
    "Revoir les notions difficiles": "Review difficult notions",
    "S'entraîner par la pratique": "Learn by practicing",
    "S’entraîner et suivre sa progression": "Practice and track your progress",
    "S’entraîner régulièrement et observer son évolution au fil des semaines.": "Train regularly and watch your progress week after week.",
    "Structurer ses révisions et garder une vue d’ensemble de son programme.": "Structure your revisions and keep an overview of your program.",
    "s’entraîner et mesurer ses progrès": "practice and measure your progress",
    "suivre ses progrès": "track your progress",
    "mieux organiser son travail": "organize your work better",
    "comprendre les cours": "understand the lessons",
    "cours": "lessons",
    "avis": "feedback",
    "connexion": "connection",
    "paiement": "payment",
    "Pour utiliser ARVEXA School, tu dois :": "To use ARVEXA School, you must:",
    "✨ Ce que tu obtiens avec": "✨ What you get with",
    "Lecture": "Reading",

    /* ── Examens ── */
    "Examens": "Exams",
    "Nouvel examen": "New exam",
    "Examen en cours": "Exam in progress",
    "📝 Examen en cours détecté": "📝 Exam in progress detected",
    "Tu as un examen commencé mais non terminé. Veux-tu le reprendre là où tu en étais ?": "You have an exam in progress. Do you want to resume where you left off?",
    "Reprendre": "Resume",
    "Difficulté": "Difficulty",
    "Facile": "Easy",
    "Moyen": "Medium",
    "Difficile": "Hard",
    "Durée": "Duration",
    "Nombre d'exercices": "Number of exercises",
    "Matière, chapitre, difficulté et durée": "Subject, chapter, difficulty and duration",
    "Question 1 sur 8": "Question 1 of 8",
    "Questions": "Questions",
    "Exercice": "Exercise",
    "Exercices": "Exercises",
    "exercices corrigés": "solved exercises",
    "Exercices corrigés": "Solved exercises",
    "Correctes": "Correct",
    "Correction en cours": "Grading in progress",
    "Correction détaillée": "Detailed correction",
    "Corrections": "Corrections",
    "les corrections": "the corrections",
    "Revoir les corrections": "Review the corrections",
    "Mode examen": "Exam mode",
    "Mode Examen": "Exam mode",
    "mode examen": "exam mode",
    "Mode examen illimité": "Unlimited exam mode",
    "Sans chrono": "No timer",
    "Jouer avec chrono": "Play with timer",
    "Envoi de ta copie au correcteur": "Sending your paper to the grader",
    "L'IA corrige ta copie...": "The AI is grading your paper...",
    "Calcul du score": "Score calculation",
    "Réception des réponses": "Receiving your answers",
    "Vérification de chaque réponse": "Checking each answer",
    "Analyse des exercices": "Analyzing the exercises",
    "Identification des erreurs et points forts": "Identifying mistakes and strengths",
    "Attribution des points": "Awarding points",
    "Préparation du bilan détaillé": "Preparing your detailed report",
    "Génération des sujets": "Generating the papers",
    "Génération en cours": "Generation in progress",
    "Génération terminée": "Generation complete",
    "Préparation de l'affichage": "Preparing the display",
    "Ton examen est prêt": "Your exam is ready",
    "Générer mon examen": "Generate my exam",
    "Prépare ton examen dans les conditions du BAC.": "Prepare for your exam under real BAC conditions.",
    "Révise comme le jour J": "Revise like exam day",
    "pour simuler les conditions réelles": "to simulate real conditions",
    "Choisis tes paramètres. Le serveur générera deux sujets de niveaux progressifs :": "Choose your settings. The server will generate two papers of increasing difficulty:",
    "2 sujets de niveaux progressifs": "2 papers of increasing difficulty",
    "3 exercices × 5 questions par sujet": "3 exercises × 5 questions per paper",
    "Chaque sujet contient 3 exercices × 5 questions.": "Each paper contains 3 exercises × 5 questions.",
    "Choisis un seul sujet. L'autre reste disponible si tu veux recommencer.": "Choose one paper only. The other stays available if you want to try again.",
    "L'examen sera généré à partir de ce que tu as étudié.": "The exam will be generated from what you have studied.",
    "L'IA prépare tes deux sujets...": "The AI is preparing your two papers...",
    "Sujet": "Paper",
    "Série": "Series",
    "Modifier la configuration": "Change the settings",
    "30 à 45 secondes par exercice. Les étapes s'affichent en temps réel.": "30 to 45 seconds per exercise. Steps appear in real time.",
    "30 à 60 secondes. Chaque étape indique la progression exacte.": "30 to 60 seconds. Each step shows the exact progress.",
    "Cela peut prendre 10 à 20 secondes.": "This can take 10 to 20 seconds.",
    "30 derniers jours": "Last 30 days",
    "7 derniers jours": "Last 7 days",
    "90 derniers jours": "Last 90 days",
    "Toute la période": "All time",
    "Effacer tout l'historique": "Clear all history",
    "Historique": "History",
    "Historique complet": "Full history",
    "meilleure série": "best streak",
    "Il te reste": "You have",
    "jours": "days",
    "Jours": "Days",
    "Heures": "Hours",
    "Minutes": "Minutes",
    "Secondes": "Seconds",
    "minutes": "minutes",
    "Min": "Min",
    "1 heure": "1 hour",
    "2 heures": "2 hours",
    "3 heures": "3 hours",
    "h estimées": "h estimated",
    "Il est": "It's",

    /* ── Réviseur & planificateur ── */
    "Réviseur": "Reviser",
    "Générer mes premières notions": "Generate my first notions",
    "Génère d'abord des notions": "Generate notions first",
    "Aucune notion générée": "No notions generated",
    "Consulte tes notions déjà générées. Aucun coût.": "View your already generated notions. Free of charge.",
    "Retourne à l'accueil pour générer tes premières notions.": "Go back home to generate your first notions.",
    "Ton plan de révision": "Your revision plan",
    "Plan personnalisé": "Personalized plan",
    "Générer mon plan": "Generate my plan",
    "Ce service analyse tes examens et construit un plan IA. Réservé aux comptes Premium.": "This service analyzes your exams and builds an AI plan. Premium accounts only.",
    "Contexte complet": "Full context",
    "📖 Basé sur ton cahier": "📖 Based on your notebook",
    "IA les analyse et te dit exactement quoi réviser. Ton meilleur allié pour progresser.": "The AI analyzes them and tells you exactly what to revise. Your best ally to progress.",
    "Ce cahier et toutes ses notions seront": "This notebook and all its notions will be",
    "définitivement supprimés": "permanently deleted",
    "L'historique de tes cahiers est réservé aux membres": "Your notebooks history is for members only",
    ". Passe à Premium pour retrouver tous tes cahiers à vie.": ". Go Premium to keep all your notebooks forever.",
    "Planificateur": "Planner",
    "Planifier mes révisions": "Plan my revisions",
    "Organiser": "Organize",
    "Objectif": "Goal",
    "Suivi": "Tracking",
    "Méthode de travail": "Study method",
    "⏱️ Relancer le test": "⏱️ Restart the test",
    "Progression annuelle": "Yearly progress",
    "sessions terminées": "completed sessions",
    "questions répondues": "questions answered",
    "🕘 Dernières sessions": "🕘 Latest sessions",
    "Voir ma progression": "See my progress",
    "Progression de niveau": "Level progress",
    "Graphique illustratif de progression": "Illustrative progress chart",
    "Avant (brut)": "Before (raw)",
    "Après (rendu)": "After (rendered)",

    /* ── MathMind ── */
    "Jouer maintenant": "Play now",
    "Rejouer": "Play again",
    "Faire un quiz": "Take a quiz",
    "Nouveau quiz": "New quiz",
    "Pas encore joué": "Not played yet",
    "Record et maîtrise": "Record and mastery",
    "Chaque étoile compte.": "Every star counts.",
    "Bravo !": "Well done!",
    "Continue comme ça !": "Keep it up!",
    "Excellent travail !": "Excellent work!",
    "Merci beaucoup !": "Thank you so much!",
    "Félicitations ! Tu as maintenant accès à": "Congratulations! You now have access to",
    "Tu as débloqué": "You have unlocked",
    "Révise les 11 chapitres essentiels, gagne de l’XP et transforme chaque erreur en progrès.": "Revise the 11 essential chapters, earn XP and turn every mistake into progress.",
    "L’essentiel à avoir en tête avant de jouer.": "The essentials to know before playing.",
    "© 2026 ARVEXA Math · MathMind Terminale · Progression locale, aucune donnée envoyée": "© 2026 ARVEXA Math · MathMind Terminale · Local progress, no data sent",
    "ARVEXA Math · Objectif 33 étoiles": "ARVEXA Math · Goal: 33 stars",

    /* ── Premium & abonnement ── */
    "Gratuit": "Free",
    "gratuits": "free",
    "10 questions gratuites": "10 free questions",
    "2 examens gratuits": "2 free exams",
    "3 générations gratuites": "3 free generations",
    "5 sections gratuites": "5 free sections",
    "60 questions par jour": "60 questions per day",
    "60 questions/jour": "60 questions/day",
    "Accès libre": "Open access",
    "Accès restreint": "Restricted access",
    "(Premium)": "(Premium)",
    "Accès illimité à toutes les matières": "Unlimited access to all subjects",
    "Examens illimités": "Unlimited exams",
    "Historique illimité": "Unlimited history",
    "Corrections détaillées": "Detailed corrections",
    "ARV-ASSISTANT illimité": "Unlimited ARV-ASSISTANT",
    "S'abonner maintenant": "Subscribe now",
    "Tarifs actuels :": "Current prices:",
    "Mensuel": "Monthly",
    "Annuel :": "Yearly:",
    "Mensuel :": "Monthly:",
    "/ mois": "/ month",
    "2 000 FCFA / mois": "2 000 FCFA / month",
    "18 000 FCFA / an (économise 6 000 FCFA)": "18 000 FCFA / year (save 6 000 FCFA)",
    "Économise 6 000 FCFA": "Save 6 000 FCFA",
    "💰 Prix": "💰 Price",
    "💰 Total à payer": "💰 Total to pay",
    "Montant": "Amount",
    "Choisis ton mode de paiement": "Choose your payment method",
    "Choisis un mode de paiement": "Choose a payment method",
    "Choisis un mode de paiement pour voir le QR code": "Choose a payment method to see the QR code",
    "Paiement par": "Payment via",
    "Paiement auto": "Auto payment",
    "Paiement manuel": "Manual payment",
    "Paiement manuel · Activation après confirmation": "Manual payment · Activation after confirmation",
    "Uniquement pour les paiements Premium": "For Premium payments only",
    "📝 Comment payer": "📝 How to pay",
    "Scanne le QR code ou envoie au": "Scan the QR code or send to",
    "Envoie la capture dans la conversation WhatsApp": "Send the screenshot in the WhatsApp chat",
    "Prends une": "Take a",
    "capture d'écran": "screenshot",
    "Image prête à envoyer": "Image ready to send",
    "Nous vérifions ton paiement. Tu recevras une": "We are checking your payment. You will receive a",
    "notification": "notification",
    "dès que ton abonnement sera activé.": "as soon as your subscription is activated.",
    "⏳ Demande en attente": "⏳ Request pending",
    "après vérification du paiement": "after payment verification",
    "Activation dans les": "Activation within",
    "quelques minutes": "a few minutes",
    "immédiate": "immediate",
    "Délai d'activation : généralement": "Activation time: usually",
    "Modalités de paiement :": "Payment terms:",
    "Pas de remboursement :": "No refunds:",
    "Renouvellement :": "Renewal:",
    "Pas d'engagement": "No commitment",
    "Paiement mensuel, flexible et sans engagement": "Monthly payment, flexible with no commitment",
    "Forfait": "Plan",
    "📅 Forfait": "📅 Plan",
    "📅 Mensuel": "📅 Monthly",
    "📅 Annuel": "📅 Yearly",
    "Activation": "Activation",
    "Finalisation": "Finalization",
    "Passe à": "Switch to",
    "👑 Passe à": "👑 Switch to",
    "Passe à Premium pour débloquer tout ce chapitre.": "Go Premium to unlock this whole chapter.",
    "Tu as accès à une partie du contenu. Passe à Premium !": "You have partial access to the content. Go Premium!",
    ". Passe à Premium pour t'entraîner sans limite.": ". Go Premium to train with no limits.",
    "ce mois-ci. Passe à Premium pour analyser tes cours sans limite.": "this month. Go Premium to analyze your lessons with no limits.",
    "et débloque tout": "and unlock everything",
    "🔓 Débloque tout ARVEXA School": "🔓 Unlock all of ARVEXA School",
    "Débloque": "Unlock",
    "tout": "all",
    "banni": "banned",

    /* ── Notifications & groupe ── */
    "Notifications": "Notifications",
    "Non lues": "Unread",
    "Nouveau": "New",
    "Chargement des messages...": "Loading messages...",
    "Aucune conversation": "No conversations",
    "Message...": "Message...",
    "Écris un message...": "Write a message...",
    "Rechercher un message...": "Search messages...",
    "Nouvelle conversation": "New conversation",
    "Groupe": "Group",
    "ARVEXA Général": "ARVEXA General",
    "Communauté ARVEXA": "ARVEXA community",
    "groupe d'échange": "exchange group",
    "Discuter maintenant": "Chat now",
    "Comportement inapproprié dans le groupe d'échange": "Inappropriate behavior in the exchange group",
    "Harceler, insulter ou menacer d'autres utilisateurs": "Harassing, insulting or threatening other users",
    "entre élèves": "between students",
    "Notification dans l'application": "In-app notification",
    "Bannière visible sur le tableau de bord": "Visible banner on the dashboard",

    /* ── ARV Assistant ── */
    "Pose ta question à ARV Assistant...": "Ask your question to ARV Assistant...",
    "ARV-ASSISTANT": "ARV-ASSISTANT",
    "Prêt à t'aider": "Ready to help",
    "Maj+Entrée": "Shift+Enter",
    "pour envoyer ·": "to send ·",
    "pour un saut de ligne": "for a new line",
    "1–4 pour choisir · Entrée pour valider": "1–4 to choose · Enter to confirm",
    "Entrée": "Enter",
    "Propulsé par l'IA": "Powered by AI",

    /* ── Chapitres & lecture ── */
    "Écouter": "Listen",
    "Écouter la partie": "Listen to this part",
    "Couper le son": "Mute",
    "Précédent": "Previous",
    "Suivant": "Next",
    "← Précédent": "← Previous",
    "Consulter les formules": "View the formulas",
    "Pratiquer les exercices": "Practice the exercises",
    "Teste tes connaissances": "Test your knowledge",
    "Commence par ce chapitre pour poser des bases solides.": "Start with this chapter to build a solid foundation.",
    "Commence un chapitre pour lancer ta progression.": "Start a chapter to kick-start your progress.",
    "Approfondissement": "Advanced",
    "Consolidation": "Consolidation",
    "Défi final": "Final challenge",
    "📊 Vue d’ensemble": "📊 Overview",
    "Niveau BAC": "BAC level",
    "Astuce : révise la fiche, puis tente les 3 étoiles.": "Tip: review the sheet, then go for the 3 stars.",
    "Chapitres lus": "Chapters read",
    "chapitres lus": "chapters read",

    /* ── Avis ── */
    "⭐ Ton avis compte": "⭐ Your feedback matters",
    "Donner mon avis": "Give my feedback",
    "Envoyer mon avis": "Send my feedback",
    "Partage ton expérience": "Share your experience",
    "Aide-nous à améliorer ARVEXA School": "Help us improve ARVEXA School",
    "Aide-nous à nous améliorer": "Help us improve",
    "Ton avis a bien été envoyé. Nous le lisons avec attention pour améliorer ARVEXA School.": "Your feedback has been sent. We read it carefully to make ARVEXA School better.",
    "Bug": "Bug",
    "Suggestion": "Suggestion",
    "Autre": "Other",
    "Clique sur les étoiles": "Tap the stars",

    /* ── Onboarding & tutoriel ── */
    "Étape 1 sur 2": "Step 1 of 2",
    "Étape finale": "Final step",
    "Étape": "Step",
    "étape": "step",
    "✨ Tu es prêt !": "✨ You're ready!",
    "🎓 Bienvenue sur ARVEXA !": "🎓 Welcome to ARVEXA!",
    "Passer le tutoriel": "Skip the tutorial",
    "Quitter le tutoriel ?": "Quit the tutorial?",

    /* ── 404 ── */
    "Page introuvable": "Page not found",
    "Cette page n'existe pas, a été déplacée ou n'est plus disponible.": "This page does not exist, has been moved, or is no longer available.",
    "Tenter de": "Attempt to",
    "contourner les systèmes de sécurité": "bypass security systems",

    /* ── Légal (titres & sections uniquement) ── */
    "Conditions d'utilisation": "Terms of Use",
    "Politique de confidentialité": "Privacy Policy",
    "Conditions": "Terms",
    "Confidentialité": "Privacy",
    "Acceptation des conditions": "Acceptance of terms",
    "Description du service": "Service description",
    "Protection des données": "Data protection",
    "Propriété intellectuelle": "Intellectual property",
    "Responsabilités": "Responsibilities",
    "Utilisation acceptable": "Acceptable use",
    "Sanctions :": "Sanctions:",
    "Modification des conditions": "Changes to these terms",
    "Modifications de cette politique": "Changes to this policy",
    "Comment nous utilisons tes données": "How we use your data",
    "Partage des données": "Data sharing",
    "Durée de conservation": "Data retention",
    "Tes droits": "Your rights",
    "Tes droits :": "Your rights:",
    "Sécurité des données": "Data security",
    "Cookies et stockage local": "Cookies and local storage",
    "Cookies essentiels": "Essential cookies",
    "Enfants et mineurs": "Children and minors",
    "Données que nous collectons": "Data we collect",
    "Données personnelles": "Personal data",
    "Notre engagement": "Our commitment",
    "Notre promesse :": "Our promise:",
    "Après suppression du compte": "After account deletion",
    "Document officiel": "Official document",
    "date de dernière mise à jour": "date of last update",
    "Dernière mise à jour : 15 janvier 2026": "Last updated: January 15, 2026",
    "Version 1.0.0 · Dernière mise à jour : 15 janvier 2026": "Version 1.0.0 · Last updated: January 15, 2026",
    "est toujours indiquée en haut de cette page.": "is always shown at the top of this page.",
    "En cas de changement majeur, tu seras informé :": "In case of major changes, you will be notified:",
    "En cas de modification": "In case of changes",
    "tu seras informé par :": "you will be notified by:",
    "Conformément au RGPD et aux lois sur la protection des données, tu as le droit de :": "In accordance with the GDPR and data protection laws, you have the right to:",
    "Nous collectons uniquement les données nécessaires au fonctionnement du service :": "We only collect the data needed to run the service:",
    "Tes données sont utilisées uniquement pour :": "Your data is used only for:",
    "Tes données sont conservées :": "Your data is kept:",
    "Tes données sont stockées sur": "Your data is stored on",
    "Tes données sont sécurisées par": "Your data is secured by",
    "Nous ne vendons": "We do not sell",
    "ne sont jamais vendues": "is never sold",
    "Nous ne partageons tes données": "We do not share your data",
    "qu'avec les services strictement nécessaires": "except with services strictly necessary",
    "à des tiers.": "with third parties.",
    "nous ne vendons JAMAIS tes données à des tiers. Jamais.": "we NEVER sell your data to third parties. Ever.",
    "JAMAIS": "NEVER",
    "Aucune donnée envoyée.": "No data sent.",
    "Statistiques anonymes (optionnel)": "Anonymous statistics (optional)",
    "statistiques anonymes": "anonymous statistics",
    "optionnel": "optional",
    "— Anonymisés après 12 mois": "— Anonymized after 12 months",
    "— Aussi longtemps que tu utilises l'application": "— As long as you use the app",
    "— Effacées définitivement sous 30 jours": "— Permanently erased within 30 days",
    "— Envoi des avis (anonymisés)": "— Sending feedback (anonymized)",
    "— Pour la session utilisateur": "— For the user session",
    "— Pour sauvegarder tes préférences (thème, langue)": "— To save your preferences (theme, language)",
    "— Pour un fonctionnement hors-ligne": "— For offline use",
    "— Stockage sécurisé": "— Secure storage",
    "Connexion, réinitialisation de mot de passe, notifications": "Login, password reset, notifications",
    "connexion sécurisée": "secure login",
    "mot de passe confidentiel": "confidential password",
    "Chiffrement SSL/TLS": "SSL/TLS encryption",
    "Règles de sécurité Firestore": "Strict Firestore security rules",
    "Sauvegardes automatiques": "Automatic backups",
    "T'opposer": "Object to",
    "à certains traitements": "certain processing",
    "à toutes tes données personnelles": "all your personal data",
    "à l'adresse associée à ton compte": "at the address linked to your account",
    "tes données dans un format lisible": "your data in a readable format",
    "de tes données à tout moment en contactant le support.": "of your data at any time by contacting support.",
    "Tu peux demander la suppression": "You can request the deletion",
    "ton consentement à tout moment": "your consent at any time",
    "tes informations à tout moment": "your information at any time",
    "Utilisation frauduleuse de ton compte par un tiers": "Fraudulent use of your account by a third party",
    "Utilisation frauduleuse ou abusive du service": "Fraudulent or abusive use of the service",
    "Interruptions temporaires du service (maintenance, panne)": "Temporary service interruptions (maintenance, outage)",
    "Perte de données due à un problème technique": "Data loss due to a technical issue",
    "Résultats scolaires, quels qu'ils soient": "Academic results, of any kind",
    "Si tu n'acceptes pas ces conditions, tu dois cesser immédiatement d'utiliser nos services.": "If you do not accept these terms, you must immediately stop using our services.",
    "— Anonymisés après 12 mois ": "— Anonymized after 12 months",
    "ARVEXA School — Prépare ton BAC, construis ton avenir": "ARVEXA School — Prepare your BAC, build your future",
    "ARVEXA School — Hors ligne": "ARVEXA School — Offline",
    "Page introuvable | ARVEXA School": "Page not found | ARVEXA School",
    "ARVEXA | Planificateur Premium": "ARVEXA | Premium Planner",
    "ARVEXA — Groupe d'échange": "ARVEXA — Exchange group",
    "ARVEXA — Historique Réviseur": "ARVEXA — Reviser History",
    "ARVEXA — Mon cahier": "ARVEXA — My notebook",
    "ARVEXA — Réviseur": "ARVEXA — Reviser",
    "© 2026 ARVEXA School — Tous droits réservés": "© 2026 ARVEXA School — All rights reserved",
    "© 2026 ARVEXA School — Tous droits réservés •": "© 2026 ARVEXA School — All rights reserved •",
    "© 2026 ARVEXA School — Tous droits réservés.": "© 2026 ARVEXA School — All rights reserved.",
    "— Préparation BAC": "— BAC preparation",
    "— ARVEXA School": "— ARVEXA School",


    /* ── Compléments accueil & hero ── */
    "conçue": "designed",
    "pour les élèves": "for students",
    "pour identifier ce qu’il reste à retravailler.": "to identify what still needs work.",
    "un seul espace": "one single space",
    "Entraînement": "Training",
    "Quelle est la dérivée de": "What is the derivative of",

    /* ─ Page WhatsApp (post-inscription, v7.0) ─ */
    "ARVEXA — Rejoins le groupe": "ARVEXA — Join the group",
    "Une dernière étape": "One last step",
    "avant de commencer": "before you start",
    "Communauté": "Community",
    "Laisse ton numéro WhatsApp pour être invité(e) au groupe d’entraide et recevoir les informations importantes (cours, épreuves, annonces).": "Leave your WhatsApp number to get the study-group invite and receive important updates (lessons, exams, announcements).",
    "Ton numéro sert uniquement à la communauté ARVEXA : invitation au groupe d’entraide et annonces importantes. Tu pourras le modifier plus tard.": "Your number is used for the ARVEXA community only: study-group invite and important announcements. You can change it later.",
    "Numéro WhatsApp": "WhatsApp number",
    "Rejoindre le groupe WhatsApp": "Join the WhatsApp group",
    "Valider et continuer": "Confirm and continue",
    "Passer cette étape": "Skip this step",
    "Ton numéro reste privé et n’est jamais partagé": "Your number stays private and is never shared",
    "« Explique-moi la différence entre limite et continuité en une phrase. »": "“Explain the difference between limits and continuity in one sentence.”",
    "Suivre ses progrès": "Track your progress",
    "La plateforme se prend en main simplement : un compte, un tour d’horizon des outils, puis un travail régulier.": "The platform is simple to get started with: one account, a quick tour of the tools, then regular work.",
    "L’inscription ouvre un espace personnel. Les élèves déjà inscrits retrouvent leur tableau de bord en se connectant.": "Signing up opens a personal space. Students already registered find their dashboard by logging in.",
    "Chaque élève explore les cours, fiches et exercices des matières qui correspondent à sa classe et à ses besoins.": "Each student explores the lessons, sheets and exercises of the subjects that match their class and needs.",
    "Le travail régulier, associé au suivi, permet d’identifier les notions à consolider et de gagner en confiance.": "Regular work, combined with tracking, helps identify the notions to consolidate and build confidence.",
    "Un espace pensé pour la": "A space designed for",
    ", ouvert aux autres élèves": ", open to other students",
    "ARVEXA School accorde une attention particulière aux élèves de": "ARVEXA School pays special attention to students in",
    "L’objectif n’est pas de promettre la réussite, mais d’offrir un cadre clair pour": "The goal is not to promise success, but to offer a clear framework for",
    "travailler régulièrement": "working regularly",
    "Préparer les évaluations": "Prepare for assessments",
    "Crée ton compte pour découvrir les outils d’ARVEXA School et commencer à organiser tes révisions dès aujourd’hui.": "Create your account to discover ARVEXA School's tools and start organizing your revisions today.",
    "Retrouve ton espace personnel et continue ta préparation pour le BAC.": "Find your personal space and continue preparing for the BAC.",
    "structurés par matière et par chapitre": "organized by subject and by chapter",
    "pour s'entraîner": "to practice",
    ": calculatrice, formulaire, tableau périodique": ": calculator, formula sheets, periodic table",
    "du jour. Débloque": "of the day. Unlock",
    "avec ARV Assistant Premium.": "with ARV Assistant Premium.",
    "Réponses prioritaires": "Priority answers",
    "pour le moment": "at the moment",

    /* ── Mot de passe oublié ── */
    "Pas de panique ! Entre ton adresse e-mail : nous t'envoyons un code à 6 chiffres pour choisir un nouveau mot de passe.": "Don't panic! Enter your email address: we will send you a 6-digit code to choose a new password.",
    "Tu recevras un code à 6 chiffres valable": "You will receive a 6-digit code valid for",
    ". Pense à vérifier tes": ". Remember to check your",
    "Recevoir le code": "Get the code",
    "Code sécurisé à usage unique": "Single-use secure code",
    "Code envoyé à": "Code sent to",
    "Modifier": "Change",
    "Code à 6 chiffres": "6-digit code",
    "Nouveau mot de passe": "New password",
    "Réinitialiser le mot de passe": "Reset password",
    "Renvoyer le code": "Resend the code",
    "Entre les 6 chiffres du code.": "Enter the 6 digits of the code.",
    "Les mots de passe ne correspondent pas.": "Passwords do not match.",
    "Code incorrect. Vérifie et réessaie.": "Incorrect code. Check and try again.",
    "Code expiré. Demande un nouveau code.": "Code expired. Request a new code.",
    "Trop de tentatives. Demande un nouveau code.": "Too many attempts. Request a new code.",
    "Un code vient d'être envoyé. Attends un peu avant de redemander.": "A code was just sent. Wait a moment before requesting another one.",
    "L'envoi de l'e-mail a échoué. Réessaie dans un instant.": "The email could not be sent. Try again in a moment.",
    "Le mot de passe doit contenir au moins 6 caractères.": "The password must contain at least 6 characters.",
    "Problème de connexion. Vérifie ton réseau.": "Connection problem. Check your network.",
    "Code envoyé ! Vérifie ta boîte mail.": "Code sent! Check your inbox.",
    "Mot de passe modifié avec succès !": "Password changed successfully!",
    "modifié": "changed",
    "Ton mot de passe a été changé avec succès.": "Your password has been changed successfully.",
    "Tu peux dès maintenant te connecter avec.": "You can now log in with it.",
    "Une confirmation t'a été envoyée par e-mail": "A confirmation has been emailed to you",
    "Tu es déjà connecté": "You are already logged in",
    "Me déconnecter d'abord": "Log out first",
    "Déconnexion...": "Logging out...",
    "Format d'e-mail invalide": "Invalid email format",
    "oublié": "forgotten",
    "Pas de panique ! Entre ton adresse e-mail et nous t'enverrons un lien pour réinitialiser ton mot de passe.": "Don't panic! Enter your email address and we will send you a link to reset your password.",
    "Tu recevras un e-mail avec un lien sécurisé. Pense à vérifier tes": "You will receive an email with a secure link. Remember to check your",
    "Lien sécurisé par Firebase": "Secure link by Firebase",
    "envoyé": "sent",
    "Clique sur le lien de réinitialisation": "Click the reset link",
    "et courriers indésirables": "and junk mail",
    "Très faible": "Very weak",

    /* ── Conditions d'utilisation ── */
    "Bienvenue sur ARVEXA School. En utilisant notre application, tu acceptes les règles énoncées ci-dessous.": "Welcome to ARVEXA School. By using our app, you accept the rules stated below.",
    ", tu reconnais avoir lu, compris et accepté sans réserve les présentes Conditions d'utilisation.": ", you acknowledge that you have read, understood and unconditionally accepted these Terms of Use.",
    "Ces conditions s'appliquent à tous les utilisateurs, qu'ils soient en compte gratuit ou Premium.": "These terms apply to all users, whether on a free or Premium account.",
    "ARVEXA School est une": "ARVEXA School is a",
    "plateforme éducative": "educational platform",
    "conçue pour aider les élèves de Terminale à préparer leur BAC.": "designed to help Terminale students prepare for their BAC.",
    "Fournir des informations": "Provide",
    "exactes et à jour": "accurate and up-to-date information",
    "informer immédiatement": "notify immediately",
    "de toute utilisation non autorisée": "of any unauthorized use",
    "Ta responsabilité :": "Your responsibility:",
    "tu es seul responsable de toutes les activités effectuées depuis ton compte. Ne partage jamais tes identifiants.": "you are solely responsible for all activity carried out from your account. Never share your credentials.",
    "Nous nous réservons le droit de": "We reserve the right to",
    "Nous pouvons": "We can",
    "ces conditions à tout moment.": "these terms at any time.",
    "tout compte en cas de :": "any account in case of:",
    "Violation des présentes conditions": "Violation of these terms",
    "En utilisant ARVEXA School, tu t'engages à": "By using ARVEXA School, you agree to",
    "Publier des contenus": "Publish",
    "illégaux, violents, haineux ou offensants": "illegal, violent, hateful or offensive content",
    "ou des publicités non autorisées": "or unauthorized advertising",
    "Copier, revendre ou redistribuer le contenu pédagogique": "Copy, resell or redistribute the educational content",
    "Utiliser des": "Using",
    "bots ou scripts automatisés": "bots or automated scripts",
    "Usurper l'identité d'un autre utilisateur": "Impersonate another user",
    "donne accès à l'ensemble des contenus et fonctionnalités avancées.": "gives access to all content and advanced features.",
    "les abonnements ne sont pas remboursables, sauf cas exceptionnel (erreur technique de notre part).": "subscriptions are non-refundable, except in exceptional cases (technical error on our part).",
    "ton abonnement ne se renouvelle PAS automatiquement. Tu recevras un rappel avant expiration.": "your subscription does NOT renew automatically. You will receive a reminder before it expires.",
    "Tout le contenu d'ARVEXA School (textes, cours, exercices, corrections, logos, design, code source) est la": "All ARVEXA School content (texts, lessons, exercises, corrections, logos, design, source code) is the",
    "propriété exclusive": "exclusive property",
    "d'ARVEXA School et protégé par les lois sur le droit d'auteur.": "of ARVEXA School and protected by copyright laws.",
    "Copier ou reproduire tout ou partie du contenu": "Copy or reproduce all or part of the content",
    "Utiliser notre marque sans autorisation écrite": "Use our brand without written permission",
    "Toute utilisation non autorisée pourra faire l'objet de": "Any unauthorized use may lead to",
    "tu peux à tout moment demander la suppression de ton compte et de tes données en contactant le support.": "you can request the deletion of your account and your data at any time by contacting support.",
    "ARVEXA School s'engage à :": "ARVEXA School is committed to:",
    "Fournir un service": "Provide a",
    "de qualité": "quality service",
    "la sécurité": "the security",
    "de tes données": "of your data",
    "Répondre à tes demandes dans les": "Answer your requests within the",
    "meilleurs délais": "shortest possible time",
    "ne peut être tenu responsable": "cannot be held liable",
    "Disponibilité :": "Availability:",
    "nous visons une disponibilité de 99% mais ne pouvons la garantir en cas de force majeure.": "we aim for 99% availability but cannot guarantee it in case of force majeure.",
    "dans l'application": "in the app",
    "Par un": "By a",
    "sur le tableau de bord": "on the dashboard",
    "En continuant d'utiliser ARVEXA School après modification, tu acceptes automatiquement les nouvelles conditions.": "By continuing to use ARVEXA School after changes, you automatically accept the new terms.",
    "Une question sur ces conditions ? Contacte-nous :": "A question about these terms? Contact us:",
    "En continuant à utiliser ARVEXA School, tu confirmes avoir lu et accepté ces Conditions d'utilisation.": "By continuing to use ARVEXA School, you confirm that you have read and accepted these Terms of Use.",

    /* ── Politique de confidentialité ── */
    "confidentialité": "privacy",
    "Chez ARVEXA School, ta vie privée est sacrée. Voici comment nous protégeons tes données personnelles.": "At ARVEXA School, your privacy is sacred. Here is how we protect your personal data.",
    "ARVEXA School s'engage à": "ARVEXA School is committed to",
    "protéger ta vie privée": "protecting your privacy",
    "et à traiter tes données personnelles avec le plus grand soin.": "and to handling your personal data with the greatest care.",
    "quelles données nous collectons": "what data we collect",
    "nous les collectons, et": "we collect it, and",
    "tu peux les contrôler.": "you can control it.",
    "Nous collectons uniquement les données": "We only collect the data",
    "strictement nécessaires": "strictly necessary",
    "Personnaliser ton expérience et ton profil": "Personalize your experience and your profile",
    "Personnalisation de ton compte (optionnel)": "Account personalization (optional)",
    ": ta localisation, tes contacts, tes SMS, tes photos personnelles ou tes autres applications.": ": your location, your contacts, your SMS, your personal photos or your other apps.",
    "Permettre ta": "Enable your",
    "Afficher ta": "Show your",
    "dans les matières": "in the subjects",
    "Sauvegarder tes": "Save your",
    "et tes": "and your",
    "Traiter ton": "Process your",
    "si tu en as un": "if you have one",
    "T'envoyer des": "Send you",
    "Améliorer l'application grâce aux": "Improve the app thanks to",
    "tes données à des fins publicitaires ou de revente.": "your data for advertising or resale purposes.",
    "Nous n'utilisons": "We never use",
    "JAMAIS": "",
    "AUCUN": "any",
    "annonceur, courtier ou entreprise tierce.": "advertiser, broker or third-party company.",
    "tes données. Nous ne les partageons avec": "your data. We do not share it with",
    ", l'une des plateformes les plus sécurisées au monde.": ", one of the most secure platforms in the world.",
    "Les mesures de sécurité incluent :": "Security measures include:",
    "de toutes les communications": "of all communications",
    "aux données par l'équipe technique": "to data by the technical team",
    "Même nous, administrateurs, ne pouvons pas voir ton mot de passe. Il est chiffré de bout en bout.": "Even us, the administrators, cannot see your password. It is encrypted end to end.",
    "Pour exercer ces droits, contacte-nous par WhatsApp ou par email. Nous répondons sous 72 heures.": "To exercise these rights, contact us on WhatsApp or by email. We respond within 72 hours.",
    "ARVEXA School est destinée aux élèves de": "ARVEXA School is intended for students in",
    "Terminale (16 ans et plus)": "Terminale (16 and over)",
    "Nous pouvons mettre à jour cette politique pour refléter des changements dans nos pratiques.": "We may update this policy to reflect changes in our practices.",
    ", tu seras informé par :": ", you will be notified by:",
    "Une question sur ta vie privée ? Contacte notre équipe :": "A question about your privacy? Contact our team:",
    "🔒 Ta vie privée est protégée": "🔒 Your privacy is protected",
    "En continuant à utiliser ARVEXA School, tu acceptes cette Politique de confidentialité.": "By continuing to use ARVEXA School, you accept this Privacy Policy.",

    /* ── Descriptions outils ── */
    "Ajoute tes cours (texte, photo ou voix). ARVEXA organise automatiquement tes révisions et détecte tes lacunes.": "Add your lessons (text, photo or voice). ARVEXA automatically organizes your revisions and detects your gaps.",
    "Fiches de révision, flashcards et quiz générés à la demande sur n'importe quel chapitre du programme.": "Revision sheets, flashcards and quizzes generated on demand for any chapter of the curriculum.",
    "Simule les conditions réelles du BAC. Sujets complets, chronomètre, correction détaillée par question.": "Simulate real BAC conditions. Full papers, timer, detailed correction for each question.",
    "Défi mathématique chronométré. Entraîne ton cerveau, gravis les niveaux et décroche les 33 étoiles.": "Timed math challenge. Train your brain, climb the levels and grab the 33 stars.",
    "Toutes les formules de maths, physique, chimie et SVT. Recherche rapide, favoris et explications.": "All the formulas of maths, physics, chemistry and biology. Quick search, favorites and explanations.",
    "Toutes les fonctions : trigo, log, puissances, constantes et conversions d'unités. Mode DEG / RAD.": "All the functions: trig, log, powers, constants and unit conversions. DEG / RAD mode.",
    "Les 118 éléments avec masse molaire, configuration électronique et un mode BAC pour réviser les essentiels.": "The 118 elements with molar mass, electron configuration and a BAC mode to revise the essentials.",
    "Organise tes révisions semaine par semaine et suis tes objectifs jusqu'au jour de l'examen.": "Organize your revisions week by week and follow your goals until exam day.",

    /* ── Planificateur & calculatrice ── */
    "personnalisé": "personalized",
    "Connecte-toi pour utiliser le planificateur.": "Log in to use the planner.",
    "Accès": "Access",
    "Le planificateur analyse tes résultats d'examen et construit un programme sur mesure grâce à l'IA.": "The planner analyzes your exam results and builds a tailor-made program thanks to AI.",

    /* ── MathMind ── */
    "Parcours Terminale · Mathématiques": "Terminale track · Mathematics",
    "🌱 À toi de jouer": "🌱 Your turn",
    "précision": "accuracy",
    "Modules, arguments et écritures exponentielles. Encore": "Moduli, arguments and exponential forms. One more",
    "pour décrocher tes premières étoiles.": "to earn your first stars.",
    "Lancer le quiz": "Start the quiz",
    "Voir la fiche": "View the sheet",
    "chapitres explorés": "chapters explored",
    "explorés": "explored",
    "Modules, arguments et écritures exponentielles.": "Moduli, arguments and exponential forms.",
    "Calcul de probabilités": "Probability calculation",
    "Issues, arbres et probabilités conditionnelles.": "Outcomes, trees and conditional probability.",
    "Variable aléatoire": "Random variable",
    "Espérance, variance et loi binomiale.": "Expectation, variance and binomial law.",
    "Un chapitre par question, tous les thèmes mélangés. Le vrai test pour vérifier que tout est connecté.": "One chapter per question, all topics mixed. The real test to check that everything is connected.",
    "4 formules clés": "4 key formulas",
    "Fonction numérique": "Numerical function",
    "Limites, dérivées et variations.": "Limits, derivatives and variations.",
    "ln, équations et dérivées.": "ln, equations and derivatives.",
    "Propriétés, dérivées et limites.": "Properties, derivatives and limits.",
    "Calcul intégral": "Integral calculus",
    "Primitives, aires et intégrales définies.": "Antiderivatives, areas and definite integrals.",
    "Équations différentielles": "Differential equations",
    "Suites numériques": "Sequences",
    "Suites arithmétiques, géométriques et limites.": "Arithmetic, geometric sequences and limits.",
    "Moyennes, dispersion et corrélation.": "Means, dispersion and correlation.",
    "Forme algébrique": "Algebraic form",
    "Conjugué": "Conjugate",
    "Écriture complexe": "Complex form",
    ", avec": ", with",
    "Réunion": "Union",
    "Indépendance": "Independence",
    "Complémentaire": "Complement",
    "Espérance": "Expectation",
    "Écart-type": "Standard deviation",
    "Dérivée et sens": "Derivative and direction",
    "donne les variations de": "gives the variations of",
    "Dérivée": "Derivative",
    "est défini pour": "is defined for",
    "Réciprocité": "Reciprocity",
    "Commence un chapitre pour lancer ta progression et gagner tes premières étoiles.": "Start a chapter to kick-start your progress and earn your first stars.",
    "bonnes réponses": "correct answers",
    "série max": "best streak",
    "Premier pas": "First step",
    "Jouer un premier chapitre": "Play a first chapter",
    "À venir": "Coming soon",
    "Maîtrise": "Mastery",
    "Décrocher 3 étoiles sur un chapitre": "Get 3 stars on a chapter",
    "Jouer 5 chapitres différents": "Play 5 different chapters",
    "Atteindre une série de 5": "Reach a streak of 5",
    "Répondre à 50 questions": "Answer 50 questions",
    "Légende": "Legend",
    "Obtenir 3 étoiles partout": "Get 3 stars everywhere",
    "📈 Détail par chapitre": "📈 Detail per chapter",
    "Termine un quiz pour retrouver ton score et tes étoiles ici.": "Finish a quiz to see your score and stars here.",
    "gagnés pendant la session": "earned during the session",
    "Progrès": "Progress",
    "pour": "for",
    "Théorème fondamental": "Fundamental theorem",
    "Linéarité": "Linearity",
    "Positivité": "Positivity",
    "L’aire sous la courbe de": "The area under the curve of",
    "Équation homogène": "Homogeneous equation",
    "Elle détermine la constante": "It determines the constant",
    "Arithmétique": "Arithmetic",
    "Géométrique": "Geometric",
    "Somme géométrique": "Geometric sum",
    "Corrélation": "Correlation",
    "est compris entre": "lies between",
    "Suivi personnalisé": "Personalized tracking",
    "Visualise ta maîtrise, repère les chapitres à consolider et garde une trace de tes dernières sessions.": "Visualize your mastery, spot the chapters to consolidate and keep track of your latest sessions.",
    "maîtrise": "mastery",
    "ton compte et tes données": "your account and your data",
    "ARVEXA — Mon profil": "ARVEXA — My profile",

    /* ── Paragraphes longs (auth-choice, outils, abonnement, léger) ── */
    "La plateforme": "The platform",
    ", qui préparent un BAC exigeant. La plateforme met à leur disposition des cours structurés, des fiches et des exercices adaptés aux matières scientifiques et à l’organisation du travail personnel.": ", who are preparing for a demanding BAC. The platform provides them with structured lessons, sheets and exercises suited to the science subjects and to organizing personal work.",
    ", revoir les notions difficiles, s’entraîner et préparer sereinement les évaluations. Les élèves d’autres séries, classes ou systèmes scolaires sont également les bienvenus.": ", review difficult notions, practice and calmly prepare for assessments. Students from other tracks, classes or school systems are also welcome.",
    ". Tu pourras en régénérer un nouveau plus tard, mais avec de nouveaux crédits.": ". You will be able to generate a new one later, but with new credits.",
    "ARVEXA School est un outil de soutien. Nous ne garantissons pas la réussite à l'examen, celle-ci dépendant de ton travail personnel.": "ARVEXA School is a support tool. We do not guarantee exam success, as it depends on your personal work.",
    "ARVEXA School réunit cours, exercices, fiches de révision et outils de suivi dans un espace pensé pour les élèves qui préparent leur BAC — avec une attention particulière portée à la Terminale D.": "ARVEXA School brings together lessons, exercises, revision sheets and tracking tools in a space designed for students preparing their BAC — with special attention given to Terminale D.",
    "Accède à tous les chapitres, exercices et corrections pour préparer ton BAC en toute confiance !": "Access all the chapters, exercises and corrections to prepare for your BAC with confidence!",
    "Accède à tous les chapitres, exercices, corrections et plus de fonctionnalités avec Premium.": "Access all the chapters, exercises, corrections and more features with Premium.",
    "Analyse intelligente de tes examens par IA. Priorités, sessions détaillées, objectifs concrets. Un vrai copilote pour ton BAC.": "Smart AI analysis of your exams. Priorities, detailed sessions, concrete goals. A true co-pilot for your BAC.",
    "Ces services respectent des normes strictes de protection des données et ne peuvent pas utiliser tes informations à d'autres fins.": "These services follow strict data protection standards and cannot use your information for other purposes.",
    "Cette page teste si le tutoriel est correctement installé. Ouvre-la sur ton téléphone, puis fais une capture d'écran ou copie les résultats.": "This page checks that the tutorial is properly installed. Open it on your phone, then take a screenshot or copy the results.",
    "Chaque outil répond à un moment précis du travail personnel : comprendre, s’entraîner, être aidé, puis mesurer ses progrès.": "Each tool answers a specific moment of personal work: understand, practice, get help, then measure your progress.",
    "Consulte tes résultats, révise tes erreurs et suis ta progression.": "Review your results, learn from your mistakes and follow your progress.",
    "Des nombres complexes aux statistiques : 88 questions corrigées, des fiches de formules et un défi final pour tout relier.": "From complex numbers to statistics: 88 graded questions, formula sheets and a final challenge to connect it all.",
    "Des outils d’assistance sont intégrés à la plateforme pour aider à clarifier un point de cours, à reformuler une notion ou à préparer une révision.": "Assistance tools are built into the platform to help clarify a lesson point, rephrase a notion or prepare a revision.",
    "La plateforme rassemble les supports utiles au quotidien — cours, fiches, exercices, outils de suivi — dans un environnement unique, pour éviter de disperser son attention entre plusieurs sources.": "The platform gathers the materials useful every day — lessons, sheets, exercises, tracking tools — in a single environment, so your attention is not scattered across several sources.",
    "La progression s’observe dans le temps : chapitres travaillés, exercices réalisés, matières plus ou moins maîtrisées. Ce suivi aide à identifier les points à retravailler en priorité.": "Progress shows over time: chapters worked on, exercises completed, subjects more or less mastered. This tracking helps identify the points to work on first.",
    "Les cours et les fiches de révision rassemblent les notions essentielles de chaque chapitre. Ils servent à revoir une leçon, à préparer une interrogation ou à retrouver rapidement une définition avant un devoir.": "The lessons and revision sheets gather the essential notions of each chapter. They help you review a lesson, prepare for a test or quickly find a definition before homework.",
    "Les exercices permettent de mettre en application ce qui a été appris et de se préparer aux interrogations, aux devoirs et aux épreuves du BAC.": "The exercises let you put into practice what you have learned and get ready for tests, homework and the BAC exams.",
    "Les formules essentielles de chaque chapitre, réunies dans un seul endroit. Cherche une notion, révise, puis lance le quiz.": "The essential formulas of each chapter, gathered in one place. Search a notion, revise, then start the quiz.",
    "Outils intelligents, calculateurs, fiches de révision et assistants IA. Tout est réuni ici pour t'accompagner du premier jour jusqu'à l'examen.": "Smart tools, calculators, revision sheets and AI assistants. Everything is gathered here to support you from day one to the exam.",
    "Passe à Premium pour débloquer tous les chapitres, exercices et corrections de cette matière.": "Go Premium to unlock all the chapters, exercises and corrections of this subject.",
    "Retrouve tous tes cahiers générés par matière et par chapitre. Clique pour reprendre où tu t'es arrêté.": "Find all your notebooks generated by subject and chapter. Click to resume where you left off.",
    "Si tu es parent et que tu découvres que ton enfant de moins de 13 ans a créé un compte sans ton accord, contacte-nous immédiatement pour une suppression.": "If you are a parent and you discover that your child under 13 has created an account without your consent, contact us immediately for deletion.",
    "Ton abonnement Premium a pris fin. Renouvelle-le pour continuer à profiter de tous les contenus ARVEXA School.": "Your Premium subscription has ended. Renew it to keep enjoying all ARVEXA School content.",
    "Ton tuteur personnel IA. Il connaît ton profil, tes examens et tes révisions. Pose-lui n'importe quelle question sur ton programme.": "Your personal AI tutor. It knows your profile, your exams and your revisions. Ask it any question about your program.",
    "Tu peux à tout moment vider le stockage local depuis les paramètres de ton navigateur. Cela réinitialisera tes préférences mais ne supprimera pas ton compte.": "You can clear local storage at any time from your browser settings. This will reset your preferences but will not delete your account.",
    "est un espace d’apprentissage en ligne qui accompagne les élèves dans leurs révisions et dans la préparation de leurs examens. L’objectif est simple : rendre le travail personnel plus clair, plus régulier et plus efficace.": "is an online learning space that supports students in their revisions and exam preparation. The goal is simple: make personal work clearer, more regular and more effective.",
    "pour nous aider à améliorer ARVEXA School. Ça ne prend que 30 secondes et ça nous aide énormément !": "to help us improve ARVEXA School. It only takes 30 seconds and it helps us a lot!",
    "toute violation peut entraîner un avertissement, une suspension temporaire ou un bannissement définitif sans remboursement.": "any violation may lead to a warning, a temporary suspension or a permanent ban without refund.",
    "Revendre ou commercialiser notre contenu": "Resell or commercialize our content",
    "Diffuser publiquement nos cours ou exercices": "Publicly distribute our lessons or exercises",
    ". Tu ne pourras plus consulter les détails de cet examen.": ". You will no longer be able to view this exam's details.",

    /* ── Tutoriel & modale Premium ── */
    "Suivant →": "Next →",
    "Le temps qu'il reste avant le BAC, jour après jour. Reviens chaque jour pour garder le cap !": "The time left before the BAC, day after day. Come back every day to stay on track!",
    "Ton carnet intelligent. Ajoute tes cours, l'IA les analyse et te dit exactement quoi réviser. Ton meilleur allié pour progresser.": "Your smart notebook. Add your lessons, the AI analyzes them and tells you exactly what to revise. Your best ally to progress.",
    "ARV-Assistant, Réviseur, MathMind, Planificateur… Tout ton arsenal t'attend dans la page Outils. ARV est ton tuteur IA, il te connaît déjà.": "ARV-Assistant, Reviser, MathMind, Planner… Your whole arsenal is waiting in the Tools page. ARV is your AI tutor, it already knows you.",
    "Tu connais maintenant l'essentiel. Explore tes matières, lance ton premier examen et bonne réussite pour ton BAC !": "You now know the essentials. Explore your subjects, start your first exam and good luck with your BAC!",
    "Faisons un tour en 1 minute. Tu vas découvrir comment réviser efficacement et décrocher ton BAC.": "A 1-minute tour. You are about to discover how to revise efficiently and nail your BAC.",
    "👤 Ton profil": "👤 Your profile",
    "Ton profil, ton abonnement, tes préférences. La cloche 🔔 à côté, ce sont tes notifications.": "Your profile, your subscription, your preferences. The 🔔 bell next to it is your notifications.",
    "🧰 Tous tes outils": "🧰 All your tools",
    "Maths, Physique, Chimie, SVT. Clique sur une matière pour accéder à ses chapitres, cours, exercices et corrections.": "Maths, Physics, Chemistry, Biology. Click a subject to access its chapters, lessons, exercises and corrections.",
    "Dans ton profil, clique « Télécharger tout hors ligne ». Tous tes cours restent accessibles au village ou en déplacement, même sans réseau.": "In your profile, tap “Download everything offline”. All your lessons stay available in the village or on the move, even without network.",
    "Planificateur IA personnalisé": "Personalized AI planner",
    "Réviseur et génération de fiches illimités": "Unlimited Reviser and sheet generation",
    "Examens IA illimités + historique complet": "Unlimited AI exams + full history",
    "ARV-Assistant illimité (60 questions/jour)": "Unlimited ARV-Assistant (60 questions/day)",

    /* ── Réglage Langue (Profil) ── */
    "Langue": "Language",
    "Utilise ARVEXA en français ou en anglais": "Use ARVEXA in French or English",
    "Choix de la langue : français ou anglais": "Language choice: French or English",
    /* ── Attributs (placeholder / title / aria-label) ── */
    "exemple@email.com": "example@email.com",
    "email@exemple.com": "email@example.com",
    "ton-email@exemple.com": "your-email@example.com",
    "Entre ton mot de passe": "Enter your password",
    "Retape ton mot de passe": "Re-enter your password",
    "Minimum 6 caractères": "Minimum 6 characters",
    "Nom de ton lycée": "Your school's name",
    "Ton nom": "Your name",
    "Ton prénom": "Your first name",
    "Dis-nous ce que tu penses d'ARVEXA School, ce qui te plaît, ce qu'on pourrait améliorer...": "Tell us what you think of ARVEXA School, what you like, what could be improved...",
    "Afficher le mot de passe": "Show password",
    "Aperçu illustratif de l'interface ARVEXA School : compte à rebours BAC, progression et matières": "Illustrative preview of the ARVEXA School interface: BAC countdown, progress and subjects",
    "Aperçu illustratif d’un exercice": "Illustrative exercise preview",
    "Aperçu illustratif d’une fiche de révision": "Illustrative revision sheet preview",
    "Les trois piliers de la démarche ARVEXA School": "The three pillars of the ARVEXA School approach",
    "Erreur": "Error",
    "État": "Status",
    "Une erreur est survenue. Réessaie.": "An error occurred. Try again.",
    "Problème de connexion. Vérifie ta connexion internet.": "Connection problem. Check your internet connection.",
    "Trop de tentatives. Réessaie dans quelques minutes.": "Too many attempts. Try again in a few minutes.",
    "Service momentanément saturé. Réessaie dans quelques secondes.": "Service briefly busy. Try again in a few seconds.",
    "Beaucoup d'élèves en ce moment. Réessaie dans une minute.": "Many students right now. Try again in a minute.",
    "Beaucoup d’élèves en ce moment. Réessaie dans une minute.": "Many students right now. Try again in a minute.",
    "Session expirée": "Session expired",
    "Session expirée. Reconnecte-toi.": "Session expired. Log in again.",
    "Non authentifié.": "Not authenticated.",
    "Ton compte est temporairement en pause. Contacte le support.": "Your account is temporarily paused. Contact support.",
    "Bon après-midi": "Good afternoon",
    "Impossible de copier": "Cannot copy",
    "Impossible de supprimer": "Cannot delete",
    "Aucun résultat": "No results",
    "Ajouté aux favoris": "Added to favorites",
    "Appuie sur le cœur pour sauvegarder une formule.": "Tap the heart to save a formula.",
    "Image trop lourde après compression": "Image too large after compression",
    "Le fichier n'est pas une image": "The file is not an image",
    "Impossible de charger cet examen.": "Cannot load this exam.",
    "Impossible de charger cette conversation": "Cannot load this conversation",
    "Impossible de charger le chapitre :": "Cannot load the chapter:",
    "Impossible de charger le plan.": "Cannot load the plan.",
    "Impossible de charger les messages": "Cannot load the messages",
    "Impossible de charger l'historique.": "Cannot load history.",
    "Impossible de charger le cahier": "Cannot load the notebook",
    "Impossible de créer la notification admin :": "Cannot create the admin notification:",
    "Impossible de créer ton profil. Vérifie ta connexion et réessaie.": "Cannot create your profile. Check your connection and try again.",
    "Impossible de créer le profil après 3 tentatives.": "Cannot create your profile after 3 attempts.",
    "Dicter à la voix": "Voice dictation",
    "Ton texte": "Your text",
    "Dictée vocale": "Voice dictation",
    "Passer à la dictée vocale": "Switch to voice dictation",
    "Revenir au texte": "Back to text",
    "Appuie et parle — durée illimitée": "Tap and speak — unlimited time",
    "J'écoute… Appuie pour arrêter": "Listening… Tap to stop",
    "Ton texte apparaîtra ici en direct…": "Your text will appear here live…",
    "Limite de 2 500 caractères atteinte — dictée arrêtée": "2,500-character limit reached — dictation stopped",
    "Micro bloqué — autorise le micro dans les réglages du navigateur": "Microphone blocked — allow it in your browser settings",
    "Dictée interrompue (réseau) — ton texte est conservé": "Dictation interrupted (network) — your text is saved",
    "Aucun micro détecté": "No microphone detected",
    "La dictée vocale n'est pas disponible sur ce navigateur. Utilise Chrome, ou saisis ton texte à l'étape 1.": "Voice dictation is not available in this browser. Use Chrome, or type your text in step 1.",
    "Erreur de reconnaissance vocale": "Voice recognition error",
    "Impossible de démarrer la dictée": "Cannot start dictation",
    "Arrêter la dictée": "Stop dictation",
    "Retourner à mon cahier": "Back to my notebook",
    "Pas d'examen en anglais": "No exam in English",
    "Passer en mode examen": "Switch to exam mode",
    "Teste-toi sur cette partie": "Test yourself on this part",
    "Anglais": "English",
    "Le mode examen n'est pas disponible pour l'anglais. Utilise la banque de questions et les QCM de cette section pour te tester.": "Exam mode is not available for English. Use the question bank and the MCQs of this section to test yourself.",
    "Masquer le mot de passe": "Hide password",
    "Au moins 2 caractères": "At least 2 characters",
    "Au moins 6 caractères": "At least 6 characters",
    "Adresse e-mail invalide": "Invalid email address",
    "Adresse e-mail invalide.": "Invalid email address.",
    "Plus tard": "Later",
    "Contenu hors ligne complet": "Complete offline content",
    "questions ARV restantes": "ARV questions left",
    "Tu as vu l'essentiel. Passe à Premium pour aller plus loin.": "You've seen the essentials. Go Premium to go further.",
    "Arv-progress": "ARV Progress",
    "🌱 Tu as le temps": "🌱 You have time",
    "Date indicative": "Indicative date",
    "Ton": "Your",
    "compte": "matters",
    "Ton avis est": "Your feedback is",
    "précieux": "valuable",
    "pour nous aider à améliorer ARVEXA School.": "and helps us improve ARVEXA School.",
    "Général": "General",
    "Contenu": "Content",
    "Ton message": "Your message",
    "Avis envoyé.": "Feedback sent.",
    "Avis enregistré. Notification Telegram différée.": "Feedback saved. Telegram notification delayed.",
    "Tu as le temps, commence tranquillement": "You have time, start calmly",
    "Bon rythme, continue comme ça": "Good pace, keep it up",
    "Concentre-toi, chaque jour compte": "Focus, every day counts",
    "Sprint final, donne tout": "Final sprint, give it your all",
    "Accélère, c'est le moment clé": "Speed up, this is the key moment",
    "C'est maintenant ! Dernière ligne droite": "Now! The final stretch",
    "C'est le jour J ! Bonne chance !": "It's the big day! Good luck!",
    "🔓 Compte gratuit": "🔓 Free account",
    "Paiement sécurisé": "Secure payment",
    "Activation rapide": "Quick activation",
    "Référence": "Reference",
    "Envoyée": "Sent",
    "actif": "active",
    "tous": "all",
    "les contenus ARVEXA School.": "of ARVEXA School content.",
    "Tous les outils avancés": "All advanced tools",
    "💳 Confirmation de": "💳 Confirm your",
    "💡 Économie réalisée": "💡 You save",
    "Clique sur": "Tap",
    "\"Confirmer et envoyer\"": "\"Confirm and send\"",
    "qui suivent": "that follow.",
    "Plateforme": "Platform",
    "Parcours": "Journey",
    "Cours & fiches": "Lessons & sheets",
    "Assistance": "Support",
    "Le parcours": "The journey",
    "Terminale D en Afrique francophone": "Terminale D in French-speaking Africa",
    "La": "The",
    ", puis": ", then",
    "d'ARVEXA School.": "of ARVEXA School.",
    "d'utilisation": "of Use",
    "Nos services incluent notamment :": "Our services include:",
    "📚 Des": "📚",
    "✏️ Des": "✏️",
    "🛠️ Des": "🛠️",
    "🎯 Un": "🎯",
    "💬 Un": "💬",
    "🤖 Des outils": "🤖 Tools",
    "d'intelligence artificielle": "with artificial intelligence",
    "Important :": "Important:",
    "Par": "Via",
    "Nous": "We",
    "suspendre ou supprimer": "suspend or delete",
    "NE PAS": "NOT",
    "Diffuser du": "Distribute",
    "L'": "The",
    "abonnement Premium": "Premium subscription",
    "Mynita, Wave ou Amanata": "Mynita, Wave or Amanata",
    "manuelle": "manual",
    "poursuites judiciaires": "legal action",
    "strictement interdit": "strictly forbidden",
    "(personnalisation)": "(personalization)",
    "(connexion et notifications)": "(login and notifications)",
    "(paiements uniquement)": "(payments only)",
    "et accessible": "and accessible service",
    "Maintenir": "Maintain",
    "Cependant, ARVEXA School": "However, ARVEXA School",
    "bandeau visible": "visible banner",
    "Politique de": "Privacy",
    "Cette politique explique clairement": "This policy clearly explains",
    "nous les collectons": "we collect it",
    "au fonctionnement de l'application :": "for the app to work:",
    "Nous ne collectons": "We never collect",
    "jamais": "",
    "favoris": "favorites",
    "notifications": "important notifications",
    "importantes": "",
    "par Firebase Auth": "via Firebase Auth",
    "strictes": "",
    "quotidiennes": "daily",
    "Avis et retours": "Feedback and reviews",
    "ARVEXA School utilise :": "ARVEXA School uses:",
    "Stockage local": "Local storage",
    "aucun cookie publicitaire": "any advertising cookies",
    "ni de tracking tiers.": "or third-party tracking.",
    "Rectifier": "Correct",
    "Exporter": "Export",
    "Retirer": "Withdraw",
    "majeure": "major change",
    "(facile à moyen) puis": "(easy to medium) then",
    "(moyen à difficile).": "(medium to difficult).",
    "Analyse de la configuration": "Analyzing your setup",
    "Analyse de la configuration...": "Analyzing your setup...",
    "Analyse des exercices...": "Analyzing the exercises...",
    "Rédaction des exercices": "Writing the exercises",
    "Contrôle cohérence et réponses": "Checking consistency and answers",
    "Évaluation pédagogique": "Pedagogical review",
    "Résultats de l'examen": "Exam results",
    "Pourcentage": "Percentage",
    "Limite d'examens": "Exam limit",
    "atteinte": "reached",
    "Calcul du score...": "Calculating your score...",
    "Aucun détail disponible.": "No details available.",
    "Cette action est": "This action is",
    "définitive": "permanent",
    "Cahier supprimé": "Notebook deleted",
    "Réussite": "Success rate",
    "Limite": "Limit",
    "4 notions · ~15 secondes": "4 notions · ~15 seconds",
    "Aucune notion générée pour le moment.": "No notions generated yet.",
    "Aucune question générée. Réessaie.": "No questions generated. Try again.",
    "Limite de sections": "Section limit",
    "Actualisé": "Updated",
    "Aucune section à afficher.": "No sections to display.",
    "Ajoute tes notes personnelles...": "Add your personal notes...",
    "Analyse littéraire": "Literary analysis",
    "Août": "August",
    "Chargement du contenu...": "Loading content...",
    "📝 Mes": "📝 My",
    "Cette partie est": "This section is",
    "réservée": "reserved",
    "Ce chapitre est": "This chapter is",
    "réservé": "reserved",
    "Toutes les parties": "All sections",
    "Auteur": "Author",
    "Image": "Photo",
    "Tu ne peux plus envoyer de messages dans ce groupe. Contacte l'administrateur pour plus d'informations.": "You can no longer send messages in this group. Contact the administrator for more information.",
    "Aucun message pour le moment.": "No messages yet.",
    "Sois le premier à écrire !": "Be the first to write!",
    "Tableau de bord": "Dashboard",
    "Le Grand Mix": "The Grand Mix",
    "Prochaine étape": "Next step",
    "🏆 Mode final": "🏆 Final mode",
    "11 questions · 11 chapitres": "11 questions · 11 chapters",
    "Lancer": "Start",
    "Programme complet": "Full program",
    "11 fiches · 44 formules": "11 sheets · 44 formulas",
    "points": "points",
    "Activer le son": "Turn on sound",
    "Bonne réponse !": "Correct answer!",
    "Avec second membre": "With right-hand side",
    "Alterner les thèmes force le cerveau à choisir la bonne méthode. C'est pour cela que le Grand Mix est un excellent entraînement.": "Alternating topics forces your brain to pick the right method. That is what makes the Grand Mix such good practice.",
    "Après une erreur, lis l'explication et note la règle qui manquait. C'est exactement là que ton cerveau progresse.": "After a mistake, read the explanation and note the rule you were missing. That is exactly where your brain improves.",
    "Attaque le chapitre où tu es le moins à l'aise quand ton énergie est la plus haute, puis termine par un chapitre plaisir.": "Tackle the chapter you find hardest when your energy is highest, then finish with an easy chapter.",
    "Tout lire": "Read all",
    "Pas de": "No",
    "introuvable": "not found",
    "Mode BAC": "BAC mode",
    "Que faire maintenant ?": "What to do now?",
    "ARVEXA — Diagnostic": "ARVEXA — Diagnostics",
    "🔍 Diagnostic ARVEXA": "🔍 ARVEXA diagnostics",
    "=== FICHIERS RÉSEAU ===": "=== NETWORK FILES ===",
    "4. CSS tour-styles.css chargé": "4. CSS tour-styles.css loaded",
    "ARVEXA — PLAN DE RÉVISION": "ARVEXA — REVISION PLAN",
    "📊 RÉSUMÉ": "📊 SUMMARY",
    "🎯 OBJECTIF DE LA SEMAINE": "🎯 WEEKLY GOAL",
    "📋 PRIORITÉS": "📋 PRIORITIES",
    "📅 PLAN DE LA SEMAINE": "📅 WEEKLY PLAN",
    "💬 MESSAGE DU COACH": "💬 COACH MESSAGE",
    "🌱 Tu as le temps, commence tranquillement": "🌱 You have time, start calmly",
    "📚 Bon rythme, continue comme ça": "📚 Good pace, keep it up",
    "🔥 Concentre-toi, chaque jour compte": "🔥 Focus, every day counts",
    "⚡ Accélère, c'est le moment clé": "⚡ Speed up, this is the key moment",
    "🚀 Sprint final, donne tout": "🚀 Final sprint, give it your all",
    "🏆 C'est maintenant ! Dernière ligne droite": "🏆 Now! The final stretch",
    "🎉 C'est le jour J ! Bonne chance !": "🎉 It's the big day! Good luck!",
    "ARVEXA School — Accueil": "ARVEXA School — Home",
    "ARVEXA — Abonnement Premium": "ARVEXA — Premium subscription",
    "ARV Assistant — Ton tuteur IA": "ARV Assistant — Your AI tutor",
    "ARVEXA — Calculatrice scientifique": "ARVEXA — Scientific calculator",
    "ARVEXA — Chapitre": "ARVEXA — Chapter",
    "ARVEXA — Conditions d'utilisation": "ARVEXA — Terms of Use",
    "ARVEXA — Politique de confidentialité": "ARVEXA — Privacy Policy",
    "ARVEXA — Historique des examens": "ARVEXA — Exam history",
    "ARVEXA — Mode examen": "ARVEXA — Exam mode",
    "ARVEXA — Mot de passe oublié": "ARVEXA — Forgot password",
    "ARVEXA — Formulaires": "ARVEXA — Formula sheets",
    "ARVEXA — Lecture de cours": "ARVEXA — Lesson reader",
    "ARVEXA — Connexion": "ARVEXA — Log in",
    "ARVEXA — Matière": "ARVEXA — Subject",
    "ARVEXA School — Bienvenue": "ARVEXA School — Welcome",
    "ARVEXA — Outils & Ressources": "ARVEXA — Tools & Resources",
    "ARVEXA — Inscription": "ARVEXA — Sign up",
    "ARVEXA — Tableau périodique": "ARVEXA — Periodic table",
    "Première section": "First section",
    "Toutes matières": "All subjects",
    "Série de 3 jours": "3-day streak",
    "Série de 7 jours": "7-day streak",
    "« L'éducation est l'arme la plus puissante pour changer le monde. »": "« Education is the most powerful weapon to change the world. »",
    "« La discipline est le pont entre les objectifs et les accomplissements. »": "« Discipline is the bridge between goals and accomplishments. »",
    "« Petit à petit, l'oiseau fait son nid. »": "« Little by little, the bird builds its nest. »",
    "« Seul on va plus vite, ensemble on va plus loin. »": "« Alone you go faster, together you go further. »",
    "« Le succès, c'est d'aller d'échec en échec sans perdre son enthousiasme. »": "« Success is going from failure to failure without losing your enthusiasm. »",
    "« La connaissance est un trésor, mais la pratique en est la clé. »": "« Knowledge is a treasure, but practice is the key. »",
    "« Le génie est fait de 1 % d'inspiration et de 99 % de transpiration. »": "« Genius is 1% inspiration and 99% perspiration. »",
    "« Patience et longueur de temps font plus que force ni que rage. »": "« Patience and time achieve more than force or rage. »",
    "« Ce n'est pas parce que les choses sont difficiles que nous n'osons pas. »": "« It is not because things are difficult that we do not dare. »",
    "« Chaque chapitre maîtrisé aujourd'hui est une question gagnée demain. »": "« Every chapter mastered today is a question won tomorrow. »",
    "Proverbe": "Proverb",
    "Proverbe africain": "African proverb",
  };

  /* ── Normalisation + expansion des variantes ── */
  function norm(s) { return String(s).replace(/[\u2019\u2018]/g, "'").replace(/\s+/g, ' ').trim(); }

  var DICT = {};
  (function build() {
    var k, v;
    for (k in DICT_RAW) {
      if (Object.prototype.hasOwnProperty.call(DICT_RAW, k)) DICT[norm(k)] = DICT_RAW[k];
    }
    var keys = Object.keys(DICT);
    for (var i = 0; i < keys.length; i++) {
      k = keys[i];
      if (k.indexOf("'") !== -1) {
        v = k.replace(/'/g, '\u2019');
        if (!DICT[v]) DICT[v] = DICT[k];
      }
      if (k.indexOf('...') !== -1) {
        v = k.replace(/\.\.\./g, '\u2026');
        if (!DICT[v]) DICT[v] = DICT[k];
      }
    }
  })();

  function t(s) {
    var hit = DICT[norm(s)];
    return hit !== undefined ? hit : String(s);
  }

  /* ── Motifs dynamiques (dates, compteurs) — appliqués si le dictionnaire échoue ── */
  var UNITS_EN = {
    minute: 'minute', minutes: 'minute',
    heure: 'hour', heures: 'hour',
    jour: 'day', jours: 'day',
    semaine: 'week', semaines: 'week',
    mois: 'month'
  };

  var FR_DAYS_EN = {
    lundi: 'Monday', mardi: 'Tuesday', mercredi: 'Wednesday', jeudi: 'Thursday',
    vendredi: 'Friday', samedi: 'Saturday', dimanche: 'Sunday'
  };
  var FR_MONTHS_EN = {
    janvier: 'January', f\u00e9vrier: 'February', mars: 'March', avril: 'April',
    mai: 'May', juin: 'June', juillet: 'July', ao\u00fbt: 'August',
    septembre: 'September', octobre: 'October', novembre: 'November', d\u00e9cembre: 'December'
  };
  function matchCaseEn(src, dst) {
    if (src === src.toUpperCase() && src.length > 1) return dst.toUpperCase();
    if (src.charAt(0) === src.charAt(0).toUpperCase()) return dst.charAt(0).toUpperCase() + dst.slice(1);
    return dst;
  }
  function patternsReplace(s) {
    var out = s;
out = out.replace(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi, function (m) {
      var en = FR_DAYS_EN[m.toLowerCase()];
      return en ? matchCaseEn(m, en) : m;
    });
    out = out.replace(/\b(janvier|f\u00e9vrier|mars|avril|mai|juin|juillet|ao\u00fbt|septembre|octobre|novembre|d\u00e9cembre)\b/gi, function (m) {
      var en = FR_MONTHS_EN[m.toLowerCase()];
      return en ? matchCaseEn(m, en) : m;
    });
    out = out.replace(/\bNiv\.\s*(\d+)/g, 'Lv. $1');
    out = out.replace(/\b(?:Question|question)\s+(\d+)\s+sur\s+(\d+)/g, 'Question $1 of $2');
    out = out.replace(/\b(?:Étape|étape)\s+(\d+)\s*(?:\/|sur)\s*(\d+)/g, 'Step $1 of $2');
    out = out.replace(/\b(\d+)\s+étoile(?:s)?\s+sur\s+(\d+)/g, function (m, n, tot) {
      return n + ' ' + (n === '1' ? 'star' : 'stars') + ' out of ' + tot;
    });
    out = out.replace(/\b(\d+)\s+pour cent de maîtrise/g, '$1 percent mastery');
    out = out.replace(/\b(\d+)\s+fichiers?\s+téléchargés?\b/g, function (m, n) {
      return n === '1' ? '1 file downloaded' : n + ' files downloaded';
    });
    out = out.replace(/\b(\d+\s*\/\s*\d+)\s+débloqués\b/g, '$1 unlocked');
    out = out.replace(/\b(\d+)\s+chapitre(?:s)?\s+maîtrisé(?:s)?\s+sur\s+(\d+)/g, function (m, n, tot) {
      return n + ' ' + (n === '1' ? 'chapter' : 'chapters') + ' mastered out of ' + tot;
    });
    out = out.replace(/\b(\d+)\s+parenthèse\(s\)\s+ouverte\(s\)/g, '$1 open paren(s)');
    out = out.replace(/\bil y a\s+(\d+)\s+(minute|minutes|heure|heures|jour|jours|semaine|semaines|mois)\b/g,
      function (m, n, u) {
        var en = UNITS_EN[u] || u;
        return n + ' ' + en + (n === '1' ? '' : 's') + ' ago';
      });
    out = out.replace(/\bNiveau\s+(\d+)/g, 'Level $1');
    out = out.replace(/\bPartie\s+(\d+)/g, 'Section $1');
    out = out.replace(/\b(\d+)\s+session\b/g, function (m, n) { return n + (n === '1' ? ' session' : ' sessions'); });
    out = out.replace(/\bCurieux\b/g, 'Curious').replace(/\bApprenti\b/g, 'Apprentice')
      .replace(/\bAnalyste\b/g, 'Analyst').replace(/\bG\u00e9om\u00e8tre\b/g, 'Geometer')
      .replace(/\bMath\u00e9maticien\b/g, 'Mathematician').replace(/\bL\u00e9gende\b/g, 'Legend');
    out = out.replace(/\u00c9ch\u00e9ance\s*:\s*/g, 'Deadline: ');
    return out;
  }

  /* ── Configuration ── */
  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1,
    CODE: 1, PRE: 1, KBD: 1, MATH: 1,
    IFRAME: 1, SVG: 1, CANVAS: 1
  };
  var ATTR_NAMES = ['placeholder', 'aria-label', 'title', 'value'];

  function skipNode(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    while (el) {
      if (SKIP_TAGS[el.tagName]) return true;
      if (el.getAttribute) {
        if (el.getAttribute('translate') === 'no') return true;
      }
      if (el.classList && el.classList.contains('katex')) return true;
      if (el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  /* ── Traduction / restauration des nœuds texte ── */
  function translateTextNode(node, force) {
    var orig = node.nodeValue;
    if (!orig) return;
    var core = norm(orig);
    if (!core || core.length > 220) return;
    var hit = DICT[core];
    if (hit === undefined) hit = patternsReplace(core);
    if (hit === core) return; /* rien à traduire, ou déjà traduit (anti-boucle) */
    if (force || node.__arvexaOrig === undefined) node.__arvexaOrig = orig;
    var lead = orig.match(/^\s*/)[0];
    var trail = orig.match(/\s*$/)[0];
    node.nodeValue = lead + hit + trail;
  }

  function restoreTextNode(node) {
    if (node.__arvexaOrig !== undefined) {
      node.nodeValue = node.__arvexaOrig;
      delete node.__arvexaOrig;
    }
  }

  function walkText(root, en) {
    var walker;
    try {
      walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    } catch (e) { return; }
    var n, todo = [];
    while ((n = walker.nextNode())) {
      if (skipNode(n)) continue;
      todo.push(n);
    }
    for (var i = 0; i < todo.length; i++) {
      if (en) translateTextNode(todo[i], false);
      else restoreTextNode(todo[i]);
    }
  }

  /* ── Attributs traduisibles (placeholder, aria-label, title, value boutons) ── */
  function translateAttrs(root, en) {
    var els;
    try {
      els = root.querySelectorAll('[placeholder],[aria-label],[title],input[type="submit"],input[type="button"]');
    } catch (e) { return; }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (skipNode(el)) continue;
      for (var j = 0; j < ATTR_NAMES.length; j++) {
        var a = ATTR_NAMES[j];
        if (!el.hasAttribute || !el.hasAttribute(a)) continue;
        var val = el.getAttribute(a);
        if (!val) continue;
        var core = norm(val);
        if (!core || core.length > 220) continue;
        if (en) {
          if (a === 'value' && el.type !== 'submit' && el.type !== 'button') continue;
          var hit = DICT[core] !== undefined ? DICT[core] : patternsReplace(core);
          if (hit === core) continue;
          if (!el.__arvexaAttrs) el.__arvexaAttrs = {};
          if (el.__arvexaAttrs[a] === undefined) el.__arvexaAttrs[a] = val;
          el.setAttribute(a, hit);
        } else if (el.__arvexaAttrs && el.__arvexaAttrs[a] !== undefined) {
          el.setAttribute(a, el.__arvexaAttrs[a]);
          delete el.__arvexaAttrs[a];
        }
      }
    }
  }

  /* ── Marquage explicite data-i18n (feuilles uniquement) ── */
  function translateKeyed(root, en) {
    var els;
    try { els = root.querySelectorAll('[data-i18n]'); } catch (e) { return; }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      if (!key) continue;
      if (en) {
        if (el.__arvexaKeyed === undefined) el.__arvexaKeyed = el.textContent;
        var hit = DICT[norm(key)];
        if (hit !== undefined) el.textContent = hit;
      } else if (el.__arvexaKeyed !== undefined) {
        el.textContent = el.__arvexaKeyed;
        delete el.__arvexaKeyed;
      }
    }
  }

  /* ── Titre du document ── */
  var origTitle = document.title;

  function translateTitle(en) {
    if (en) {
      var hit = DICT[norm(document.title)];
      if (hit !== undefined) document.title = hit;
    } else if (origTitle) {
      document.title = origTitle;
    }
  }

  /* ── Application complète ── */
  var current = read();
  var applying = false;
  var lastTitle = document.title;

  function apply(lang) {
    applying = true;
    current = (lang === 'en') ? 'en' : 'fr';
    var en = current === 'en';
    try { document.documentElement.setAttribute('lang', current); } catch (e) { /* noop */ }
    if (document.body) {
      walkText(document.body, en);
      translateAttrs(document.body, en);
      translateKeyed(document.body, en);
    }
    translateTitle(en);
    lastTitle = document.title;
    applying = false;
  }

  /* ── MutationObserver : couvre le contenu rendu après coup ── */
  var pending = null;

  function processPending(batch) {
    if (current !== 'en') { pending = null; return; }
    for (var i = 0; i < batch.length; i++) {
      var m = batch[i];
      if (m.type === 'characterData' && m.target && m.target.nodeType === 3) {
        if (!skipNode(m.target)) translateTextNode(m.target, true);
      } else if (m.type === 'childList') {
        var added = m.addedNodes;
        for (var j = 0; j < added.length; j++) {
          var nd = added[j];
          if (nd.nodeType === 3) {
            if (!skipNode(nd)) translateTextNode(nd, true);
          } else if (nd.nodeType === 1) {
            if (skipNode(nd)) continue;
            walkText(nd, true);
            translateAttrs(nd, true);
            translateKeyed(nd, true);
          }
        }
      }
    }
    if (document.title !== lastTitle) {
      var h = DICT[norm(document.title)];
      if (h !== undefined) document.title = h;
      lastTitle = document.title;
    }
    pending = null;
  }

  var mo = null;
  if (typeof MutationObserver === 'function') {
    mo = new MutationObserver(function (muts) {
      if (current !== 'en' || applying) return;
      if (!pending) {
        pending = [];
        window.requestAnimationFrame(function () {
          var batch = pending;
          processPending(batch || []);
        });
      }
      for (var k = 0; k < muts.length; k++) pending.push(muts[k]);
    });
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    } catch (e) { mo = null; }
  }

  /* ── API publique ── */
  function read() {
    try {
      return localStorage.getItem(KEY) === 'en' ? 'en' : 'fr';
    } catch (e) {
      return DEFAULT_LANG;
    }
  }

  function set(lang, persist) {
    if (lang !== 'en' && lang !== 'fr') lang = 'fr';
    apply(lang);
    if (persist !== false) {
      try { localStorage.setItem(KEY, lang); } catch (e) { /* stockage indisponible */ }
    }
    try {
      window.dispatchEvent(new CustomEvent('arvexa-langchange', { detail: { lang: lang } }));
    } catch (e) { /* vieux navigateurs */ }
  }

  function get() { return current; }

  /* ── Dialogues natifs (confirm / alert) : traduits à la volée ── */
  try {
    var nativeConfirm = window.confirm;
    var nativeAlert = window.alert;
    if (typeof nativeConfirm === 'function') {
      window.confirm = function (msg) {
        return nativeConfirm.call(window, msg === undefined ? msg : t(String(msg)));
      };
    }
    if (typeof nativeAlert === 'function') {
      window.alert = function (msg) {
        return nativeAlert.call(window, msg === undefined ? msg : t(String(msg)));
      };
    }
  } catch (e) { /* environnement verrouillé */ }

  /* Synchronisation entre onglets */
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === KEY) apply(read());
  });

  /* Application immédiate (le script est defer : le DOM est déjà parsé) */
  apply(read());

  window.ARVEXA_LANG = { get: get, set: set, t: t };
})();
