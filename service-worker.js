// ================================================================
// SERVICE WORKER — ARVEXA School
// Version : OFFLINE v2.2 — Navigation instantanée
// ================================================================

// ARVEXA-FLUX-v1
let SW_VERSION = 'arvexa-offline-v8.6-flux1'; // ⚡ ARVEXA-FLUX-v1 : routeur navigation instantanée ajouté au précache; // ✅ v8.6 — MODALE UNIFORME : MODE CLAIR (signalement propriétaire sur capture « Accès Premium requis » : « le pop-up ne ressemble pas à celui des autres et n'a pas le mode clair ») : le composant arvexa-confirm.js (popup Premium du planificateur + toutes les confirmations injectées : matiere, chapitre, reviseur, abonnement, groupe, exam, arv, arv-progress, notifications) avait TOUTES ses couleurs codées en dur en sombre (#141414/#0A0A0A, textes #F5F0E8/#8A8A7A, bouton Annuler blanc translucide, croix blanche) → il ignorait html[data-theme="light"] et restait noir quand toute la page passait papier/encre, alors que les copies internes d'index/profil (référence officielle) suivaient déjà les tokens et devenaient claires. FIX : CSS du composant réécrit sur les TOKENS du site (dégradé var(--bg-surface)→var(--bg-dark), textes var(--text-light/--text-dim/--text-muted), Annuler + croix rgba(var(--rgb-soft)…), bouton principal gradient var(--accent-bright)→var(--accent) texte var(--on-gold)) avec les VALEURS SOMBRES EN REPLI → mode sombre strictement identique à avant (mêmes hexadécimaux que profil/index), mode clair automatique (papier/encre, or foncé) + ombre chaude dédiée ; répare donc TOUTES les modales injectées d'un coup · v8.5 — COFFRE DE L'APPAREIL (protection des progressions locales des élèves actuels) — la cause racine v8.4 (bug authMod) a révélé que la sync n'a JAMAIS tourné : les progressions de tous les élèves ne vivent qu'en LOCAL. La purge stricte v8.4 les aurait donc effacées à la première connexion. v8.5 : les données locales inattendues d'un compte entrant sont mises au « coffre » (arvexa_sync_legacy) puis PROPOSÉES via une confirmation unique « Progression trouvée — sont-elles les tiennes ? » (arvexaConfirm, onCancel ajouté au composant + copies locales index/profil) — Oui → adoptées et uploadées dans CE compte ; Non → compte à zéro, le coffre reste disponible pour un autre compte de l'appareil (3 refus = nettoyage) ; register.html archive au coffre AVANT sa purge ; marqueur par uid (une seule question par compte, jamais de mélange sans accord) ; l'isolation stricte v8.4 est INTACTE · v8.4 — ISOLATION DES COMPTES + PLANIFICATEUR PREMIUM + MODALES UNIFORMES + SPLASH 1ᴱʀ CHARGEMENT(signalements propriétaire : « j'ai créé un tout nouveau compte et je vois les progressions de mon autre compte sur le nouveau » ; « le planificateur n'est pas gratuite, le premium est requise pour l'utiliser — remets-le au niveau des premiums » ; « la modale n'est pas identique aux autres, ses couleurs sont pas identiques » ; « l'écran de recharge s'affiche à chaque page alors qu'il doit s'afficher uniquement au premier chargement » ; « fais fichier par fichier, ligne par ligne, une comparaison entre les pages et trouve une cohérence ») : (1) ISOLATION STRICTE arvexa-sync.js v1.1 — l'« adoption intelligente » v8.0 (qui transférait les données locales au compte entrant) est SUPPRIMÉE : un autre compte = données locales vidées (read/notes/meta/activité + snapshots accueil session ET persist), la progression ne revient QUE du document cloud du compte entrant ; gardes anti-course push()/syncDown() (l'uid est capturé au départ et l'écriture annulée si le compte actif a changé pendant l'aller-retour réseau — l'ancien garde « !state.uid » laissait passer un syncDown du compte A résolu après passage au compte B) ; register.html purge les clés de progression dès la création du compte ; matiere.html ne charge plus arvexa-sync.js EN DOUBLE ; (2) PLANIFICATEUR 100% PREMIUM — carte déplacée en section « Outils intelligents » avec badge Couronne (outils.html, elle était marquée « Gratuit »), verrou à l'ouverture : requireAuth + lecture users/{uid} (premium/isUnlocked/hasDeposited + subscriptionEndDate, même logique que arv.html) → non-premium = modale uniforme + bouton désactivé, 403 backend en seconde barrière ; (3) MODALES PREMIUM UNIFORMES — les 7 variantes locales (planificateur, reviseur, exam, arv, arv-progress, chapitre, matiere) remplacées par le composant unique arvexaConfirm (référence officielle index/profil/abonnement) : mêmes couleurs, mêmes boutons, mêmes animations partout ; reviseur-history : pop-up redondant retiré (écran de verrouillage pleine page seul, comme exam-history) ; (4) SPLASH INDEX — uniquement au premier chargement de la session (marqueur sessionStorage arvexa_splash_seen) : les retours de page ne le rejouent plus, il est retiré avant la première peinture (zéro flash) ; (5) AUDIT DE COHÉRENCE page par page (script scripts/audit_coherence.py) : 24 anomalies détectées et corrigées — déconnexion arv.html standardisée (arvexaLogout), ids DOM dupliqués (arv-progress pageTitleText, exam-history closeDetailBtn), manifest diagnostic.html manquant. TESTS : node --check OK ; Playwright réels (isolation comptes avec Firebase stub, splash, planificateur, modales) · v8.3 — SÉLECTEUR D'INDICATIF + INTERNATIONALISATION (consigne propriétaire : « là où on met le numéro de téléphone lors de l'inscription, on n'a pas ajouté le choix d'indicatif de pays — liste tous les pays d'Afrique, design cohérent avec le site, le sélecteur à gauche, pas de défaut : c'est le Niger — et comme on veut rendre le site international, remplace tout ce qui est lié à notre pays ») : whatsapp.html (étape téléphone de l'inscription) gagne un sélecteur d'indicatif À GAUCHE du champ — 54 pays d'Afrique (drapeau + indicatif + nom FR/EN, recherche insensible aux accents, mémoire localStorage 'arvexa-dial', défaut NIGER +227 🇳🇪), design 100 % tokens du site (input-bg, radius, or ARVEXA, thèmes sombre/clair) ; normalisation E.164 par indicatif choisi (+227 + local, 0 initial retiré, 6-12 chiffres locaux, ≤15 au total ; un « + » tapé devant = international complet accepté) ; le numéro sauvegardé gagne whatsappCountry (ISO) + whatsappDial ; au retour le pays est restauré puis le champ n'affiche que la partie locale ; INTERNATIONALISATION : auth-choice « Plateforme éducative · Niger » → « panafricaine » + « Terminale D au Niger » → « en Afrique francophone » (clés i18n EN mises à jour), formulaires note physique « (Niger ≈ 9,78) » → « (≈ 9,78 à l'équateur, ≈ 9,83 aux pôles) », commentaires arvexa-i18n.js/bac-date.js internationalisés ; le +227 du SUPPORT reste (numéro WhatsApp du propriétaire, centralisé dans arvexa-contact.js). SW bump arvexa-offline-v8.3 (whatsapp/auth-choice précachées) · v8.2 — ANTI-DÉBORDEMENT UNIVERSEL (consigne propriétaire : « mets en blocage contre les débordements qui ne reviennent pas à la ligne — règles partout sauf pour les modales ») : arvexa-ui.css gagne 3 verrous à spécificité zéro — (1) overflow-wrap anywhere (repli break-word) sur tous les porteurs de texte : les mots longs/URLs/titres reviennent à la ligne et le min-content des enfants flex/grid se comprime enfin ; (2) min-width:0 sur tous les éléments : fini les lignes flex/grid qui refusent de rétrécir et poussent la page en largeur ; (3) html{overflow-x:clip} (repli @supports : hidden) = zéro défilement horizontal au niveau du document sans casser position:sticky — EXCEPTION DEMANDÉE : tout l'arbre des modales/popups/overlays/backdrops/sheets ([class*="modal|popup|overlay|backdrop|dialog|lightbox|sheet"] + <dialog>) est rétabli à l'origine (min-width:auto, overflow-wrap:normal), mise en page des modales intouchée ; toasts/bannières non exemptés (messages longs repliés) ; PROTECTION MATHS : .katex jamais coupé (overflow-wrap normal) + .katex-display{overflow-x:auto;max-width:100%} = formule large défile localement au lieu de déborder · v8.1 — ANALYTICS RÉPARÉ (signal propriétaire : « l'analytic de la page administrateur ne marche pas, je n'ai ni la durée, ni le nombre de sections, ni le nombre de vues par élève, ni qui a utilisé aujourd'hui ») : CAUSE RACINE — analytics.js (tracker v3) n'était référencé par AUCUNE page (les données s'arrêtaient au 25/10) → <script src="analytics.js"> injecté dans les 31 pages (avant register-sw.js ou </body>) ; le tracker v3 remonte vues/durée/sessions/features dans users/{uid}/analytics_daily/{date} (l'email propriétaire reste exclu côté client ET serveur) · v8.0 — PROGRESSIONS SYNCHRONISÉES FIREBASE (demande propriétaire : « les progressions sont enregistrées en local… chaque compte doit avoir ses propres données, tout sauvegardé dans Firebase : progressions, chapitres, nombre de sections, et le calcul de la progression ») : arvexa-sync.js (nouveau, précaché) + progress-totals.json (structure officielle des cours : 57 chapitres / 683 sections, précaché) → chaque section lue, chaque note et l'activité quotidienne partent dans Firestore users/{uid}/progression/course (arrayUnion + champs par clé = sûr en multi-appareils) ; le calcul de progression (par section/chapitre/matière/global) y est SAUVEGARDÉ dans le champ stats ; FIX au passage : matiere.html n'affichait jamais « Terminé » ni le % du chapitre (totalParts toujours 0) ; les pages de cours restent en cache SW (demande explicite) · v7.8 — NOTIFICATIONS ÉPURÉES (retour propriétaire sur capture d'écran : « je ne veux pas que le logo de droite s'affiche, uniquement celui de l'application ») : PLUS de grande icône dans la bannière (firebase-messaging-sw.js v1.4.0, C6 — aucun champ `icon`) → la notification n'affiche que le logo de l'app (lanceur, à gauche) + titre + message ; le badge monochrome blanc notif-icon.png (atome, variante 4) reste l'icône de la barre d'état · v7.7 — BRANDING DES NOTIFICATIONS (choix « Notif 4 » : variante « A » & atome, thème école scientifique) : badge monochrome blanc notif-icon.png (l'ancien icon.png « PRÉPARATION BAC » s'affichait en carré blanc / « logo d'une autre app ») ; firebase-messaging-sw.js précaché · v7.5 — « Ajouter une section » repensé (demande du propriétaire) : plus de grande espace morte (modale 88vh, contenu aligné en haut, textarea qui grandit avec le texte), saisie toujours visible au-dessus du clavier (interactive-widget=resizes-content + snap proximity), blocage DUR 2 500 caractères partout (symboles, brouillon, dictée, soumission, compteur rouge) et correction au clavier PENDANT la dictée vocale (toucher le texte = pause dictée → clavier pour réparer les fautes → 🎤 reprendre, zéro mot perdu) · v7.1 — thème clair complet whatsapp.html (page noire en mode clair → palette standard + toast clair) · v7.0 — NOUVELLE ÉTAPE POST-INSCRIPTION : whatsapp.html (numéro WhatsApp + bouton « Rejoindre le groupe WhatsApp » + Valider → onboarding) ajoutée au flux register et au précache ; aperçu quiz auth-choice en VRAI rendu mathématique KaTeX (rendu exact demandé par le propriétaire) · v6.1 — renouvellement du précache (correctif aperçu quiz auth-choice : bonne réponse A + écriture mathématique en exposant) · v6.0 — mode arrière-plan : 2 fichiers en parallèle (navigation fluide pendant le téléchargement)
// ✅ v5.9 — TÉLÉCHARGEMENT EN ARRIÈRE-PLAN (consigne du propriétaire :
// « après inscription, un pop-up propose de télécharger toutes les données
// en arrière-plan — il peut naviguer tranquillement pendant que les données
// se téléchargent »). Le job vit déjà dans le SW (waitUntil) et SURVIT aux
// navigations : il manquait juste un moyen pour la page SUIVANTE de savoir
// où le téléchargement en est. DÉSORMAIS le SW expose l'état du job courant
// (DOWNLOAD_STATUS) : la pastille ARVEXA se rattache sur n'importe quelle
// page, la barre de progression continue, et l'état « prêt hors ligne » est
// posé même si la page qui avait lancé le téléchargement a été fermée.
// v5.8 — PASSERELLE PDF : les 4 minutes d'attente signalées venaient de
// 3 défauts en chaîne. (1) Quand le PDF était DÉJÀ en cache, le SW répondait
// « 200 complet » aux requêtes Range (bytes=X-Y) de pdf.js — qui EXIGE un
// 206 pour un morceau : pdf.js repartait en échec/relances → un PDF déjà vu
// devenait plus lent qu'un premier chargement. (2) À la PREMIÈRE lecture,
// pdf.js avorte son GET initial dès qu'il voit « Accept-Ranges » : le
// response.clone() remis à cache.put() était cassé → le PDF n'était JAMAIS
// mis en cache → tout était retéléchargé à chaque ouverture. (3) À chaque
// entrée dans un chapitre, lecture.html pré-téléchargeait les AUTRES PDF en
// parallèle → le PDF demandé était affamé de bande passante sur réseau lent.
// DÉSORMAIS : un seul téléchargement complet par PDF (dédupliqué, détenu par
// waitUntil, garanti mis en cache), requêtes Range tranchées en 206 depuis
// le cache (réouverture instantanée, marche hors ligne), et zéro double
// téléchargement (CACHE_URL et DOWNLOAD_ALL partagent le même vol).
// v5.7 : STABILITÉ TOTALE + AFFICHAGE INSTANTANÉ — (1) caches NON versionnés (arvexa-static / arvexa-html / arvexa-data) : une mise à jour du site ne détruit PLUS JAMAIS les PDF et cours téléchargés (avant : chaque nouvelle version vidait tous les caches → « il faut que je les retélécharge ») ; migration automatique des anciens caches versionnés, sans réseau ; (2) AFFICHAGE INSTANTANÉ : tout fichier déjà en cache (PDF, cours, JSON) est servi immédiatement même EN LIGNE, le réseau ne fait que rafraîchir en arrière-plan — plus jamais d'attente ni de retéléchargement à l'entrée d'un cours déjà téléchargé ; (3) téléchargement offline : fichiers déjà en cache sautés (2e passage = quelques secondes), 3 fichiers en parallèle, timeout 30 s par fichier, ANNULATION possible (« Annuler » dans le pop-up coupe tout proprement). // v5.6 : ÉCRAN DE CHARGEMENT RÉTABLI + BARRIÈRE D'INSTALLATION PWA — (1) le splash ARVEXA se remontre à CHAQUE ouverture (y compris hors ligne) mais ne bloque jamais l'entrée : restauration instantanée derrière lui + dissipation après sa durée minimale (1200 ms), plus jamais supprimé avant peinture ; (2) install-banner.js : bannière « Installe ARVEXA sur ton écran d'accueil » sur toutes les pages tant que l'app est vue dans Chrome, prompt natif beforeinstallprompt (Android) ou modal guidé (iOS), disparition définitive uniquement en mode standalone. // v5.5 : ZOOM PDF 100 % STABLE (lecture.html) — double-buffer canvas : l'ancien bitmap RESTE AFFICHÉ (étiré en CSS) pendant le re-rendu zoom/pinch/rotation, bascule instantanée par drawImage → plus aucune « coupure » ni page blanche de 1 à 3 s au zoom ; anti-rebond des taps rapides zoom +/− (un seul re-rendu), file de rendu ramenée à 2 canvases simultanés, plafond mémoire 10 Mpx, pages hors écran libérées pendant le zoom. // v5.4 : L'ENTRÉE OFFLINE DÉBLOQUÉE + 2G FLUIDE — (1) CAUSE RACINE du « chargement infini hors ligne » : les modules Firebase SDK importés par 21 pages (gstatic.com/firebasejs/) et les polices (fonts.googleapis/gstatic, cdnjs) étaient TOTALEMENT exclus du SW (NEVER_CACHE_HOSTS) → hors ligne l'import du module échoue, TOUTE la logique de la page meurt (onAuthStateChanged, showDashboard, hideSplash n'existent pas) → splash ARVEXA infini ; v5.4 met en cache ces ressources STATIQUES immuables (URL versionnée) via CACHEABLE_CDN — les API/données (firestore.googleapis, identitytoolkit, securetoken, firebaseio, firebasestorage) restent STRICTEMENT hors SW ; (2) 2G FLUIDE : isSlowConnection() (Network Information API : effectiveType 2g/slow-2g ou saveData) → handleHTML passe en CACHE-FIRST + refresh arrière-plan (stale-while-revalidate) au lieu d'attendre 2,5 s le réseau avant le repli cache à chaque navigation ; (3) DOWNLOAD_ALL : aucun changement (les PDF sont ajoutés côté offline.js). // v5.3 : OUVERTURE PDF < 5 s + FINI LES PAGES BLANCHES (« crash d'images » au scroll) — (1) pdf.min.js PRÉCHARGÉ pendant la sonde HEAD (avant : en série, 0,3 à 1 s perdus à chaque ouverture froide) ; (2) métrage des pages non plus séquentiel (44 aller-retours getPage avant le 1er affichage !) : page 1 mesurée seule, placeholders posés, PAGE 1 RENDUE IMMÉDIATEMENT, formats des autres pages mesurés en fond (8 en parallèle) ; (3) FILE DE RENDU (3 canvas max simultanés, priorité page courante) : les rafales de scroll n'explosent plus la mémoire canvas ; (4) annulation des rendus obsolètes (renderTask.cancel) + garde-fou « canvas vidé → pas marqué rendu » + re-rendu de TOUTES les pages visibles après recadrage (rotation/scrollbar/zoom/pinch) — fini les pages blanches ; (5) handleGeneric ne met en cache QUE les réponses 200 : les 206 partiels (range requests de pdf.js sur Vercel, accept-ranges: bytes) ne doivent jamais écraser l'entrée GET complète (PDF corrompu au hors-ligne) ; (6) SKELETON de chargement : 3 feuilles A4 scintillantes + libellé « Chargement du cours… » (consigne propriétaire : « le pano chargement du PDF tu dois l'améliorer avec skeleton et au lieu de chargement du PDF tu mets chargement du cours »), spinner « Chargement du PDF » supprimé partout (panneau initial, progression %, bouton Réessayer) ; (7) disableAutoFetch : sur réseau lent pdf.js ne récupère que les Range requests utiles aux pages affichées (1ʳᵉ page ~2 s au lieu de ~10 s à 200 Ko/s) ; (8) CACHE_URL avec délai (6 s) : le téléchargement complet du PDF pour le hors-ligne démarre après la 1ʳᵉ page — plus de concurrence de bande passante. // v5.2 : PDF v5.2 — (1) ZÉRO COUPURE : tout bloc de contenu (paragraphe, formule posée, équation, étape, énoncé d'exercice, figure, item) est insécable — s'il ne reste pas de place en bas de feuille, le bloc ENTIER passe sur la page suivante (consigne « ne fais jamais de coupure, remets le contenu coupé sur une autre feuille »). (2) SCHÉMAS CORRIGÉS : trou « −1 » recalé exactement à mi-chemin entre −2 et 0 avec graduations alignées sur les points, étiquette « b = 3 (partie imaginaire) » sortie de la zone de la graduation 3, « vecteur OM » détaché de la flèche, points z₃ = 3 + 2i et z₁ = 5 à la même échelle (44 px/unité), flèche de transition prolongée jusqu'au second panneau. (3) LECTEUR PDF NET : rendu au minimum 2× la densité d'écran (plancher dpr), garde-fou mémoire canvas (≤ 12 Mpx / 4096 px par côté — les navigateurs mobiles brident sinon le canvas en silence → flou au zoom), re-rendu automatique au pinch-zoom (visualViewport.scale). (4) AFFICHAGE 100 % PDF : bouton « version HTML » (globe) retiré de la barre d'outils et du panneau d'erreur (consigne « on se base uniquement sur l'affichage du PDF actuel, tu enlèves le bouton du globe ») — repli HTML automatique conservé uniquement si le PDF n'existe pas encore. // v5.1 : LECTEUR PDF ARVEXA PERSONNALISÉ (consigne propriétaire : « au lieu de dépendre du lecteur PDF du système, tu peux m'écrire un personnalisé d'ARVEXA ») — (1) lecture.html : l'iframe système est remplacée par une VISIONNEUSE MAISON (pdf.js 3.11 embarqué localement dans assets/pdfjs/, canvas) : feuilles A4 rendues en canvas empilées dans le flux (la barre de progression de l'app suit le scroll normalement), rendu paresseux IntersectionObserver ±1,5 écran, nettoyage mémoire des pages lointaines (mobiles modestes), zoom 60–300 % avec boutons +/−, indicateur « page x / y », navigation précédent/suivant, téléchargement, bouton « version HTML » (TTS + notes) et écran d'erreur avec Réessayer — fonctionne identiquement sur desktop et mobile (plus aucune carte « Ouvrir le PDF » ni iframe, fiables nulle part) ; anti-course par jeton séquentiel (changement rapide de partie/tab). (2) PDF : PLUS AUCUN QCM ni bouton « Voir la réponse » dans le PDF — uniquement le cours + exercices d'application suivis immédiatement de leur CORRECTION détaillée visible (étiquette or, bloc teinté, sans bordure — consigne « simple, éducatif, comme un exposé sur papier ») ; transform appliqué au gabarit d'impression, jamais aux fragments d'origine. (3) SW : assets/pdfjs/pdf.min.js + pdf.worker.min.js précachés (visionneuse 100 % hors-ligne), les PDF restent cachés à la consultation (CACHE_URL). // v5.0 : LECTURE EN PDF — chaque partie ouvre le PDF local cours/<matiere>/<chapitre>/<fichier>.pdf quand il existe (sonde HEAD légère, sonde hors-ligne relue depuis le cache grâce à match() qui ignore la méthode) ; repli automatique sur le rendu HTML si le PDF est absent (zéro régression) ; TTS masqué en mode PDF, restauré au retour HTML ; le PDF consulté est mis en cache silencieusement via postMessage CACHE_URL (lecture hors-ligne) ; handleGeneric ne met en cache que les GET — une réponse HEAD (sonde de disponibilité des PDF) ne doit jamais écraser l'entrée GET d'une même URL. Les PDF restent hors précache (lourds) : cache à la consultation. // v5.0 : LECTURE EN PDF (consigne propriétaire : « un PDF par partie, ouverture locale depuis la page lecture ») — (1) lecture.html : chaque partie ouvre le PDF local cours/<matiere>/<chapitre>/<fichier>.pdf quand il existe (sonde HEAD légère, sonde hors-ligne relue depuis le cache grâce à match() qui ignore la méthode) ; lecteur intégré iframe #view=FitH sur desktop, et sur mobile/écran tactile une carte « Ouvrir le PDF » (les iframes PDF sont peu fiables sur Android) — repli automatique sur le rendu HTML si le PDF est absent (zéro régression) ; TTS masqué en mode PDF, restauré au retour HTML ; le PDF consulté est mis en cache silencieusement via postMessage CACHE_URL (lecture hors-ligne). (2) SW : handleGeneric ne met en cache que les GET — une réponse HEAD (sonde de disponibilité des PDF) ne doit jamais écraser l'entrée GET d'une même URL. Les PDF restent hors précache (lourds) : cache à la consultation. // v4.31 : HORS-LIGNE FIABLE (2 trous révélés par le test réel v4.30) — (1) cache.match des pages/cours passe en ignoreSearch : une navigation hors-ligne avec paramètres d'URL (« lecture.html?subject=…&chapter=… ») retrouve désormais le cache — avant, le match incluait la query string et l'élève tombait sur offline.html alors que la page était en cache ; (2) le préchauffage des parties du chapitre attend que le Service Worker CONTRÔLE la page (controllerchange / ready) : avant, déclenché à 1,2 s, il courait avant clients.claim() sur un premier chargement et ses fetch contournaient le SW → rien n'était mis en cache, la partie suivante restait inaccessible hors-ligne ; vérifié en test réel : p4 d'un chapitre navigué en ligne se charge désormais depuis le cache hors connexion. // v4.30 : FIABILITÉ LECTURE (demande propriétaire après tests) — (1) formules posées : une formule de calcul noyée dans une phrase passe sur SA propre ligne côté client (promoteMathLines + .math-line nowrap/scroll), fini les formules coupées en deux par le retour à la ligne mobile ; contenu des 124 fichiers de cours INTACT ; (2) titres d'étape réparés : strong redevient inline, plus de « : » orphelin en début de ligne (830 occurrences corrigées à l'affichage) ; (3) hors-ligne honnête : distinction réseau absent (504/offline → panneau « Pas de connexion » + Réessayer, navigation conservée) et vrai 404 (« bientôt disponible ») ; (4) préchauffage : après l'ouverture d'une partie, les AUTRES parties du chapitre sont mises en cache silencieusement → chapitre entier consultable hors-ligne, navigation instantanée ; (5) les écrans d'erreur remontent la navigation (prev/next/compteur/notes) qui restait masquée pour toujours ; (6) boucle de retry KaTeX plafonnée (30 essais) si le CDN est bloqué ; (7) tutoriel : « Passer le tutoriel » ferme SANS confirmation (le × garde la sienne), 2 sélecteurs invalides réparés (.tools-grid aref→a[href), popup premium sautée après un Passer, tour non lancé sur lecture/exam/exam-history pour ne pas interrompre une lecture ; serveur inchangé. // v4.29 : REFONTE AFFICHAGE DES COURS MATHS (44 fichiers réécrits à la demande du propriétaire) — les formules ne sont plus noyées dans les phrases : toute formule du programme vit dans un bloc dédié sur sa propre ligne (formula-hero pour les majeures, formula-box pour les propriétés, examples + steps pour les calculs), chaque calcul se pose étape par étape (une transformation par ligne), divisions systématiquement parenthésées (1 − q^(n+1))/(1 − q), multiplications marquées ×, tableaux dans chaque partie (propriétés, valeurs remarquables, variations, comparaisons) et GRANDE TABLE DE SYNTHÈSE objet/formule/astuce dans chaque fiche p4 comme la fiche Nombres complexes, figures SVG thémées (courbes avec asymptotes, Venn, arbres pondérés, nuages de points + droite d'ajustement, familles de solutions) — densité contrôlée automatiquement (≥ 2 hero, ≥ 2 box, ≥ 1 table, ≥ 16 étapes en p1-p3 / 12 en p4, ≥ 2 SVG par chapitre) : standard calibré sur nombres_complexes qui passe 0 violation. Contenu du programme inchangé, calculs re-vérifiés (dont vérification symbolique sympy sur équations différentielles) ; exercice type Bac équations différentielles corrigé (P' = −0,05·P + 20 → P(t) = 400 + 600e^(−0,05t), lim 400). Cache-manifest régénéré (126 fichiers). v4.28 : COURS MATHS COMPLETS — les 11 chapitres du programme de Mathématiques Terminale D sont intégrés (44 fichiers de cours : 4 parties par chapitre, ~22 300 lignes) : nombres complexes (forme algébrique, conjugué/module/argument, formes trigono-exponentielles, fiche Moivre/Euler/équations/géométrie), similitudes planes directes, calcul de probabilités (conditionnement, totales, Bayes, indépendance), variable aléatoire (espérance/variance, binomiale, normale), fonctions numériques (limites/continuité/bijection/dérivées), logarithme népérien, fonction exponentielle, calcul intégral (primitives, intégrales, IPP, aires), équations différentielles (y'=ay, ay+b, ay+f(x), radioactivité), suites numériques (arithmétique/géométrique/arithmético-géométrique, convergence, récurrence), statistiques (indicateurs, ajustement linéaire, corrélation). Même format que SVT : hero/sommaire/notions/QCM dépliables/fiches, symbolisme 100 % Unicode en span.math (zéro KaTeX cassé, zéro antislash), classes lecture-* thémées clair+sombre, calculs purs vérifiés + contexte nigérien ; ancien pilote nombres_complexes/p1.html réécrit au format standardisé. Cache-manifest régénéré (126 fichiers) pour la lecture hors-ligne de tout le cours de Maths. v4.27 : COURS SVT COMPLETS — les 20 chapitres du programme de SVT Terminale D sont intégrés (80 fichiers de cours : 4 parties par chapitre) : notion de l'IG, ADN, reproduction conforme (réplication/mitose), cycle cellulaire, protéines, synthèse des protéines, reproduction sexuée (méiose), brassage des gènes, transmission des caractères (hérédité humaine), anomalies chromosomiques, tissus nerveux/réflexes, messages nerveux, glycémie, appareils génitaux, régulation hormonale, fécondation/nidation, régulation des naissances, soi/non-soi, réponses immunitaires, VIH/SIDA. Format identique au pilote maths (hero, sommaire, notions, callouts, QCM dépliables, fiche de révision), symbolisme 100 % Unicode en span.math (zéro KaTeX cassé), styles uniquement via les classes lecture-* déjà thémées (mode clair ET sombre lisibles), ~38 000 lignes pédagogiques avec contexte nigérien ; cache-manifest.json régénéré (83 fichiers) pour la lecture hors-ligne de tout le cours de SVT. // v4.26 : KATEX FLÈCHES + FORMULAIRES × NOUVELLE BASE + MODE CLAIR LISIBLE — (1) FIX « ADN\to ARN » : les pipelines serveur exam/reviseur/progress convertissaient les flèches Unicode (→) en \to PARTOUT, y compris HORS des $…$, et le wrapping orphelin sautait dès qu'un $ existait ailleurs dans la chaîne → le \to restait affiché en texte brut dans les phrases. Pipelines désormais segment-aware : les maths $…$ reçoivent Unicode→LaTeX (plus d'erreurs KaTeX sur $x → 3$), la prose garde les flèches Unicode lisibles (→, ⇒, ⇔), les \to/->/=> orphelins hors maths sont convertis en Unicode, le wrapping orphelin passe en inline $…$ (les \begin{} restent display) et ne saute plus à cause d'un $ ailleurs. (2) katex-utils.js v5.1 : filet de sécurité client — replaceUnicodeMath inversé (Unicode→LaTeX DANS les maths) + fixOrphanArrows (flèches LaTeX/ASCII orphelines → Unicode) branché dans renderMath (répare AUSSI le contenu déjà stocké en Firestore) et cleanLatexText. (3) FORMULAIRES régénérés sur la NOUVELLE base de chapitres (57 chapitres : maths 11, physique 17, chimie 9, svt 20) : 218 formules (avant 162) — 122 anciennes remappées vers leurs chapitres, 40 hors-programme retirées (coniques, produit vectoriel, géométrie espace, optique lentilles, cinétique/redox/piles chimie, géologie) et 96 nouvelles rédigées (SVT 10→54 : notion IG, structure ADN, réplication, cycle cellulaire, protéines, transcription/traduction ADN→ARNm→protéine, méiose, brassage, Hardy-Weinberg, anomalies, réflexes, potentiel d'action, glycémie, gamétogenèses, axe hypothalamo-hypophysaire, nidation, contraception, CMH, groupes ABO, réponses humorale/cellulaire, VIH) ; favoris pointant vers des formules retirées auto-purgés (pruneFavorites) ; test rendu réel 218/218 sans erreur KaTeX (katex.min.js). (4) MODE CLAIR LISIBLE : ~190 corrections de contraste sur 31 fichiers — 3 modales/fonds sombres en dur passés aux variables (exam-history, reviseur-history, auth-choice .preview), popup premium dupliqué sur 6 pages var-based, tableau périodique lisible en clair (10 catégories assombries), mathmind (textes crème → tokens), blocs rgba(0,0,0,.15-.4) → var(--block-bg), pastels illisibles → tokens (success-light/danger-light/accent-purple/warning-bright), boutons or : var(--on-gold), nouveaux tokens --block-bg/--on-gold/--accent-purple/--shimmer, perf.css html background var-based. Tests : 28/28 pipelines flèches (exam/reviseur/progress/katex-utils réels extraits) + 218/218 formules KaTeX + node --check toutes pages modifiées. // v4.25 : ONBOARDING PROPRE — auth-choice.html (porte d'entrée des nouveaux) : boutons pré-réglage mode clair/sombre (🌙/☀️, ARVEXA_THEME) et langue FR/EN (ARVEXA_LANG) dans le header desktop + encart « Avant de commencer, réglez vos préférences » visible sur mobile, mêmes mécanismes que profil.html (localStorage + sync multi-onglets), +5 clés i18n EN ; l'utilisateur arrive dans l'app avec ses préférences déjà appliquées. // v4.24 : BANDEAU NOTIFS UNIVERSEL 12H — le bandeau d'activation est visible aussi par ceux qui ont REFUSÉ (icône 🔕, titre « Notifications désactivées », instructions « Réglages → Applications → Chrome ou ARVEXA → Notifications », bouton Réessayer) ; relance automatique au retour sur l'app (visibilitychange) et toutes les 12h pendant une session (installFcmRecurring) ; « Plus tard » conserve la pause 12h ; objectif : faire monter le taux 9/36 élèves notifiables. // v4.23 : ANTI-DOUBLON FINAL — tag unique par envoi (webpush.notification.tag : les doublons multi-comptes/multi-origines s'écrasent silencieusement) + firebase-messaging-sw.js v1.2 skipWaiting (le SW à jour s'active immédiatement chez l'utilisateur) // v4.22 : ANTI-DOUBLON notifications — le payload notification natif est affiché par le SDK FCM une seule fois, le SW n'affiche plus que les messages data-only (firebase-messaging-sw.js C4) // v4.21 : NOTIFICATIONS FIABLES — banner FCM re-proposé toutes les 12h (au lieu de 3j) pour que chaque élève active les notifications // v4.20 : MENUS IDENTIQUES À L'INDEX (le user : « ajoute les éléments manquants dans les menus des autres pages, les menus doivent être identiques à celles de l'index »). (1) profil.html, abonnement.html, notifications.html : sidebar passée de 4 à 8 items — ajout Arv-progress (fa-graduation-cap), Outils (fa-toolbox) et « Donner mon avis » (fa-star, style doré avis-link + CSS) dans le MÊME ORDRE que index : Accueil, Mon profil, Mon abonnement, Notifications, Arv-progress, Outils, Donner mon avis, Déconnexion ; item actif conservé par page ; handlers logout intacts. (2) « Donner mon avis » hors index pointe vers index.html?avis=1 et index auto-ouvre la modale Avis existante (étoiles/catégorie/message → Firestore + Telegram) quand ?avis=1 — une seule source de vérité pour le formulaire, zéro duplication ; l'URL est nettoyée via history.replaceState après ouverture. (3) mathmind.html (jeu) : section « ARVEXA School » ajoutée dans la sidebar sous le Grand Mix — les 7 liens standard (dont Donner mon avis) + 5 symboles SVG tracés (i-user, i-crown, i-bell, i-tool, i-grad) dans le style du jeu ; la nav du jeu (Tableau de bord/Chapitres/Bibliothèque/Progression/Grand Mix) est intacte, les nouveaux liens ne portent pas data-nav (non interceptés par le routeur) ; Déconnexion absente (page sans auth, progression locale). (4) arv.html (chat) : section Navigation entre l'historique des conversations et le pied de sidebar — les 7 liens + Déconnexion (signOut déjà importé → auth-choice.html, même destination que le reste de l'app) ; CSS .sidebar-nav-x compacte ; l'historique des conversations (flex:1) absorbe la hauteur. Pages de détail (chapitre, exam, matiere...) : inchangées par conception (bouton retour, pas de menu). Tests : 173/173 test_menus_v420.js (8 items/ordre/icônes/CSS par page, handler ?avis=1, symboles mathmind, nav jeu intacte, chat intact, ids uniques, nav équilibrées) + 53/53 v4.18 ; les autres suites (exam/API) ne touchent aucune page modifiée. // v4.19 : EXAM — 100% DES CALCULS, ZÉRO HISTOIRE (le user : « tu donnes des problèmes, c'est juste des calculs pas autre, comme avant ») : malgré v4.17, 6 fuites narratives subsistaient. (1) L'offre « Situation réelle FACULTATIVE (1 exercice max) » était systématiquement prise par l'IA à température 1.0 → SUPPRIMÉE : sciences = 3 exercices sur 3 en CALCULS PURS, l'énoncé DONNE l'expression/l'équation/le bloc « Données : », STRICTEMENT INTERDIT de raconter une histoire (marché, trajet, forage, tontine cités comme interdits) + anti-exemple explicite (« ET PAS : Aïcha achète au marché... »). (2) Exemples few-shot Pascal Lainé injectés dans chaque prompt sciences (maths : z = (3+6i)/(-3-4i) → forme algébrique puis module/argument ; physique : x_M(t) = 40 - 4t et x_C(t) = 10 + t² → instant de rencontre). (3) PHYSICS_RULES : « situation technique COURTE (ex: un motard rattrape un camion) » remplacée par DONNÉES TECHNIQUES DIRECTES (équations horaires, valeurs v0/a/U/R/m, 1 phrase de cadrage neutre max). (4) DIFFICULTY_RULES bac : exemple physique réécrit en forme données→calcul (x_M(t) = -30t + 0,3t² / x_C(t) = 20t + 40), typo « Pascal Laine » corrigée. (5) PEDAGOGY_RULES : « Réalistes » (poussait au récit) remplacé par « Fidèles au programme ». (6) LE POOL examPool RECONTAMINAIT les générations : les exercices narratifs archivés AVANT v4.19 ressortaient via le rattrapage near-miss ET la reconstruction totale — désormais chaque exercice archivé porte genStyle ('calc' sciences / 'recit' littéraires) et les matières scientifiques ne puisent QUE dans genStyle='calc' (vieux exercices narratifs ignorés ; pool vide → fournisseur suivant ou écran indisponible) ; littéraires : pool et contexte imposé inchangés. La variété v4.16 reste complète (température 1.0, graine TIRAGE N°, tirage de techniques par matière, anti-récyclage avoidStatements). Tests : 70/70 v4.19 (nouveau harnais pool avec stubs Firestore : archivage taggé, rattrapage filtré, reconstruction filtrée, littéraires intacts) + non-régression 49/49 v4.17 + 37/37 v4.16 + 39/39 v4.15 + 21/21 + 25/25 client = 231 vérifications ; node --check exam.js. // v4.18 : v4.18 : Page abonnement complétée — la carte premium n'exposait que 4 avantages ; désormais les 8 avantages RÉELS du système, vérifiés dans le code, en grille compacte : tous les chapitres débloqués (toutes les matières), exercices corrigés, Mode Examen illimité (2/jour en gratuit), ARV Assistant 60 questions/jour (contre 10 en gratuit), Réviseur illimité (fiches, flashcards, quiz — 3/jour en gratuit), Planificateur IA exclusif (programme de révision sur mesure), Cahier ARV-PROGRESS sans limite (cours par photo ou voix, lacunes détectées), historiques d'épreuves et fiches conservés + suivi de progression. Écran « Premium actif » synchronisé (8 items au lieu de 5, « ARV-ASSISTANT illimité » faux retiré) ; libellé erroné « Pose 3 questions/jour à l'IA » corrigé. Aucun changement backend ni de tarifs (2 000 / 18 000 XOF). Tests : 53/53 abonnement v4.18 (grille 8 items, pb-list 8 items, quotas cohérents avec le code, non-régression complète). // v4.17 : DES CALCULS, PAS DES HISTOIRES (référence fiches "Pascal Lainé", capture NOMBRES COMPLEXES envoyée par l'élève) — depuis la v4.16, l'IA IMPOSAIT un contexte nigérien par sujet (marché de Niamey, forage, tontine…) : les maths livraient des PROBLÈMES concrets au lieu de CALCULS purs. Correctif : pour les matières scientifiques (maths, physique, chimie, SVT) le prompt impose désormais le STYLE « des calculs, pas des histoires » — l'exercice DONNE une expression/équation/données techniques et l'élève calcule ; au minimum 2 exercices sur 3 PAR SUJET sont des calculs purs, la situation réelle devient FACULTATIVE (au maximum 1 par sujet) ; la VARIÉTÉ à chaque relance vient désormais du TYPE DE CALCUL tiré au hasard (VARIATION_CALC_DRILLS : mettre sous forme algébrique (3+6i)/(-3-4i), module/argument d'un produit 3i(2+i)(4+2i)(1+i), puissances élevées ((1+i√3)/2)^{2010}, équations, limites/dérivées, suites, probabilités, vecteurs — 6-8 techniques par matière) + un angle de calcul (VARIATION_CALC_ANGLES : « montrer que… », vérification croisée, résultat de a qui sert à b…), la température créative 1.0 et l'anti-récyclage v4.16 restent actifs. Difficulté calibrée en EXEMPLES DE CALCULS du niveau exigé (facile : (3+6i)/(-3-4i) → BAC : z^4+(3-6i)z^2-8-6i=0) — « en fonction de la difficulté ça change, ça va varier ». Physique : situation technique COURTE (1-2 phrases) puis calcul immédiat. Matières littéraires (philosophie/histoire/géo) : contexte imposé conservé, inchangé. Aucun changement d'interface (100% serveur). Tests : 49/49 v4.17 + non-régression 37/37 + 39/39 + 21/21 + 25/25 (171 vérifications, fonctions réelles en vm). // v4.16 : à chaque relance, des exercices TOTALEMENT différents (fini les sujets qui se ressemblent d'une génération à l'autre) — 3 causes corrigées en même temps. (1) Température IA de GÉNÉRATION passée de 0,3 à 1,0 : à 0,3 les réponses étaient quasi déterministes, le même prompt ressortait avec les mêmes trames d'exercices ; la CORRECTION garde 0,3 pour une notation stable. (2) Tirage aléatoire injecté dans CHAQUE prompt de génération : graine unique (TIRAGE N°), contexte nigérien imposé par matière (marché de Niamey, forage villageois, tontine, élevage, motard sur la route de Filingué, dosage de vinaigre… 15 contextes communs + 5-6 par matière sur les 7 matières), approche pédagogique imposée (estimer avant de calculer, donnée superflue à écarter, comparaison de deux situations, question de synthèse… 8) et contrainte imposée (valeurs NON RONDES, décimales + fraction, notation scientifique — ou contrainte rédactionnelle pour philosophie/histoire/géo). (3) Anti-récyclage personnel : l'application mémorise en local (localStorage, 3 dernières épreuves) les énoncés déjà générés et les envoie au serveur à chaque relance (avoidStatements) — le serveur les assainit (18 max, 140 car) et les interdit à l'IA : reprendre un énoncé tel quel ou en changer seulement les nombres = refusé. Bonus : le rattrapage pool (v4.15) tire désormais l'exercice de secours AU HASARD parmi les candidats du même niveau (avant : toujours le premier de la liste → répétitions mécaniques). Aucun changement d'interface. Tests : 37/37 serveur + 21/21 client (fonctions réelles extraites en vm : températures 1,0 génération / 0,3 correction, graines toutes différentes sur 50 appels, assainissement avoid complet, tirages pool variés, mémo 3 générations filtré par matière, câblage generateExam complet) + non-régression v4.15 39/39 + 25/25 + balayage 390×844 (3 vues × 0 débordement). v4.15 : l'exam reçoit la technique du cahier (v4.13) — FINI les erreurs pour rien : le serveur renvoie retryAfter sur 429 et le client (examFetch) affiche un COMPTE À REBOURS automatique « Beaucoup d'élèves — nouvel essai dans Xs… » puis RETENTE TOUT SEUL (une re-tentative ; panne réseau → re-tentative discrète à 2,5 s ; quota FREE → popup premium inchangée). Serveur : génération/correction lourdes 3→5/min (une classe entière derrière une IP partagée CGNAT n'est plus bridée à 3 essais ; le quota Groq reste protégé), buckets léger/lourd inchangés. L'IA est FORCÉE de livrer les résultats complets : contrat de complétion dans les 3 prompts (30/30 questions, énoncés NON VIDES, vérification finale avant réponse, jamais partiel), gradation obligatoire Sujet 1→Sujet 2 (le sujet 2 doit être visiblement plus difficile), validation stricte — une question sans énoncé est rejetée (avant : affichée VIDE à l'élève !) — et rattrapage « presque complet » : si l'IA livre ≤3 questions vides, l'exercice fautif est remplacé par un exercice équivalent du pool d'exercices puis revalidé strictement (marqueur +pool), sinon fournisseur suivant. Anti-débordement renforcé sur exam.html (technique cahier v4.10) : .question-title span, .statement, .answer-option span, .subject-card, .grade-*, et l'en-tête d'exercice .exercise-head (flex-wrap + titre à retour à la ligne forcé — le badge « 6.67 points · 5 questions » ne sort plus de l'écran sur les titres à mots interminables). Tests : 39/39 serveur (vm — buckets 5/min isolés, validation stricte, near-miss, patch pool, prompts complets, retryAfter) + 25/25 client (examFetch réel extrait : compte à rebours, 2×429→RATE_LIMIT, FREE limit sans re-tentative, réseau instable, plafond 65 s) + balayage 390×844 pire-cas (mots longs, U+00A0, KaTeX, options interminables, dessin, feedbacks) : 3 vues × 0 débordement après fix exercise-head. v4.14 : QCM du cahier retiré (affichage ET génération) — c'était la zone qui débordait sur mobile ; chaque section livre désormais l'explication du prof + la banque de questions Q/R, sans le bloc QCM interactif. La tâche IA 'qcm' est supprimée des 6 générateurs de prompts (gain ~13 s et du quota Groq par section, 4 tâches au lieu de 5) ; les anciennes sections gardent leur QCM en base (invisible) ; badge « N QCM » de la liste de sections et étape « QCM » de l'écran de génération retirés. renderQcm/CSS conservés dans le fichier (inertes) pour une réactivation éventuelle. Tests : 6/6 rendu (aucun QCM affiché même avec 12 QCM en entrée, explication + questions + structure intactes) + 3/3 serveur (aucune tâche qcm sur les 6 profils). v4.13 : fin des faux « trop de demandes » — les compteurs de débit (rate-limit) étaient PARTAGÉS entre toutes les actions d'un même IP : une navigation normale (dashboard, heartbeat d'étude, lectures) remplissait le compteur global et la 1re suppression de section (sans IA) héritait d'un « trop de tentatives » injustifié. Fix : un bucket indépendant par (IP, action) sur /api/progress, buckets séparés léger/lourd sur /api/exam et /api/reviseur, limites relevées pour les actions sans IA (tuteur 15→25/min, historique 30→40/min, planificateur 12→15/min), balayage mémoire anti-fuite. Côté client : retente silencieuse (1,5 s) sur 429 pour les 9 actions légères du cahier — l'élève ne voit plus de message pour une suppression ou une lecture ; messages 429 unifiés et calmes (« Service momentanément saturé… » / « Beaucoup d'élèves en ce moment… »), fini « Trop de tentatives » agressif. Tests : 12/12 unitaires serveur (trafic mixte 110 requêtes puis 10 suppressions → aucune bloquée) + 5/5 client (retry silencieux, quota FREE préservé) + balayage overflow 390×844 (repro QCM 0 débordement, 7 pages propres). v4.12 : notification SW_ACTIVATED post-claim (détection de mise à jour sans course) + propagation fiable — propagation fiable des mises à jour — les pages HTML passent en NETWORK-FIRST (réseau d'abord avec garde-fou 2,5 s → repli cache ; appareil hors ligne déclaré → cache instantané ; le fetch de fond continue de rafraîchir le cache même après un repli) pour que chaque correction déployée arrive sur les téléphones dès la 1re ouverture, même après des jours de PWA ouverte ; precache avec timeout 8 s par URL (fini les installations qui pendent en réseau instable et retardent skipWaiting) ; toast « Nouvelle version installée » dans register-sw (clic = application immédiate). Cause racine : stale-while-revalidate servait l'ancien HTML indéfiniment quand la revalidation d'arrière-plan échouait (réseau 3G instable), d'où « c'est pas réglé » malgré des fixs déployés. v4.11 : écran maintenu allumé pendant les générations IA — wake-lock.js (Wake Lock natif Android/iOS + repli vidéo muette NoSleep pour navigateurs anciens, compteur de références multi-générations, ré-acquisition au retour d'arrière-plan) intégré aux pages arv, exam (génération + correction), reviseur, reviseur-history, exam-history, planificateur et arv-progress ; wake-lock.js precaché. v4.10 : fix QCM « le test sort de sa zone » — les options longues débordaient hors de l'écran (espaces insécables U+00A0 émis par l'IA → texte insécable + span flex sans min-width:0). Fix triple : serveur cleanLatexText normalise U+00A0/U+202F en espaces normaux sur TOUTE l'analyse ; cahier safeText normalise à l'affichage (sections déjà stockées réparées) + CSS .qcm-option (flex-start, min-width:0, span break-word) ; exam .answer-option/.question-title idem. v4.9 : fix UI — modales formulaire (détail d'une formule) et notifications : haut en dôme géant (border-radius 999px) → arrondi normal 20px comme les autres pages. v4.8 : dictée vocale v3 — anti-répétitions (fusion sans chevauchement des segments que le moteur re-transcrit après chaque relance + compression des bégaiements « le le »), cap recalibré 2 500 caractères (budget IA). v4.7 : dictée vocale reconstruite — flux 2 étapes scrollables dans « Ajouter une section » (étape 1 texte centré → étape 2 bouton enregistrer centré), durée illimitée (relance auto), cap 15 000 caractères, aperçu live, erreurs micro explicites. v4.6 : serveur progress v8.6 « édition complète » — explications prof enrichies, banque de questions exhaustive 10-40, QCM 8-12 imposés, anglais ré-ajouté au cahier (toujours sans mode examen), normalisation Q&R/QCM côté serveur. v4.5 : cahier (arv-progress) adapté au serveur progress v8.5 restauré tel quel — actions v9 retirées (progression/goals/sessions/quota/markSectionStudied), rendu contexte+faits clés histoire-géo ; connexion exam (useNotebook) inchangée. // v4.3 : notebook + exam — matière Anglais (cahier, sans mode examen), banque de questions élargie, QCM 8, bouton « Retourner à mon cahier », dictée vocale reconstruite (zéro doublon). v4.2 : réviseur « en dur » — accueil du réviseur peint pré-CDN depuis un snapshot local par chapitre (LRU 12, TTL 12 h), hydratation de l'état (notions incluses), revalidation silencieuse /api/reviseur conservant le cache en cas d'erreur réseau, statut blocked/paused via docSWR (arvexa-cache.js). v4.1 : audit stabilité — precache étendu (JS partagés bac-date/auth-guard/katex-utils/analytics/offline/onboarding-tour/register-fcm-sw/firebase-messaging-sw + pages auth-choice/login/404) pour un offline fiable dès l'installation. v4.0 : // v4.0 : accueil « en dur » — tableau de bord restauré pré-CDN depuis les caches locaux (countdown BAC, date/citation du jour, compteurs de lecture, badges), splash épuré (nom du site + cercle), anti-flash instant/ready. v3.9 : cache-first universel — arvexa-cache.js (readCacheDoc/docSWR : lecture cache IndexedDB Firestore instantanée + revalidation serveur arrière-plan), appliqué à arv, arv-progress, exam, exam-history, reviseur-history, tableau-periodique, formulaires ; préchauffage 1×/session dans l'index (matières+chapters+notifications). v3.8 : accueil instantané — splash 1er chargement de session + snapshot de session (retour accueil sans rechargement visible, pill de synchro). v3.8 : accueil instantané — splash de chargement au 1er chargement de session uniquement (#appSplash), snapshot de session pour restaurer l'accueil sans rechargement visible (Firestore actualise en arrière-plan + pill discrète). v3.7 : couverture i18n complète — +228 clés (abonnement, légal, examens, badges, toasts, titres de pages), apostrophes unifiées dans norm(), motifs Niveau/Partie/session/badges/mois, titres <title> ajoutés aux pages. v3.6 : bilingue FR/EN — arvexa-i18n.js (dictionnaire + MutationObserver + persistance 'arvexa-lang' + sync multi-onglets), sélecteur Langue dans profil.html. Précédent v3.5 : : mode clair global — tokens [data-theme=light] dans arvexa-ui.css, theme.js (persistance + meta theme-color + sync multi-onglets), boot anti-flash inline sur toutes les pages, couleurs codées en dur thémables (rgb triplets), toggle Apparence dans profil.html 4affefe (v4.26 : COURS SVT COMPLETS — 20 chapitres × 4 parties (80 fichiers, ~38 000 lignes) : IG, ADN, mitose/réplication, cycle cellulaire, protéines, synthèse protéines, méiose, brassage, hérédité humaine, anomalies chromosomiques, système nerveux, messages nerveux, glycémie, appareils génitaux, régulation hormonale, fécondation/nidation, régulation des naissances, soi/non-soi, réponses immunitaires, VIH/SIDA. Format pilote maths (hero/sommaire/QCM/fiches), math Unicode span.math (zéro KaTeX cassé), classes lecture-* thémées clair+sombre, contexte nigérien. Cache-manifest régénéré (83 fichiers) pour offline.)
// ✅ v5.7 — caches NON versionnés : les mises à jour du site ne détruisent
// PLUS JAMAIS le contenu téléchargé (PDF, cours) ni le cache utile.
// CACHE_DATA = téléchargements hors ligne de l'élève (persistant).
const CACHE_STATIC = 'arvexa-static';
const CACHE_HTML = 'arvexa-html';
const CACHE_DATA = 'arvexa-data';
// Anciens caches versionnés (v5.6 et avant) à migrer puis supprimer.
const LEGACY_CACHE_RE = /^arvexa-offline-v\d+-(static|html)$/;
// Garde-fous réseau : les HTML attendent le réseau au max HTML_NET_TIMEOUT avant de
// retomber sur le cache (fraîcheur garantie en ligne, réactivité préservée hors ligne).
const HTML_NET_TIMEOUT = 2500;
const PRECACHE_TIMEOUT = 8000;

