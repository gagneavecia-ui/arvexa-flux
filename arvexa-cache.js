/* ═══════════════════════════════════════════════════════════════════
   ARVEXA-CACHE.JS — lecture cache-first universelle (toutes pages)
   ─────────────────────────────────────────────────────────────────
   Principe : chaque page lit Firestore d'abord dans le cache local
   (IndexedDB, zéro réseau, ~10-50 ms) puis revalide silencieusement
   le serveur en arrière-plan. L'affichage est instantané et les
   données restent à jour — aucune page ne re-télécharge ce qu'elle
   connaît déjà pendant la session.
   ═══════════════════════════════════════════════════════════════════ */
import { getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

/* Snapshot depuis le cache local Firestore (null si absent/erreur).
   Zéro réseau : la lecture vient de l'IndexedDB du navigateur. */
export async function readCacheDoc(ref) {
  try {
    const snap = await getDoc(ref, { source: 'cache' });
    return snap && snap.exists() ? snap : null;
  } catch (e) {
    return null;
  }
}

/* Cache-first complet :
   - cache présent  → onData(cache) immédiat, l'appelant n'attend rien
     de plus ; le serveur est revalidé en arrière-plan et onData(fresh)
     n'est rappelé que si compareFn(cached, fresh) est vraie ;
   - cache absent   → serveur (comportement classique, 1re visite).
   compareFn(optionnelle) : décide si une réapplication est nécessaire
   (ex. statut Premium ou accountStatus changé). */
export function docSWR(ref, onData, compareFn) {
  return (async () => {
    const cached = await readCacheDoc(ref);
    if (cached) {
      onData(cached);
      getDoc(ref, { source: 'server' }).then((fresh) => {
        if (!fresh.exists()) return;
        let changed;
        if (typeof compareFn === 'function') {
          try { changed = compareFn(cached.data(), fresh.data()); } catch (e) { changed = true; }
        } else {
          try { changed = JSON.stringify(cached.data()) !== JSON.stringify(fresh.data()); }
          catch (e) { changed = true; }
        }
        if (changed) onData(fresh);
      }).catch(() => { /* hors-ligne : le cache affiché est conservé */ });
      return;
    }
    try {
      const fresh = await getDoc(ref, { source: 'server' });
      if (fresh.exists()) onData(fresh);
    } catch (e) { /* hors-ligne sans cache : rien à afficher */ }
  })();
}
