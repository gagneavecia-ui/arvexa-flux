/*! arvexa-sync.js — v1.2 — ARVEXA School
================================================================
SYNCHRONISATION FIREBASE DES PROGRESSIONS (v8.5 — demande propriétaire :
« j'ai créé un tout nouveau compte et je vois les progressions de mon
autre compte sur le nouveau » → ISOLATION STRICTE par compte :
« les progressions sont enregistrées en local… chaque compte doit avoir
ses propres données… tout sauvegardé dans Firebase : progressions,
chapitres, nombre de sections, et le calcul de la progression »).

CE QUI EST SYNCHRONISÉ (par compte Firebase Auth, doc unique
users/{uid}/progression/course) :
  - readParts      : array des sections lues « matiere_chapitre_onglet_partie »
  - notes          : les notes de lecture par section {clé: {t, u}} (t=texte, u=timestamp)
  - dailyActivity  : activité quotidienne {jour: nb sections lues}
  - stats          : LE CALCUL DE PROGRESSION (par section/chapitre/matière/global,
                     calculé depuis progress-totals.json — structure officielle des cours)

GARANTIES :
  1. ISOLATION PAR COMPTE (v1.1/v1.2, renforcée) : les données locales sont
     archivées (« stash ») par uid. Un changement de compte restaure LE stash
     du compte entrant s'il en a un ; sinon → données locales VIDÉES (aucune
     adoption silencieuse). La progression ne revient QUE depuis le document
     cloud du compte entrant.
     v1.1 : l'« adoption intelligente » v8.0 est SUPPRIMÉE — c'est elle qui
     faisait fuiter la progression d'un compte vers un compte tout neuf.
  1b. GARDE ANTI-COURSE : push() et syncDown() capturent l'uid au départ et
     annulent leur écriture si le compte actif a changé entre-temps (switch
     de compte pendant un aller-retour réseau → jamais de croisement).
  1c. COFFRE DE L'APPAREIL + CONFIRMATION UNIQUE (v1.2) : la sync v8.0 n'a
     JAMAIS tourné (bug authMod) → les progressions de tous les élèves ne
     vivent qu'en local. Pour ne rien détruire sans sacrifier l'isolation :
     les données locales inattendues d'un compte entrant sont mises au
     « coffre » (arvexa_sync_legacy) et PROPOSÉES via une confirmation
     unique « Ces données sont-elles les tiennes ? » — Oui → adoptées et
     uploadées dans CE compte ; Non → ce compte démarre à zéro, le coffre
     reste disponible pour un autre compte de l'appareil. Chaque compte
     n'est interrogé qu'UNE fois (marqueur par uid). Aucun mélange jamais
     effectué sans accord explicite.
  2. RESET COMPLET : resetLive() vide TOUTES les clés de progression
     (read/notes/meta/activité + snapshot accueil session et persist).
  3. CONCURRENCE SÛRE (même compte sur 2 appareils ouverts) : écriture en
     setDoc(merge:true) + arrayUnion pour readParts + champs par clé pour
     notes/dailyActivity → aucune écriture n'écrase une autre.
  4. HORS-LIGNE : tout fonctionne en local (comme avant) ; les pushes échoués
     sont re-tentés au retour du réseau. Fusion par UNION à la reconnexion.
  5. CACHE COURS INCHANGÉ : les pages de cours restent gérées par le Service
     Worker (demande propriétaire : « sauf les pages en cache avec les cours »).

ÉVÉNEMENT : window « arvexa-progress-updated » après chaque fusion/écriture →
les pages (index, matiere, chapitre, arv-progress) re-rendent leur UI.
API : window.ArvexaProgress.{notifyChange, chapterTotal, subjectTotals, getStats}
================================================================ */
(function (root) {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // CLÉS LOCALES (lues aussi par index/matiere/chapitre/lecture)
  // ─────────────────────────────────────────────────────────────
  var K_READ = 'arvexa_read_parts';          // array de clés de sections lues
  var K_NOTES = 'arvexa_notes';              // {clé: texte}
  var K_NOTES_META = 'arvexa_notes_meta';    // {clé: timestamp dernière édition}
  var K_ACT = 'arvexa_daily_activity';       // {jour: nb}
  var K_SNAP = 'arvexa_daily_snap';          // {jour: total cumulé} (accueil)
  var K_OWNER = 'arvexa_sync_owner';         // uid propriétaire de l'appareil
  var K_ACTIVE = 'arvexa_sync_active_uid';   // uid actif courant
  var STASH_PFX = 'arvexa_sync_u_';          // + uid + '_read' / '_notes' / '_meta' / '_act'
  var K_LEGACY = 'arvexa_sync_legacy';       // ✅ v1.2 coffre de l'appareil
  var K_ASKED = 'arvexa_sync_asked_';        // ✅ v1.2 + uid = déjà interrogé

  var MAX_NOTE_LEN = 5000;   // aligné maxlength textarea lecture.html
  var PUSH_DELAY_NOTES = 2000; // debounce notes

  // ─────────────────────────────────────────────────────────────
  // CŒUR PUR (testable sous Node via module.exports)
  // ─────────────────────────────────────────────────────────────

  function dayStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  // « mathematiques_3_cours_2 » → {subject, chapter, tab, part}
  function parseKey(key) {
    var parts = String(key || '').split('_');
    if (parts.length < 4) return null;
    return {
      subject: parts[0],
      chapter: parts[1],
      tab: parts.slice(2, parts.length - 1).join('_'),
      part: parts[parts.length - 1]
    };
  }

  // Union triée (la progression ne fait que croître)
  function mergeReadParts(localArr, cloudArr) {
    var seen = Object.create(null);
    var out = [];
    (Array.isArray(localArr) ? localArr : []).concat(Array.isArray(cloudArr) ? cloudArr : [])
      .forEach(function (k) {
        var s = String(k || '');
        if (s && !seen[s]) { seen[s] = 1; out.push(s); }
      });
    out.sort();
    return out;
  }

  /*
    Fusion notes : gagnant = édition la plus récente (u/meta) ; égalité → texte le plus long.
    Formats acceptés : cloud {clé: {t, u}} OU {clé: 'texte'} (hérité) ; local {clé: 'texte'} + meta.
    Retour {notes: {clé: texte}, meta: {clé: ts}, changed: bool}
  */
  function mergeNotes(localNotes, localMeta, cloudNotes) {
    localNotes = localNotes && typeof localNotes === 'object' ? localNotes : {};
    localMeta = localMeta && typeof localMeta === 'object' ? localMeta : {};
    cloudNotes = cloudNotes && typeof cloudNotes === 'object' ? cloudNotes : {};
    var keys = Object.create(null);
    Object.keys(localNotes).forEach(function (k) { keys[k] = 1; });
    Object.keys(cloudNotes).forEach(function (k) { keys[k] = 1; });
    var notes = {}, meta = {}, changed = false;
    Object.keys(keys).sort().forEach(function (k) {
      var lText = typeof localNotes[k] === 'string' ? localNotes[k] : '';
      var lU = Number(localMeta[k]) || 0;
      var c = cloudNotes[k];
      var cText = '';
      var cU = 0;
      if (c && typeof c === 'object') { cText = typeof c.t === 'string' ? c.t : ''; cU = Number(c.u) || 0; }
      else if (typeof c === 'string') { cText = c; cU = 0; }
      var text, u;
      if (!cText && !lText) return; // clé vide des deux côtés → ignorée
      if (cU > lU) { text = cText; u = cU; }
      else if (lU > cU) { text = lText; u = lU; }
      else { text = (lText.length >= cText.length ? lText : cText); u = lU || cU; }
      notes[k] = text; meta[k] = u;
      if (text !== lText || !localMeta[k]) changed = true;
    });
    return { notes: notes, meta: meta, changed: changed };
  }

  // Fusion activité quotidienne : maximum par jour
  function mergeActivity(localAct, cloudAct) {
    localAct = localAct && typeof localAct === 'object' ? localAct : {};
    cloudAct = cloudAct && typeof cloudAct === 'object' ? cloudAct : {};
    var out = {}, changed = false;
    Object.keys(localAct).forEach(function (d) { out[d] = Number(localAct[d]) || 0; });
    Object.keys(cloudAct).forEach(function (d) {
      var c = Number(cloudAct[d]) || 0;
      if (c > (out[d] || 0)) { out[d] = c; changed = true; }
      else if (!(d in out)) { out[d] = c; }
    });
    return { activity: out, changed: changed };
  }

  /*
    CALCUL DE PROGRESSION (le « calcul de section et de la progression »
    demandé par le propriétaire) — à partir des sections lues + du fichier
    officiel de totaux (progress-totals.json).
  */
  function computeStats(readArr, totals) {
    readArr = Array.isArray(readArr) ? readArr : [];
    var per = Object.create(null); // subject → Set chapitres touchés + nb sections
    var sectionsRead = 0;
    var perChapterRead = Object.create(null); // subject → {chIdx: count}
    readArr.forEach(function (k) {
      var p = parseKey(k);
      if (!p) return;
      if (!per[p.subject]) per[p.subject] = Object.create(null);
      var s = per[p.subject];
      if (!s[p.chapter]) { s[p.chapter] = new Set(); }
      var sig = p.tab + '_' + p.part;
      if (!s[p.chapter].has(sig)) {
        s[p.chapter].add(sig);
        sectionsRead++;
        if (!perChapterRead[p.subject]) perChapterRead[p.subject] = Object.create(null);
        perChapterRead[p.subject][p.chapter] = (perChapterRead[p.subject][p.chapter] || 0) + 1;
      }
    });

    var subjects = {};
    var sectionsTotal = 0, chaptersTotal = 0, chaptersRead = 0;
    var perSubject = {}, perChapter = {};
    if (totals && totals.subjects) {
      Object.keys(totals.subjects).forEach(function (sj) {
        var st = totals.subjects[sj];
        var read = 0;
        var chRead = 0;
        var chMap = {};
        (st.chapters || []).forEach(function (ch) {
          var r = (perChapterRead[sj] && perChapterRead[sj][String(ch.i)]) || 0;
          chMap[String(ch.i)] = { read: Math.min(r, ch.total), total: ch.total };
          read += Math.min(r, ch.total);
          if (r > 0) chRead++;
        });
        var tot = st.sectionsTotal || 0;
        perSubject[sj] = {
          sectionsRead: read,
          sectionsTotal: tot,
          chaptersRead: chRead,
          chaptersTotal: st.chaptersCount || 0,
          percent: tot > 0 ? Math.round((read / tot) * 100) : 0
        };
        perChapter[sj] = chMap;
        sectionsTotal += tot;
        chaptersTotal += (st.chaptersCount || 0);
        chaptersRead += chRead;
        subjects[sj] = true;
      });
    } else {
      // Totals indisponibles (hors-ligne avant 1ʳᵉ charge) : compter ce qu'on peut
      Object.keys(perChapterRead).forEach(function (sj) {
        var chMap = {}, chRead = 0, read = 0;
        Object.keys(perChapterRead[sj]).forEach(function (c) { chMap[c] = { read: perChapterRead[sj][c], total: 0 }; read += perChapterRead[sj][c]; chRead++; });
        perChapter[sj] = chMap;
        perSubject[sj] = { sectionsRead: read, sectionsTotal: 0, chaptersRead: chRead, chaptersTotal: 0, percent: 0 };
        sectionsRead = Math.max(sectionsRead, read);
      });
    }

    return {
      sectionsRead: sectionsRead,
      sectionsTotal: sectionsTotal,
      percent: sectionsTotal > 0 ? Math.round((sectionsRead / sectionsTotal) * 100) : 0,
      chaptersRead: chaptersRead,
      chaptersTotal: chaptersTotal,
      perSubject: perSubject,
      perChapter: perChapter,
      updatedAtMs: null
    };
  }

  // Ajuste le snapshot quotidien de l'accueil quand des sections lues AVANT
  // aujourd'hui arrivent d'un autre appareil (sinon « aujourd'hui » gonfle à tort)
  function adjustSnapForMerge(snapObj, addedCount, today) {
    if (!addedCount) return null;
    snapObj = snapObj && typeof snapObj === 'object' ? snapObj : {};
    var days = Object.keys(snapObj).filter(function (d) { return d < today; }).sort();
    if (!days.length) return null;
    var last = days[days.length - 1];
    snapObj[last] = (Number(snapObj[last]) || 0) + addedCount;
    return snapObj;
  }

  var CORE = {
    dayStr: dayStr, parseKey: parseKey, mergeReadParts: mergeReadParts,
    mergeNotes: mergeNotes, mergeActivity: mergeActivity,
    computeStats: computeStats, adjustSnapForMerge: adjustSnapForMerge,
    KEYS: { READ: K_READ, NOTES: K_NOTES, NOTES_META: K_NOTES_META, ACT: K_ACT, SNAP: K_SNAP, OWNER: K_OWNER, ACTIVE: K_ACTIVE, STASH_PFX: STASH_PFX }
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = CORE; return; }

  // ─────────────────────────────────────────────────────────────
  // CÂBLAGE NAVIGATEUR
  // ─────────────────────────────────────────────────────────────
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyDHscOXw3rLuhV6z1Cny-bdYCumqpnG7QE",
    authDomain: "arvexa-fbf10.firebaseapp.com",
    projectId: "arvexa-fbf10",
    storageBucket: "arvexa-fbf10.firebasestorage.app",
    messagingSenderId: "920108330053",
    appId: "1:920108330053:web:f532d71cbc2c824bc7472c"
  };
  var SDK = 'https://www.gstatic.com/firebasejs/12.12.1/';

  var LS = {
    get: function (k, d) {
      try { var v = root.localStorage.getItem(k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  var state = {
    uid: null, app: null, fs: null, authMod: null, fsMod: null,
    totals: null, totalsPromise: null, hasCloudDoc: false, authAttached: false,
    knownRead: Object.create(null),     // sections déjà connues du cloud/local (anti double arrayUnion)
    pushTimer: null, pushInFlight: false, pushQueued: false, pushFailed: false,
    lastStats: null, booted: false, lastLoginPushMs: 0,
    pendingAdoption: false, legacyPending: null  // ✅ v1.2 coffre de l'appareil
  };

  function stashKey(uid, suffix) { return STASH_PFX + uid + suffix; }

  function saveStash(uid) {
    if (!uid) return;
    LS.set(stashKey(uid, '_read'), LS.get(K_READ, []));
    LS.set(stashKey(uid, '_notes'), LS.get(K_NOTES, {}));
    LS.set(stashKey(uid, '_meta'), LS.get(K_NOTES_META, {}));
    LS.set(stashKey(uid, '_act'), LS.get(K_ACT, {}));
  }

  // Restaure le stash du compte ; false si aucun stash (1ʳᵉ fois sur l'appareil)
  function restoreStash(uid) {
    var s = LS.get(stashKey(uid, '_read'), null);
    if (s === null) return false;
    LS.set(K_READ, Array.isArray(s) ? s : []);
    LS.set(K_NOTES, LS.get(stashKey(uid, '_notes'), {}));
    LS.set(K_NOTES_META, LS.get(stashKey(uid, '_meta'), {}));
    LS.set(K_ACT, LS.get(stashKey(uid, '_act'), {}));
    return true;
  }

  // v1.1 — reset COMPLET des clés de progression « live » : plus la snapshot
  // de l'accueil (session + persist) qui survivait au changement de compte.
  function resetLive() {
    LS.set(K_READ, []);
    LS.set(K_NOTES, {});
    LS.set(K_NOTES_META, {});
    LS.set(K_ACT, {});
    LS.set(K_SNAP, {});
    try { root.localStorage.removeItem('arvexa_index_snapshot_persist'); } catch (e) {}
    try { root.sessionStorage.removeItem('arvexa_index_snapshot'); } catch (e) {}
  }

  // ── ✅ v1.2 — COFFRE DE L'APPAREIL + CONFIRMATION UNIQUE ──────────
  // La sync v8.0 n'a jamais tourné : les progressions des élèves actuels
  // ne vivent qu'en local. Quand un compte entrant trouve des données
  // locales qui ne sont PAS les siennes (pas de stash, pas de session
  // connue), elles sont mises au coffre PUIS proposées — jamais mélangées
  // sans accord. Le coffre reste disponible pour un autre compte.

  // Snapshot des clés live ; null si tout est vide (rien à protéger)
  function snapshotLive() {
    var read = LS.get(K_READ, []);
    var notes = LS.get(K_NOTES, {});
    var act = LS.get(K_ACT, {});
    var hasRead = Array.isArray(read) && read.length > 0;
    var hasNotes = notes && typeof notes === 'object' && Object.keys(notes).length > 0;
    var hasAct = act && typeof act === 'object' && Object.keys(act).length > 0;
    if (!hasRead && !hasNotes && !hasAct) return null;
    return {
      read: hasRead ? read : [],
      notes: hasNotes ? notes : {},
      meta: LS.get(K_NOTES_META, {}),
      act: hasAct ? act : {},
      snap: LS.get(K_SNAP, {})
    };
  }

  // Archive un snapshot dans le coffre (conserve les refus existants)
  function archiveToSlot(snapObj, freshRejections) {
    if (!snapObj) return;
    var prev = LS.get(K_LEGACY, null);
    LS.set(K_LEGACY, {
      read: snapObj.read || [], notes: snapObj.notes || {},
      meta: snapObj.meta || {}, act: snapObj.act || {}, snap: snapObj.snap || {},
      at: Date.now(),
      rejectedBy: freshRejections ? [] : ((prev && prev.rejectedBy) || [])
    });
  }

  function restoreSnapshot(s) {
    if (!s) return;
    LS.set(K_READ, Array.isArray(s.read) ? s.read : []);
    LS.set(K_NOTES, s.notes || {});
    LS.set(K_NOTES_META, s.meta || {});
    LS.set(K_ACT, s.act || {});
    LS.set(K_SNAP, s.snap || {});
  }

  /* Demande unique : « ces données sont-elles les tiennes ? »
     Résout true (garder) / false (à zéro). Repli sûr hors modale : false
     (isolation d'abord — le coffre reste disponible pour un autre compte). */
  function askLegacy(uid) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(keep) {
        if (done) return;
        done = true;
        LS.set(K_ASKED + uid, true); // une seule question par compte
        resolve(keep);
      }
      try {
        if (typeof window === 'undefined' || typeof window.arvexaConfirm !== 'function') { finish(false); return; }
        window.arvexaConfirm({
          title: 'Progression trouvée',
          message: "Des données de progression existent déjà sur cet appareil. Sont-elles <strong>les tiennes</strong> ? « Garder » les transfère dans ce compte. « Non » démarre ce compte à zéro — elles restent récupérables par un autre compte de cet appareil.",
          icon: '☁️',
          confirmText: 'Oui, garder',
          cancelText: 'Non, à zéro',
          variant: 'primary',
          onConfirm: function () { finish(true); },
          onCancel: function () { finish(false); }
        });
      } catch (e) { finish(false); }
    });
  }

  /* Arbitrage v1.2 (dans syncDown, compte entrant sans données cloud) :
     candidate = legacyPending (live inattendu) OU coffre de l'appareil.
     → confirmation unique ; Oui = adoption + upload ; Non = coffre gardé,
       compte à zéro. Renvoie true si l'arbitrage a TOUT pris en charge
       (le merge normal est court-circuité). */
  function arbitrateLegacy(myUid, snapExists, cloudEmpty) {
    var candidate = state.legacyPending || null;
    state.legacyPending = null;
    var slot = LS.get(K_LEGACY, null);
    var slotUsable = !!(slot && Array.isArray(slot.read) && slot.read.length &&
                        (slot.rejectedBy || []).indexOf(myUid) === -1);
    if (candidate) archiveToSlot(candidate, false);   // le live inattendu rejoint le coffre
    var usable = !!candidate || slotUsable;

    // Compte déjà peuplé côté cloud → le cloud fait foi, jamais de question
    if (snapExists && !cloudEmpty) return Promise.resolve(false);
    if (!usable) return Promise.resolve(false);
    if (LS.get(K_ASKED + myUid, false)) return Promise.resolve(false); // déjà interrogé

    return askLegacy(myUid).then(function (keep) {
      if (state.uid !== myUid) return true; // compte changé pendant la question
      if (keep) {
        restoreSnapshot(candidate || slot);
        LS.set(K_LEGACY, { read: [], notes: {}, meta: {}, act: {}, snap: {}, at: Date.now(), rejectedBy: [] }); // coffre vidé (revendiqué)
        push({ full: true }).then(function () {
          emit({ phase: 'synced', merged: true, adopted: true, stats: state.lastStats });
        });
      } else {
        var s2 = LS.get(K_LEGACY, null);
        var rej = s2 && s2.rejectedBy ? s2.rejectedBy : [];
        if (rej.indexOf(myUid) === -1) rej.push(myUid);
        if (rej.length >= 3) { // 3 refus = données ambiguës → on nettoie
          LS.set(K_LEGACY, { read: [], notes: {}, meta: {}, act: {}, snap: {}, at: Date.now(), rejectedBy: [] });
        } else {
          LS.set(K_LEGACY, { read: (s2 && s2.read) || [], notes: (s2 && s2.notes) || {}, meta: (s2 && s2.meta) || {}, act: (s2 && s2.act) || {}, snap: (s2 && s2.snap) || {}, at: (s2 && s2.at) || Date.now(), rejectedBy: rej });
        }
        push({ full: true }).then(function () {
          emit({ phase: 'synced', merged: false, adopted: false });
        });
      }
      return true;
    });
  }

  function emit(detail) {
    try { root.dispatchEvent(new CustomEvent('arvexa-progress-updated', { detail: detail || {} })); }
    catch (e) { /* vieux navigateurs */ }
  }

  // ── Totaux (fichier généré, précaché par le SW → dispo hors-ligne) ──
  function loadTotals() {
    if (state.totals) return Promise.resolve(state.totals);
    if (!state.totalsPromise) {
      state.totalsPromise = fetch('./progress-totals.json', { cache: 'default' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { state.totals = j; return j; })
        .catch(function () { return null; });
    }
    return state.totalsPromise;
  }

  // ── Firebase (paresseux — APRÈS le load pour ne pas devancer les modules
  //    des pages qui appellent initializeFirestore avec un cache persistant) ──
  var fbPromise = null;
  function fb() {
    if (fbPromise) return fbPromise;
    fbPromise = Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js')
    ]).then(function (mods) {
      var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
      var app = null;
      try { app = appMod.getApps().find(function (a) { return a.name === '[DEFAULT]'; }) || null; } catch (e) {}
      if (!app) app = appMod.initializeApp(FIREBASE_CONFIG);
      state.app = app; state.authMod = authMod; state.fsMod = fsMod;
      // ✅ v1.1 — BUG BLOQUANT CORRIGÉ : « authMod » manquait dans l'objet
      // renvoyé → attachAuth() plantait sur r.authMod.onAuthStateChanged
      // (TypeError silencieux) → AUCUN handleLogin n'a jamais tourné en
      // production : ni synchronisation, ni purge de données entre comptes.
      // C'est la cause racine de la fuite de progression signalée.
      return { app: app, auth: authMod.getAuth(app), fsMod: fsMod, authMod: authMod };
    }).catch(function (e) {
      fbPromise = null; // permettra de re-tenter (réseau)
      throw e;
    });
    return fbPromise;
  }

  function cloudRef() {
    if (!state.uid || !state.fsMod || !state.app) return null;
    try {
      var db = state.fsMod.getFirestore(state.app);
      return state.fsMod.doc(db, 'users', state.uid, 'progression', 'course');
    } catch (e) { return null; }
  }

  // ── ÉCRITURE (concurrente-sûre : merge + arrayUnion + champs par clé) ──
  // v1.1 : garde anti-course — si le compte actif change pendant le
  // aller-retour réseau, l'écriture est ANNULÉE (aucun croisement).
  function buildCloudNotes() {
    var notes = LS.get(K_NOTES, {});
    var meta = LS.get(K_NOTES_META, {});
    var out = {};
    Object.keys(notes).forEach(function (k) {
      var t = typeof notes[k] === 'string' ? notes[k] : '';
      if (!t) return;
      if (t.length > MAX_NOTE_LEN) t = t.slice(0, MAX_NOTE_LEN);
      out[k] = { t: t, u: Number(meta[k]) || Date.now() };
    });
    return out;
  }

  function push(opts) {
    opts = opts || {};
    if (!state.uid) return Promise.resolve(false);
    if (state.pushInFlight) { state.pushQueued = true; return Promise.resolve(false); }
    state.pushInFlight = true;
    var myUid = state.uid;             // ✅ v1.1 anti-course
    var ref = cloudRef();
    if (!ref) { state.pushInFlight = false; return Promise.resolve(false); }

    return loadTotals().then(function (totals) {
      if (state.uid !== myUid) return false; // compte changé → on n'écrit RIEN
      var read = LS.get(K_READ, []);
      // nouvelles clés uniquement (arrayUnion) — sauf adoption initiale (full)
      var newKeys = opts.full ? read.slice() : read.filter(function (k) { return !state.knownRead[k]; });
      state.knownRead = Object.create(null);
      read.forEach(function (k) { state.knownRead[k] = 1; });

      var data = {
        notes: buildCloudNotes(),
        dailyActivity: LS.get(K_ACT, {}),
        stats: computeStats(read, totals),
        syncedAtMs: Date.now(),
        updatedAt: state.fsMod.serverTimestamp()
      };
      // readParts : arrayUnion des SEULES nouvelles clés (concurrent-sûre) ;
      // en adoption initiale (full) → tableau complet, même vide (le doc
      // créé respecte la règle « readParts is list »).
      if (opts.full || !state.hasCloudDoc) {
        data.readParts = read;
      } else if (newKeys.length) {
        data.readParts = state.fsMod.arrayUnion.apply(null, newKeys);
      }

      var p = state.fsMod.setDoc(ref, data, { merge: true });
      return p.then(function () {
        state.pushFailed = false;
        saveStash(state.uid);
        state.lastStats = data.stats;
        emit({ phase: 'pushed', stats: data.stats });
        return true;
      });
    }).catch(function (e) {
      state.pushFailed = true; // re-tenté sur 'online' / prochaine action
      try { console.warn('[ArvexaSync] push différé:', e && (e.code || e.message)); } catch (e2) {}
      return false;
    }).then(function (ok) {
      state.pushInFlight = false;
      if (state.pushQueued && state.uid === myUid) { state.pushQueued = false; push(); }
      else if (state.pushQueued) { state.pushQueued = false; }
      return ok;
    });
  }

  // ── LECTURE + FUSION (à la connexion) ──
  // v1.1 : garde anti-course — un syncDown lancé pour le compte A et qui se
  // résout APRÈS un passage au compte B n'écrit plus les données de A en
  // local ni dans le doc de B (l'ancien garde « !state.uid » laissait passer).
  function syncDown() {
    var myUid = state.uid;             // ✅ v1.1 anti-course
    var ref = cloudRef();
    if (!ref) return Promise.resolve(false);
    return state.fsMod.getDoc(ref).then(function (snap) {
      if (!state.uid || state.uid !== myUid) return false; // compte changé/déco

      // ✅ v1.2 — arbitrage du coffre de l'appareil AVANT toute fusion :
      // un compte entrant sans données cloud réelles se voit PROPOSER les
      // données locales inattendues (jamais mélangées sans son accord).
      var cloudData = snap.exists() ? (snap.data() || {}) : null;
      var cloudEmpty = !cloudData || !(cloudData.readParts || []).length;
      if (state.pendingAdoption || LS.get(K_LEGACY, null)) {
        return arbitrateLegacy(myUid, !!snap.exists(), cloudEmpty)
          .then(function (handled) {
            if (handled) return true;
            if (state.uid !== myUid) return false;
            return finishSyncDown(myUid, snap);
          });
      }
      return finishSyncDown(myUid, snap);
    }).catch(function (e) {
      try { console.warn('[ArvexaSync] syncDown différé:', e && (e.code || e.message)); } catch (e2) {}
      emit({ phase: 'offline' });
      return false;
    });
  }

  // Fusion normale (exécutée après l'arbitrage éventuel) — même garde uid.
  function finishSyncDown(myUid, snap) {
    if (!state.uid || state.uid !== myUid) return Promise.resolve(false);
    var today = CORE.dayStr(new Date());
    var mergedSomething = false;

    if (snap.exists()) {
      state.hasCloudDoc = true;
      var cloud = snap.data() || {};

      // 1. sections lues (union)
      var localRead = LS.get(K_READ, []);
      var mergedRead = CORE.mergeReadParts(localRead, cloud.readParts);
      if (mergedRead.length !== localRead.length) {
        var added = mergedRead.length - localRead.length;
        var snapAdj = CORE.adjustSnapForMerge(LS.get(K_SNAP, {}), added, today);
        if (snapAdj) LS.set(K_SNAP, snapAdj);
        LS.set(K_READ, mergedRead);
        mergedSomething = true;
      }
      mergedRead.forEach(function (k) { state.knownRead[k] = 1; });

      // 2. notes (par clé, édition la plus récente gagne)
      var mn = CORE.mergeNotes(LS.get(K_NOTES, {}), LS.get(K_NOTES_META, {}), cloud.notes);
      if (mn.changed) {
        LS.set(K_NOTES, mn.notes);
        LS.set(K_NOTES_META, mn.meta);
        mergedSomething = true;
      }

      // 3. activité quotidienne (max par jour)
      var ma = CORE.mergeActivity(LS.get(K_ACT, {}), cloud.dailyActivity);
      if (ma.changed) { LS.set(K_ACT, ma.activity); mergedSomething = true; }
    }

    return push({ full: !snap.exists() || mergedSomething }).then(function () {
      emit({ phase: 'synced', merged: mergedSomething, stats: state.lastStats });
      return mergedSomething;
    });
  }

  // ── CYCLE DE VIE COMPTE ──
  // ✅ v1.1 — ISOLATION STRICTE (signalement propriétaire : un compte tout
  // neuf affichait la progression de l'autre compte). Règles :
  //   • le compte entrant a UN STASH (il est déjà venu sur cet appareil) →
  //     on restaure SON stash : c'est LE sien, jamais celui d'un autre ;
  //   • pas de stash et même compte (refresh) → le live est déjà le sien ;
  //   • pas de stash et compte DIFFÉRENT/inconnu → données locales VIDÉES
  //     (l'ancienne « adoption » v8.0 — qui transférait le local au nouveau
  //     compte — est supprimée : c'est elle qui faisait fuiter), puis
  //     syncDown() rapatrie UNIQUEMENT le doc cloud de CE compte.
  function handleLogin(user) {
    var uid = user.uid;
    var prevActive = LS.get(K_ACTIVE, null);
    var prevOwner = LS.get(K_OWNER, null);
    state.pendingAdoption = false;   // ✅ v1.2
    state.legacyPending = null;

    if (prevActive && prevActive !== uid) {
      saveStash(prevActive); // l'ancien compte actif repart dans son stash
    } else if (prevOwner && prevOwner !== uid && prevActive === uid) {
      saveStash(uid); // filet : live = owner sortant sans marque active
    }

    var sameAccount = (prevOwner === uid) || (prevActive === uid);
    var hadStash = restoreStash(uid); // SON stash s'il existe (multi-comptes)
    if (!hadStash && !sameAccount) {
      // ✅ v1.2 — compte inconnu sans stash : JAMAIS de données héritées
      // silencieusement. Le live inattendu part au COFFRE de l'appareil et
      // sera PROPOSÉ au compte entrant (confirmation unique) après lecture
      // de son document cloud (syncDown → arbitrateLegacy).
      state.legacyPending = snapshotLive();
      resetLive();
      state.pendingAdoption = true;
    }

    LS.set(K_OWNER, uid);
    LS.set(K_ACTIVE, uid);
    state.uid = uid;
    state.knownRead = Object.create(null);
    LS.get(K_READ, []).forEach(function (k) { state.knownRead[k] = 1; });

    emit({ phase: 'login', fresh: !sameAccount }); // les pages re-rendent avec les données du bon compte
    syncDown();
  }

  function handleLogout() {
    var prev = LS.get(K_ACTIVE, null);
    if (prev) saveStash(prev);
    LS.set(K_ACTIVE, null);
    state.uid = null;
    state.knownRead = Object.create(null);
    state.pendingAdoption = false; // ✅ v1.2
    state.legacyPending = null;
  }

  // ── API PUBLIQUE (lecture.html et les pages) ──
  function notifyChange(kind, key) {
    if (!state.uid) return; // non connecté : local seulement (comportement historique)
    saveStash(state.uid);
    if (kind === 'note') {
      if (state.pushTimer) clearTimeout(state.pushTimer);
      state.pushTimer = setTimeout(function () { state.pushTimer = null; push(); }, PUSH_DELAY_NOTES);
    } else {
      push(); // une section lue = write immédiat (léger : 1 clé en arrayUnion)
    }
  }

  function chapterTotal(subject, chapterIdx) {
    var t = state.totals;
    if (!t || !t.subjects || !t.subjects[subject]) return 0;
    var ch = (t.subjects[subject].chapters || [])[Number(chapterIdx)];
    return ch ? ch.total : 0;
  }

  function subjectTotals(subject) {
    var t = state.totals;
    if (!t || !t.subjects || !t.subjects[subject]) return null;
    return t.subjects[subject];
  }

  function getStats() { return state.lastStats; }

  // ── DÉMARRAGE (après 'load' : les modules des pages ont déjà fait
  //    initializeFirestore → getFirestore() renverra la même instance) ──
  function attachAuth() {
    return fb().then(function (r) {
      if (state.authAttached) return;
      state.authAttached = true;
      r.authMod.onAuthStateChanged(r.auth, function (user) {
        if (user) handleLogin(user);
        else handleLogout();
      });
    });
  }

  function boot() {
    if (state.booted) return;
    state.booted = true;
    loadTotals();
    attachAuth().catch(function (e) { /* hors-ligne au démarrage : local tel quel,
      attachAuth() est re-tenté à l'événement 'online' */
      try { console.warn('[ArvexaSync] attach auth différé:', e && (e.code || e.message || e)); } catch (e2) {}
    });

    root.addEventListener('online', function () {
      if (!state.authAttached) { attachAuth().catch(function () {}); return; }
      if (state.uid && state.pushFailed) push();
      else if (state.uid) syncDown();
    });
    root.addEventListener('offline', function () { state.pushFailed = true; });
    root.addEventListener('visibilitychange', function () {
      if (root.document.visibilityState === 'visible' && state.uid && state.pushFailed) push();
    });
  }

  root.ArvexaProgress = {
    notifyChange: notifyChange,
    chapterTotal: chapterTotal,
    subjectTotals: subjectTotals,
    getStats: getStats,
    loadTotals: loadTotals,
    version: '1.2'
  };

  if (root.document.readyState === 'complete') {
    setTimeout(boot, 0);
  } else {
    root.addEventListener('load', function () { setTimeout(boot, 0); });
  }
})(typeof self !== 'undefined' ? self : this);