// ⚡ Toutes les pages HTML de l'app pour précache complet
const PRECACHE = [
  './',
  './index.html',
  './matiere.html',
  './chapitre.html',
  './lecture.html',
  './profil.html',
  './reviseur.html',
  './exam.html',
  './exam-history.html',
  './abonnement.html',
  './notifications.html',
  './outils.html',
  './formulaires.html',
  './planificateur.html',
  './tableau-periodique.html',
  './arv-progress.html',
  './offline.html',
  './manifest.json',
  './perf.css',
  './arvexa-ui.css',
  './theme.js',
  './arvexa-contact.js', // v6.6 source unique du numéro de contact
  './arvexa-i18n.js',
  './arvexa-cache.js',
  './register-sw.js',
  './install-banner.js', // v5.6 barrière d'installation PWA
  './arvexa-confirm.js',
  './flux-router.js', // ⚡ ARVEXA FLUX — navigation instantanée (prototype)
  './wake-lock.js',
  // ✅ v8.0 — SYNC FIREBASE DES PROGRESSIONS : moteur + structure officielle des cours
  './arvexa-sync.js',
  './progress-totals.json',
  './icon.png',
  // ✅ v7.7 — icônes de notification (badge mono + grande icône variante 4)
  './notif-icon.png',
  './notif-logo.png',
  // v4.1 — offline fiable dès l'installation : JS partagés + pages d'auth
  './bac-date.js',
  './auth-guard.js',
  './katex-utils.js',
  './analytics.js',
  './offline.js',
  './onboarding-tour.js',
  './register-fcm-sw.js',
  './firebase-messaging-sw.js',
  './auth-choice.html',
  './whatsapp.html',
  './login.html',
  './404.html',
  // ✅ v5.3 — pdf.min.js / pdf.worker.min.js SORTIS du précachage d'install :
  // 1,4 Mo qui monopolisaient la bande passante de la 1ʳᵉ visite AVANT la
  // 1ʳᵉ page du cours (~5 s perdus sur réseau lent). Ils sont mis en cache
  // automatiquement au premier usage (handleStatic) et à l'ouverture du
  // lecteur (CACHE_URL) → la visionneuse reste 100 % hors-ligne après la
  // première lecture d'un cours.
];

