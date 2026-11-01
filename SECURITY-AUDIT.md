# Audit de securite ARVEXA School

| Gravite | Fichier | Probleme | Risque | Correction |
|---|---|---|---|---|
| CRITIQUE | `api/exam.js` | Le backend pouvait accepter un utilisateur fictif quand Firebase Admin n'etait pas configure. | Contournement de l'authentification et du quota. | Le fallback local est limite a `EXVA_LOCAL_FALLBACK=true` hors production. En production, un token Firebase est obligatoire. |
| ELEVEE | `api/exam.js` | Les cles IA sont appelees côté serveur mais les erreurs de configuration doivent rester generiques. | Fuite d'informations d'infrastructure. | Les secrets restent dans Vercel et les reponses API sont generiques. |
| ELEVEE | `firestore.rules` | Les champs Premium, role et permissions ne doivent pas etre modifiables par le client. | Escalade de privileges. | Les mises a jour sensibles sont reservees a l'admin; les collections d'examens sont ecrites par le serveur Admin. |
| ELEVEE | `api/planner.js` | Le planificateur expose des resultats si le compte n'est pas Premium. | Acces Premium non autorise. | Verification du token Firebase puis du statut Premium côté serveur. |
| ELEVEE | `api/scan.js` | L'endpoint IA pouvait être appelé sans authentification Firebase. | Consommation abusive des fournisseurs IA et exposition d'un service Premium. | Vérification obligatoire du token Firebase avant tout appel fournisseur. |
| MOYENNE | `exam.html` | Les reponses d'examen sont conservees en brouillon local. | Exposition locale possible sur un appareil partage. | Le brouillon ne contient pas de mot de passe ni de credential; la correction et la persistance serveur restent côté API. |
| MOYENNE | `index.html` | Une absence de session ne distinguait pas correctement visiteur et compte existant. | Mauvaise redirection et boucles. | Ajout de `auth-choice.html` apres resolution Firebase. |
| FAIBLE | Pages HTML | Plusieurs pages initialisent Firebase séparément. | Coût et complexité de maintenance. | Aucun changement global risqué; les pages utilisent la persistence locale et un seul listener par page. Une migration vers un module commun est recommandee ensuite. |
| INFO | Frontend | La clé Web Firebase est visible. | Ce type de clé n'est pas un secret; les règles restent l'autorité. | Les credentials Admin et clés IA ne sont jamais livrés au frontend. |

## Limites de l'audit

Les tests de production nécessitent une URL Vercel, un compte Firebase de test et un environnement Node/Firebase disponible. Aucun credential réel n'est copié dans ce dossier.