// ═══ v5.4 — POLITIQUE PRÉCISE DES DOMAINES EXTERNES ═══
// Ressources STATIQUES tierces cachables (cache-first / stale-while-revalidate).
// Les SDK Firebase sont servis depuis des URLs VERSIONNÉES immuables :
// les mettre en cache est sans risque et rend l'app 100 % ouvrable hors ligne.
const CACHEABLE_CDN = [
  { host: 'www.gstatic.com', prefix: '/firebasejs/' }, // SDK Firebase (firebase-app/auth/firestore/messaging)
  { host: 'fonts.googleapis.com', prefix: '/' },        // CSS Google Fonts (Inter, Playfair Display)
  { host: 'fonts.gstatic.com', prefix: '/' },           // fichiers woff2/ttf
  { host: 'cdnjs.cloudflare.com', prefix: '/' }         // Font Awesome
];

// Ne JAMAIS intercepter : points d'API et de DONNÉES (jamais de réponse
// Firestore/Auth servie depuis un cache — cohérence et sécurité).
const NEVER_CACHE_HOSTS = [
  'firebaseio.com',
  'firebasedatabase.app',
  'googleapis.com',        // firestore/identitytoolkit/securetoken/firebaselogging… (SAUF fonts.googleapis, traité AVANT)
  'gstatic.com',           // tout le reste de gstatic (SAUF www.gstatic.com/firebasejs/, traité AVANT)
  'firebaseapp.com',
  'firebasestorage.app'
];

const NEVER_CACHE_PREFIXES = ['/api/'];

// v5.4 — correspondance exacte hôte + préfixe (AVANT le blocage large)
function matchCacheableCdn(url) {
  for (let i = 0; i < CACHEABLE_CDN.length; i++) {
    const c = CACHEABLE_CDN[i];
    if (url.hostname === c.host && url.pathname.startsWith(c.prefix)) return c;
  }
  return null;
}

// v5.4 — détection connexion lente (2G) côté SW
function isSlowConnection() {
  try {
    const c = self.navigator.connection;
    if (!c) return false;
    if (c.saveData) return true;
    const t = c.effectiveType || '';
    return t === 'slow-2g' || t === '2g';
  } catch (e) {
    return false;
  }
}

// ═══ INSTALL ═══
// Chaque URL du precache est bornée dans le temps (PRECACHE_TIMEOUT) : en réseau
// instable, l'installation ne peut plus pendre des minutes et retarder skipWaiting.
function precacheOne(cache, url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PRECACHE_TIMEOUT);
  return fetch(new Request(url, { signal: ctl.signal }))
    .then((response) => {
      if (response && response.ok) return cache.put(url, response);
      console.warn('[SW] Précache ignoré :', url);
    })
    .catch(() => {
      console.warn('[SW] Précache ignoré :', url);
    })
    .finally(() => clearTimeout(timer));
}

self.addEventListener('install', (event) => {
  console.log(`[SW] Install ${SW_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => Promise.all(PRECACHE.map((url) => precacheOne(cache, url))))
      .then(() => self.skipWaiting())
  );
});

// ═══ ACTIVATE ═══
// ✅ v5.7 — MIGRATION : les anciens caches versionnés (arvexa-offline-vX-static
// / -html) sont copiés dans les caches non versionnés SANS réseau (les PDF et
// cours téléchargés par l'élève sont conservés à travers les mises à jour),
// PUIS supprimés. Fini le « tout est retéléchargé après une mise à jour ».
async function migrateLegacyCaches() {
  try {
    const names = await caches.keys();
    const legacy = names.filter((n) => LEGACY_CACHE_RE.test(n));
    for (const name of legacy) {
      const src = await caches.open(name);
      const keys = await src.keys();
      const isHtmlCache = name.endsWith('-html');
      for (const req of keys) {
        try {
          const resp = await src.match(req);
          if (!resp) continue;
          let pathname = '';
          try { pathname = new URL(req.url).pathname.toLowerCase(); } catch (e) {}
          const dest = isHtmlCache
            ? ((pathname.endsWith('.pdf') || pathname.endsWith('.json')) ? CACHE_DATA : CACHE_HTML)
            : CACHE_STATIC;
          const target = await caches.open(dest);
          const existing = await target.match(req);
          if (!existing) await target.put(req, resp);
        } catch (e) {}
      }
      await caches.delete(name);
    }
    if (legacy.length) console.log('[SW] Migration caches v5.6 → v5.7 :', legacy.join(', '));
  } catch (e) {}
}

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activate ${SW_VERSION}`);
  event.waitUntil(
    migrateLegacyCaches()
      .then(() => caches.keys())
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== CACHE_STATIC && n !== CACHE_HTML && n !== CACHE_DATA)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((client) =>
        client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION })
      ))
  );
});

// ═══ FETCH ═══
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (NEVER_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  // ✅ v5.4 — SDK Firebase + polices : statiques cachables (AVANT le blocage
  // large gstatic/googleapis). Sans cela, hors ligne, l'import des modules
  // Firebase échoue et la page reste bloquée sur son écran de chargement.
  if (matchCacheableCdn(url)) {
    event.respondWith(handleStatic(req));
    return;
  }

  if (NEVER_CACHE_HOSTS.some((h) => url.hostname.includes(h))) return;

  // ✅ v5.8 — PDF : passerelle dédiée (206 Range depuis le cache, cache
  // garanti au 1ᵉʳ passage, téléchargement unique dédupliqué). Placée AVANT
  // la détection HTML : un clic sur « télécharger le PDF » part en
  // mode navigate et ne doit jamais passer par handleHTML.
  if (url.pathname.toLowerCase().endsWith('.pdf')) {
    event.respondWith(handlePdf(req, event));
    return;
  }

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(handleHTML(req));
    return;
  }

  if (
    req.destination === 'style' ||
    req.destination === 'script' ||
    req.destination === 'font' ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(handleStatic(req));
    return;
  }

  if (req.destination === 'image') {
    event.respondWith(handleImage(req));
    return;
  }

  event.respondWith(handleGeneric(req));
});

// ═══ STRATÉGIES ═══

// 🔄 HTML : NETWORK-FIRST avec garde-fou (remplace stale-while-revalidate)
// En ligne → le réseau d'abord : chaque page servie est LA version déployée,
// les correctifs arrivent sur les téléphones dès la première ouverture.
// Appareil hors ligne déclaré → cache instantané (zéro latence).
// Réseau lent/échoué → cache sous HTML_NET_TIMEOUT, puis le fetch continue
// en tâche de fond pour rafraîchir le cache de la prochaine fois.
function offlineFallback(req) {
  return caches.open(CACHE_STATIC)
    .then((staticCache) => staticCache.match(req, { ignoreSearch: true }))
    .then((cachedStatic) => {
      if (cachedStatic) return cachedStatic;
      return caches.match('./offline.html');
    })
    .then((offline) => {
      if (offline) return offline;
      return new Response(
        '<!DOCTYPE html><html lang="fr"><body><h1>Hors ligne</h1><p>Page non disponible.</p></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    });
}

async function handleHTML(req) {
  const cache = await caches.open(CACHE_HTML);
  // ✅ v4.31 — ignoreSearch : la navigation hors-ligne « /lecture.html?subject=… »
  // doit retrouver le cache « /lecture.html » (sans query, le match échouait
  // et l'élève tombait sur offline.html alors que la page EST en cache)
  const cached = await cache.match(req, { ignoreSearch: true });

  // Mode avion / pas de connectivité déclarée → cache direct
  if (self.navigator && self.navigator.onLine === false && cached) return cached;

  // ✅ v5.4 — Connexion LENTE (2G / slow-2g / économiseur de données) → cache
  // d'abord : la page s'affiche INSTANTANÉMENT, le réseau rafraîchit en
  // arrière-plan pour la prochaine visite. Avant : network-first (2,5 s de
  // patience) rendait chaque navigation pénible en 2G même page en cache.
  if (cached && isSlowConnection()) {
    fetch(req)
      .then((response) => {
        if (response && response.ok) cache.put(req, response.clone());
      })
      .catch(() => {});
    return cached;
  }

  // La promesse réseau vit au-delà du garde-fou : si elle aboutit après un
  // repli sur cache, elle rafraîchit quand même le cache pour la prochaine fois.
  const netPromise = fetch(req)
    .then((response) => {
      if (response && response.ok) cache.put(req, response.clone());
      return response;
    })
    .catch(() => null);

  let served = null;
  try {
    served = await Promise.race([
      netPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('HTML_NET_TIMEOUT')), HTML_NET_TIMEOUT)
      ),
    ]);
    if (served) return served;
  } catch (e) {
    // réseau trop lent → repli cache ci-dessous
  }

  if (cached) return cached;

  // Pas de cache (première visite) : laisser le fetch initial une vraie chance
  try {
    served = await netPromise;
    if (served) return served;
  } catch (e) {}

  return offlineFallback(req);
}

// ⚡ Static : stale-while-revalidate (déjà correct)
async function handleStatic(req) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(req, { ignoreSearch: true });

  const fetchPromise = fetch(req)
    .then((response) => {
      if (response && response.ok) cache.put(req, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || new Response('', { status: 504 });
}

async function handleImage(req) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const response = await fetch(req);
    if (response && response.ok) cache.put(req, response.clone());
    return response;
  } catch (e) {
    return new Response('', { status: 204 });
  }
}

// ✅ v5.7 — FICHIERS (PDF, cours, JSON, assets non HTML) : CACHE-FIRST avec
// revalidation arrière-plan. Tout ce qui est déjà téléchargé s'affiche
// INSTANTANÉMENT (même en ligne) — plus jamais d'attente réseau ni de
// retéléchargement à l'entrée d'un cours déjà vu. Le réseau rafraîchit le
// cache pour la consultation suivante. Les API/données restent exclues
// (NEVER_CACHE_HOSTS en amont). Les pages HTML naviguées restent
// network-first (handleHTML) pour recevoir chaque correction déployée.
async function handleGeneric(req) {
  let pathname = '';
  try { pathname = new URL(req.url).pathname.toLowerCase(); } catch (e) {}
  // PDF + manifestes JSON + fichiers de cours → cache données persistant
  const isData = pathname.endsWith('.pdf') || pathname.endsWith('.json') || pathname.includes('/cours/');
  const cache = await caches.open(isData ? CACHE_DATA : CACHE_HTML);

  // 1) cache d'abord = affichage instantané
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) {
    // Rafraîchissement arrière-plan : sauté pour les Range requests de pdf.js
    // (réponses 206 non cachables) et en 2G / économiseur de données (on ne
    // re-télécharge pas plusieurs Mo sur une liaison faible). Sur réseau
    // correct, le PDF rouvert se met à jour silencieusement en arrière-plan
    // sans jamais bloquer l'affichage.
    if (!req.headers.get('range') && self.navigator.onLine !== false && !isSlowConnection()) {
      fetch(req)
        .then((r) => { if (r && r.status === 200 && req.method === 'GET') cache.put(req, r.clone()); })
        .catch(() => {});
    }
    return cached;
  }

  // 2) pas en cache → réseau (et mise en cache pour la prochaine fois)
  try {
    const response = await fetch(req);
    // ✅ v5-PDF/v5.3 — uniquement les réponses 200 complètes : une HEAD (sonde
    // de disponibilité) ou un 206 (range request pdf.js) ne doit jamais
    // écraser l'entrée GET complète d'une même URL.
    if (response && response.status === 200 && req.method === 'GET') cache.put(req, response.clone());
    return response;
  } catch (e) {
    // 3) réseau indisponible → dernier recours dans les autres caches
    const legacy = await caches.match(req, { ignoreSearch: true });
    return legacy || new Response('', { status: 504 });
  }
}

// ═══ ✅ v5.8 — PASSERELLE PDF ═══
// Objectifs : réouverture INSTANTANÉE d'un PDF déjà vu (206 tranchés depuis
// le cache, hors ligne compris), mise en cache GARANTIE au premier passage
// (un seul téléchargement complet, détenu par waitUntil), zéro double
// téléchargement entre pdf.js, CACHE_URL et DOWNLOAD_ALL.
const pdfInflight = new Map(); // url -> Promise<Uint8Array> (téléchargement en vol)
const PDF_DL_TIMEOUT = 120000; // 2G réel : ~40-60 s pour 1,5 Mo
const PDF_REFRESH_MAX_AGE = 7 * 24 * 3600 * 1000; // rafraîchissement arrière-plan

function parseRangeBytes(hdr, total) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(hdr || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start, end;
  if (m[1] === '') {
    const suffix = parseInt(m[2], 10);
    if (!(suffix > 0)) return null;
    start = Math.max(0, total - suffix); end = total - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? total - 1 : Math.min(parseInt(m[2], 10), total - 1);
  }
  if (!(start >= 0) || !(end >= start)) return null;
  if (start >= total) return { unsatisfiable: true };
  return { start, end };
}

function pdfSliceResponse(buf, start, end, total) {
  const slice = buf.subarray(start, end + 1);
  const copy = new Uint8Array(slice.length);
  copy.set(slice);
  return new Response(copy, {
    status: 206,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(copy.length),
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes'
    }
  });
}

// Téléchargement complet d'un PDF : UN SEUL par URL tant qu'il est en vol
// (toutes les requêtes — GET complet + Range — attendent le même buffer),
// mis en cache dans CACHE_DATA avant résolution (garanti, même si pdf.js
// avorte ses requêtes). Les fetch() émis DEPUIS le SW contournent le handler
// fetch : pas de boucle possible.
function downloadPdfFull(url) {
  let entry = pdfInflight.get(url);
  if (entry) return entry;
  entry = (async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, PDF_DL_TIMEOUT);
    try {
      const res = await fetch(new Request(url, { cache: 'reload', signal: ctl.signal }));
      if (!res || !res.ok || res.status !== 200 || !res.body) {
        throw new Error('HTTP ' + (res ? res.status : 'réseau'));
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (!buf.length) throw new Error('PDF vide');
      try {
        const cache = await caches.open(CACHE_DATA);
        const copy = new Uint8Array(buf.length); copy.set(buf); // buffer maître préservé
        await cache.put(new Request(url, { method: 'GET' }), new Response(copy, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': String(buf.length),
            'Accept-Ranges': 'bytes',
            'x-arv-cached-at': String(Date.now())
          }
        }));
      } catch (e) {
        console.warn('[SW-PDF] cache.put échoué :', e && e.message);
      }
      return buf;
    } finally {
      clearTimeout(timer);
    }
  })();
  pdfInflight.set(url, entry);
  entry.catch(() => {}).finally(() => {
    // la promesse reste partagée 15 s : les Range requests concurrentes
    // (pdf.js) réutilisent le même buffer au lieu de relancer un vol
    setTimeout(() => { if (pdfInflight.get(url) === entry) pdfInflight.delete(url); }, 15000);
  });
  return entry;
}

async function handlePdf(req, event) {
  const url = req.url;
  const rangeHdr = req.headers.get('range');
  const cache = await caches.open(CACHE_DATA);
  const cached = await cache.match(url, { ignoreSearch: true });

  if (cached) {
    // ── Range request → 206 tranché depuis le cache (pdf.js EXIGE un 206 ;
    // un 200 complet le fait repartir en échec → « le PDF ne charge pas »).
    if (rangeHdr) {
      try {
        const master = new Uint8Array(await cached.clone().arrayBuffer());
        const r = parseRangeBytes(rangeHdr, master.length);
        if (r && r.unsatisfiable) {
          return new Response('', {
            status: 416,
            headers: { 'Content-Range': `bytes */${master.length}` }
          });
        }
        if (r) return pdfSliceResponse(master, r.start, r.end, master.length);
      } catch (e) {}
      return cached; // dernier recours (corps complet)
    }
    // ── GET complet → cache instantané ; rafraîchissement arrière-plan
    // SEULEMENT si l'entrée a > 7 jours (x-arv-cached-at) : on ne
    // re-télécharge plus 1,5 Mo à chaque ouverture sur réseau correct.
    try {
      const cachedAt = Number(cached.headers.get('x-arv-cached-at') || 0);
      const fresh = cachedAt > 0 && (Date.now() - cachedAt) < PDF_REFRESH_MAX_AGE;
      if (!fresh && self.navigator.onLine !== false && !isSlowConnection()) {
        const refresh = downloadPdfFull(url).catch(() => {});
        if (event) { try { event.waitUntil(refresh); } catch (e) {} }
      }
    } catch (e) {}
    return cached;
  }

  // ── Absent du cache : UN SEUL téléchargement complet, garanti mis en
  // cache, partagé par le GET initial ET toutes les Range requests de
  // pdf.js (avant : le GET avorté cassait cache.put → PDF jamais caché).
  const dl = downloadPdfFull(url);
  if (event) { try { event.waitUntil(dl.catch(() => {})); } catch (e) {} }
  let buf;
  try {
    buf = await dl;
  } catch (e) {
    return new Response('', { status: 504 }); // pdf.js → écran erreur + Réessayer
  }
  const total = buf.length;
  if (rangeHdr) {
    const r = parseRangeBytes(rangeHdr, total);
    if (r && r.unsatisfiable) {
      return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    }
    if (r) return pdfSliceResponse(buf, r.start, r.end, total);
  }
  const copy = new Uint8Array(total); copy.set(buf);
  return new Response(copy, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(total),
      'Accept-Ranges': 'bytes'
    }
  });
}

// ═══ HANDLERS MESSAGE ═══
// ✅ v5.7 — drapeau d'annulation partagé par le téléchargement en cours
let downloadAborted = false;

// ✅ v5.9 — état du téléchargement consultable par N'IMPORTE QUELLE page
let downloadInflight = new Set(); // ✅ v5.9 — fetch en vol du job courant (annulation immédiate)
let currentDownload = null; // job en cours { running, done, failed, skipped, total, percent, ts }
let lastDownload = null;    // dernier résultat (consultable ~15 s) { finished, ok, done, failed, skipped, total, ts }

self.addEventListener('message', (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'DOWNLOAD_ALL' && Array.isArray(data.files) && port) {
    // ✅ v5.7 — waitUntil GARANTIT la survie du SW pendant TOUT le
    // téléchargement (avant : travail asynchrone non protégé — Chrome pouvait
    // tuer le SW en plein téléchargement → reprise impossible, retéléchargement).
    // ✅ v6.0 — background=true (téléchargement en arrière-plan) : 2 fichiers
    // en parallèle au lieu de 3 → la navigation de l'élève reste fluide.
    event.waitUntil(downloadAllFiles(data.files, port, data.background === true));
    return;
  }

  // ✅ v5.7 — bouton « Annuler » du pop-up de téléchargement
  if (data.type === 'DOWNLOAD_CANCEL') {
    downloadAborted = true;
    // ✅ v5.9 — annulation IMMÉDIATE : on coupe aussi les fetch en vol du job
    // (les HTML/JSON s'arrêtent instantanément ; un PDF déjà en vol se termine,
    // les workers s'arrêtent juste après — jamais plus de 30 s d'attente).
    for (const c of downloadInflight) { try { c.abort(); } catch (e) {} }
    return;
  }

  // ✅ v5.7 — vérification instantanée (zéro réseau) : lesquels de ces
  // fichiers sont déjà en cache ? Utilisé par offline.js pour ne jamais
  // retélécharger ce qui est déjà sur l'appareil.
  if (data.type === 'CHECK_CACHED' && Array.isArray(data.files) && port) {
    event.waitUntil((async () => {
      try {
        const cached = [];
        for (const f of data.files) {
          if (await isFileCached(f)) cached.push(f);
        }
        port.postMessage({ type: 'CHECK_CACHED_RESULT', cached, total: data.files.length });
      } catch (e) {
        port.postMessage({ type: 'CHECK_CACHED_RESULT', cached: [], total: data.files.length });
      }
    })());
    return;
  }

  // ✅ v5.9 — où en est le téléchargement en arrière-plan ? (rattachement
  // de la pastille après une navigation ; le job vit dans le SW)
  if (data.type === 'DOWNLOAD_STATUS' && port) {
    port.postMessage({ type: 'DOWNLOAD_STATUS', state: currentDownload, last: lastDownload });
    return;
  }

  if (data.type === 'CACHE_URL' && data.url) {
    // ✅ v5.3 — delay optionnel : le téléchargement complet d'un PDF (pour le
    // hors-ligne) démarre APRÈS que la 1ʳᵉ page a pu s'afficher, pour ne pas
    // concurrencer les Range requests sur réseau lent.
    // ✅ v5.7 — waitUntil : le SW survit VRAIMENT au timer et au téléchargement.
    const delay = Math.max(0, Math.min(60000, data.delay | 0));
    if (delay > 0) {
      event.waitUntil(
        new Promise((res) => setTimeout(res, delay)).then(() => cacheUrl(data.url))
      );
    } else {
      event.waitUntil(cacheUrl(data.url));
    }
    return;
  }

  if (data.type === 'STATS' && port) {
    event.waitUntil(getStats(port));
  }
});

// ✅ v5.7 — un fichier est-il déjà présent dans un des caches ?
async function isFileCached(url) {
  try {
    const dataCache = await caches.open(CACHE_DATA);
    if (await dataCache.match(url, { ignoreSearch: true })) return true;
    const htmlCache = await caches.open(CACHE_HTML);
    if (await htmlCache.match(url, { ignoreSearch: true })) return true;
    const staticCache = await caches.open(CACHE_STATIC);
    if (await staticCache.match(url, { ignoreSearch: true })) return true;
    return false;
  } catch (e) {
    return false;
  }
}

// ✅ v5.7 — téléchargement RAPIDE et NON BLOQUANT :
//   • les fichiers déjà en cache sont SAUTÉS (2e visite = quelques secondes) ;
//   • 3 fichiers en parallèle (au lieu de 1 séquentiel) ;
//   • timeout 30 s par fichier (plus jamais de boucle qui pend) ;
//   • annulable à tout moment (bouton « Annuler ») ;
//   • tout est rangé dans CACHE_DATA (persistant entre les mises à jour).
async function downloadAllFiles(files, port, backgroundMode) {
  downloadAborted = false;
  const total = files.length;
  let done = 0;
  let failed = 0;
  let skipped = 0;

  const cache = await caches.open(CACHE_DATA);

  // ✅ v5.9 — le job devient visible pour toutes les pages (DOWNLOAD_STATUS)
  downloadInflight.clear();
  currentDownload = { running: true, done: 0, failed: 0, skipped: 0, total, percent: 0, ts: Date.now() };

  const postProgress = () => {
    const finished = done + failed + skipped;
    const percent = total ? Math.round((finished / total) * 100) : 100;
    // ✅ v5.9 — l'état global suit la progression (pages suivantes = pastille à jour)
    currentDownload = { running: true, done, failed, skipped, total, percent, ts: Date.now() };
    try {
      port.postMessage({ type: 'DOWNLOAD_PROGRESS', done, failed, skipped, total, percent });
    } catch (e) {}
  };

  // Passe 1 : ce qui est déjà là est compté instantanément (zéro réseau)
  const pending = [];
  for (const url of files) {
    if (downloadAborted) break;
    if (await isFileCached(url)) skipped++;
    else pending.push(url);
    if ((skipped + done + failed) % 10 === 0 || skipped === total) postProgress();
  }
  postProgress();

  // Passe 2 : téléchargement parallèle des fichiers manquants
  const queue = pending.slice();
  const worker = async () => {
    while (queue.length) {
      if (downloadAborted) return;
      const url = queue.shift();
      // ✅ v5.8 — les PDF passent par la passerelle dédupliquée : si le
      // lecteur a déjà téléchargé ce PDF (en vol ou cache frais), aucun
      // second téléchargement n'est lancé ; timeout 90 s (30 s pouvaient
      // couper un PDF de 1,5 Mo sur 2G → échec reporté à tort).
      if (/\.pdf(\?|$)/i.test(url)) {
        try {
          await downloadPdfFull(url);
          done++;
        } catch (e) {
          failed++;
        }
        postProgress();
        continue;
      }
      const ctl = new AbortController();
      downloadInflight.add(ctl); // ✅ v5.9 — annulable immédiatement
      const timer = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, 30000);
      try {
        const response = await fetch(url, { cache: 'reload', signal: ctl.signal });
        if (response && response.ok && response.status === 200) {
          await cache.put(url, response);
          done++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      } finally {
        clearTimeout(timer);
        downloadInflight.delete(ctl);
      }
      postProgress();
    }
  };
  // ✅ v6.0 — 3 fichiers en parallèle en mode MODALE (l'élève attend devant
  // la barre, on va vite) ; 2 en mode ARRIÈRE-PLAN (il navigue en même
  // temps : sa navigation ne doit pas être affamée).
  const PARALLEL = backgroundMode ? 2 : 3;
  const workers = [];
  for (let i = 0; i < PARALLEL; i++) workers.push(worker());
  await Promise.all(workers);

  try {
    if (downloadAborted) {
      port.postMessage({ type: 'DOWNLOAD_CANCELLED', done, failed, skipped, total });
    } else {
      port.postMessage({ type: 'DOWNLOAD_COMPLETE', done, failed, skipped, total });
    }
  } catch (e) {}

  // ✅ v5.9 — résultat consultable 15 s : la page suivante peut afficher
  // « ✅ N fichiers prêts hors ligne » et poser l'état persistant même si
  // la page d'origine a été fermée entre-temps.
  lastDownload = { finished: true, ok: !downloadAborted, done, failed, skipped, total, ts: Date.now() };
  currentDownload = null;
}

async function cacheUrl(url) {
  try {
    // ✅ v5.8 — JAMAIS de double téléchargement : si le fichier est déjà
    // dans un cache (consulté, préchauffé ou téléchargé offline), on ne
    // fait RIEN. Avant, ce préchauffage relançait un GET complet du PDF
    // 6 s après la lecture (2ᵉ copie) et jusqu'à 3 copies de pdf.js.
    if (await isFileCached(url)) return;
    if (/\.pdf(\?|$)/i.test(url)) {
      await downloadPdfFull(url);
      return;
    }
    const response = await fetch(url, { cache: 'reload' });
    if (response && response.ok && response.status === 200) {
      const cache = await caches.open(CACHE_DATA);
      await cache.put(url, response);
    }
  } catch (e) {}
}

async function getStats(port) {
  try {
    const names = await caches.keys();
    const stats = {};
    for (const name of names) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      stats[name] = keys.length;
    }
    port.postMessage({ type: 'STATS_RESULT', stats });
  } catch (e) {
    port.postMessage({ type: 'STATS_RESULT', stats: {} });
  }
}

console.log(`[SW] ${SW_VERSION} prêt — navigation instantanée active`);
