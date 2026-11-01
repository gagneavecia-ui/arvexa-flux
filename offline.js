// ================================================================
// OFFLINE.JS — ARVEXA School
// Version : v6.4 — Pastille d'arrière-plan REPLACÉE + STYLÉE, modale NON BLOQUANTE
// Nouveautés v6.4 (consigne du propriétaire : « le téléchargement en
//  arrière-plan n'est pas bien placé, 0 css — revois avec celui du profil ;
//  ça bloque trop pendant le téléchargement ») :
//  - BUG CSS RÉPARÉ : les styles v6.3 (pastille + pop-up) étaient PIÉGÉS
//    dans le @media (max-width: 480px) → pastille totalement SANS STYLE
//    (« 0 css ») sur grand écran. Styles désormais posés à TOUTES les tailles.
//  - PASTILLE REPLACÉE : bas-DROITE (elle couvrait le bouton menu en
//    haut-gauche → la page semblait bloquée) et se hisse AUTOMATIQUEMENT
//    AU-DESSUS de la bannière d'installation si celle-ci est visible.
//  - PASTILLE REDÉSIGNÉE « façon modale du profil » : carte sombre, liseré
//    et barre de progression dorés, icône, titre, %, info, bouton ✕ rond.
//  - MODALE DU PROFIL NON BLOQUANTE : bouton « Réduire » → le téléchargement
//    continue en arrière-plan (pastille), l'élève navigue normalement.
//  - SW : en mode arrière-plan 2 fichiers en parallèle (au lieu de 3) pour
//    que la navigation reste fluide pendant le téléchargement.
// v6.3 — Pop-up post-inscription + téléchargement EN ARRIÈRE-PLAN
// (consigne du propriétaire : « après inscription, un pop-up
//  propose de télécharger toutes les données en arrière-plan — il peut
//  naviguer tranquillement pendant que les données se téléchargent ») :
//  - Pop-up « Bienvenue sur ARVEXA » posé après INSCRIPTION (flag
//    arvexa_new_registration écrit par register.html) : bouton
//    « Télécharger en arrière-plan » ou « Plus tard », montré UNE SEULE
//    FOIS (choix persisté dans arvexa_bgdl_choice).
//  - Mode ARRIÈRE-PLAN : pastille compacte (barre de progression, %,
//    ✕ annuler) qui ne bloque PAS la navigation. Le job vit dans le
//    Service Worker et SURVIT aux changements de page : la pastille se
//    rattache sur la page suivante (DOWNLOAD_STATUS) et l'état
//    « prêt hors ligne » est posé même si la page d'origine a fermé.
//  - offline.js est désormais inclus sur onboarding/index/profil (il
//    n'était inclus NULLE PART : le bouton « Télécharger tout hors ligne »
//    du profil affichait toujours « module non chargé » — bug réparé).
// v6.2 — Offline instantané + téléchargement annulable
// Nouveautés v6.2 :
//  - Affichage INSTANTANÉ : les fichiers déjà en cache sont détectés sans
//    réseau (CHECK_CACHED) et jamais retéléchargés — 2e visite = quelques
//    secondes, l'ouverture des cours déjà téléchargés est immédiate.
//  - Bouton « Annuler » dans le pop-up de téléchargement (demande du
//    propriétaire) : coupe le téléchargement proprement à tout moment.
//  - État persistant « contenu prêt hors ligne » (arvexa_offline_ready).
//  - Bannière hors ligne SURIMPOSÉE (plus aucun décalage de mise en page)
//    + hystérésis 2,5 s : plus aucun clignotement quand le réseau 2G
//    tremble (cause d'instabilité signalée par le propriétaire).
// Corrections conservées :
//  - C1 : retrait des pages protégées de appPages (cohérence avec service-worker.js C2)
//  - C2 : console.warn sur catch silencieux (observabilité)
// ================================================================

(function () {
  'use strict';

  if (window.__arvexaOfflineInit) return;
  window.__arvexaOfflineInit = true;

  const STORAGE_KEY = 'arvexa_pending_sync';
  const READY_KEY = 'arvexa_offline_ready';
  const OFFLINE_HYSTERESIS_MS = 2500;

  let isOnline = navigator.onLine;
  let offlineSince = null;      // ✅ v6.2 — hystérésis anti-clignotement
  let offlineTimer = null;
  let pendingSync = [];
  let bannerEl = null;
  let modalEl = null;
  let downloadCancelled = false;

  // ✅ v6.3 — téléchargement EN ARRIÈRE-PLAN + pop-up post-inscription
  let downloadMode = 'modal';   // 'modal' (bouton profil) | 'bg' (arrière-plan)
  let bgPillEl = null;          // pastille compacte non bloquante
  let bgPollTimer = null;       // polling DOWNLOAD_STATUS (re-rattachement)
  let lastProgressData = null;  // ✅ v6.4 — dernière progression (bouton « Réduire »)
  let bgPillOffsetTimer = null; // ✅ v6.4 — suivi de la bannière d'installation
  const NEWREG_KEY = 'arvexa_new_registration';
  const BGDL_CHOICE_KEY = 'arvexa_bgdl_choice';

  // ═══ ÉTAT « CONTENU PRÊT HORS LIGNE » ═══
  function markOfflineReady(stats) {
    try {
      localStorage.setItem(READY_KEY, JSON.stringify(Object.assign({ ts: Date.now() }, stats || {})));
    } catch (e) {}
  }

  function isOfflineReady() {
    try { return !!localStorage.getItem(READY_KEY); } catch (e) { return false; }
  }

  // ═══ MÉMOIRE DES 404 (v6.2) ═══
  // Les parties sans PDF / sans corrections renvoient 404 de façon STABLE.
  // On les mémorise (TTL 7 jours) pour que la vérification du 2e passage ne
  // re-interroge plus 1 200 fichiers fantômes → chemins réellement instantanés.
  const MISSING_KEY = 'arvexa_offline_missing';
  const MISSING_TTL = 7 * 24 * 60 * 60 * 1000;

  function loadKnownMissing() {
    try {
      const raw = JSON.parse(localStorage.getItem(MISSING_KEY) || 'null');
      if (raw && Array.isArray(raw.files) && (Date.now() - (raw.ts || 0)) < MISSING_TTL) {
        return new Set(raw.files);
      }
    } catch (e) {}
    return new Set();
  }

  function saveKnownMissing(files) {
    try {
      // Fonctionne en ajout : on conserve les 404 déjà connus (même TTL remis à zéro)
      const prev = loadKnownMissing();
      files.forEach((f) => prev.add(f));
      const arr = Array.from(prev).slice(-4000); // garde-fou de taille
      localStorage.setItem(MISSING_KEY, JSON.stringify({ ts: Date.now(), files: arr }));
    } catch (e) {}
  }

  // ═══ DONNÉES EN ATTENTE ═══
  function loadPendingData() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      pendingSync = data ? JSON.parse(data) : [];
    } catch (e) {
      pendingSync = [];
    }
  }

  function savePendingData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingSync));
    } catch (e) {}
  }

  // ═══ BANNIÈRE ═══
  function createBanner() {
    if (bannerEl) return bannerEl;

    bannerEl = document.createElement('div');
    bannerEl.id = 'arvexaOfflineBanner';
    bannerEl.className = 'arvexa-offline-banner';
    bannerEl.innerHTML = `
      <span class="arvexa-offline-dot"></span>
      <span class="arvexa-offline-text">
        Mode hors ligne — contenu en cache uniquement
      </span>
      <button class="arvexa-offline-retry" type="button" aria-label="Réessayer">
        <i class="fas fa-rotate-right"></i>
      </button>
    `;

    const header = document.querySelector('.header, .site-header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(bannerEl, header.nextSibling);
    } else {
      document.body.insertBefore(bannerEl, document.body.firstChild);
    }

    bannerEl.querySelector('.arvexa-offline-retry')
      .addEventListener('click', () => window.location.reload());

    return bannerEl;
  }

  // ═══ UI ═══
  // ✅ v6.2 — la bannière ne s'affiche qu'après 2,5 s de coupure CONTINUE
  // (hystérésis) : les micro-coupures 2G ne font plus apparaître/disparaître
  // le bandeau et ne font plus bouger la mise en page.
  function updateUI() {
    const stableOffline = !isOnline && offlineSince !== null &&
      (Date.now() - offlineSince) >= OFFLINE_HYSTERESIS_MS;
    if (bannerEl) {
      bannerEl.classList.toggle('show', stableOffline);
    }
    document.documentElement.setAttribute(
      'data-online',
      isOnline ? 'true' : 'false'
    );
  }

  // ═══ TOAST ═══
  function showToast(message, type = 'info') {
    if (typeof window.arvexaShowToast === 'function') {
      window.arvexaShowToast(message, type);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `arvexa-offline-toast ${type} show`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('show');
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ═══ ÉVÉNEMENTS RÉSEAU ═══
  function bindNetworkEvents() {
    window.addEventListener('online', () => {
      isOnline = true;
      offlineSince = null;
      if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }
      updateUI();
      showToast('✅ Connexion rétablie', 'success');
      setTimeout(syncPendingData, 500);
    });

    window.addEventListener('offline', () => {
      isOnline = false;
      if (offlineSince === null) offlineSince = Date.now();
      if (offlineTimer) clearTimeout(offlineTimer);
      // Hystérésis : la bannière ne monte que si toujours hors ligne après 2,5 s
      offlineTimer = setTimeout(() => {
        offlineTimer = null;
        if (!navigator.onLine) updateUI();
      }, OFFLINE_HYSTERESIS_MS);
      updateUI();
    });
  }

  // ═══ SYNCHRONISATION ═══
  async function syncPendingData() {
    loadPendingData();
    if (pendingSync.length === 0) return;

    const items = [...pendingSync];
    const failed = [];

    for (const item of items) {
      try {
        const success = await trySyncItem(item);
        if (!success) failed.push(item);
      } catch (e) {
        // ✅ C2 — warn
        console.warn('[Offline] sync item failed:', e.message);
        failed.push(item);
      }
    }

    pendingSync = failed;
    savePendingData();

    const successCount = items.length - failed.length;
    if (successCount > 0) {
      showToast(
        `✅ ${successCount} élément${successCount > 1 ? 's' : ''} synchronisé${successCount > 1 ? 's' : ''}`,
        'success'
      );
    }
  }

  async function trySyncItem(item) {
    if (!window.__arvexaSync) return false;
    try {
      return await window.__arvexaSync(item);
    } catch (e) {
      // ✅ C2 — warn
      console.warn('[Offline] __arvexaSync error:', e.message);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TÉLÉCHARGEMENT COMPLET (appli + cours)
  // ═══════════════════════════════════════════════════════════════
  async function downloadAllForOffline(backgroundMode) {
    downloadCancelled = false;

    // ✅ v6.3 — même pipeline de fichiers, deux affichages : modale
    // bloquante (bouton du profil) ou pastille d'arrière-plan (pop-up
    // post-inscription — l'élève navigue pendant le téléchargement).
    downloadMode = backgroundMode ? 'bg' : 'modal';

    if (!isOnline) {
      showToast('📶 Connecte-toi pour télécharger', 'error');
      return;
    }

    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      showToast('⚠️ Service Worker non prêt, recharge la page', 'error');
      return;
    }

    showToast('🔍 Recherche du contenu disponible...', 'info');

    try {
      // ═══ ÉTAPE 1 : pages de l'application ═══
      // ✅ C1 — UNIQUEMENT les pages PUBLIQUES.
      // Les pages protégées sont exclues pour éviter le flash de contenu protégé
      // et pour rester cohérent avec la liste PROTECTED_PAGES du Service Worker.
      const appPages = [
        'index.html',
        'outils.html',
        'conditions.html',
        'confidentialite.html',
        '404.html'
      ];

      // ✅ v5.4 — assets du LECTEUR : sans eux, la lecture hors ligne d'un
      // PDF fraîchement téléchargé échoue si le lecteur n'a jamais encore
      // été ouvert en ligne (pdf.js n'est plus précaché à l'install depuis v5.3).
      const readerAssets = [
        'assets/pdfjs/pdf.min.js',
        'assets/pdfjs/pdf.worker.min.js',
        'katex-utils.js',
        'katex/katex.min.css',
        'katex/katex.min.js',
        'katex/contrib/auto-render.min.js'
      ];

      // ═══ ÉTAPE 2 : contenu des cours via JSON ═══
      const subjectFiles = [
        'cours/mathematiques.json',
        'cours/physique.json',
        'cours/chimie.json',
        'cours/svt.json'
      ];

      const candidateFiles = new Set();
      const validJsonFiles = [];

      for (const jsonFile of subjectFiles) {
        try {
          const res = await fetch(jsonFile);
          if (!res.ok) continue;
          validJsonFiles.push(jsonFile);

          const data = await res.json();
          (data.chapters || []).forEach((ch) => {
            ['cours', 'exercices', 'corrections'].forEach((section) => {
              (ch[section] || []).forEach((part) => {
                if (part.file) candidateFiles.add(part.file);
              });
            });
          });
        } catch (e) {
          // Matière absente → ignorer
          // ✅ C2 — warn (mais silencieux si 404)
          if (e.name !== 'SyntaxError') {
            console.warn('[Offline] fetch ' + jsonFile + ':', e.message);
          }
        }
      }

      // ✅ v5.4 — le lecteur affiche les parties de cours en PDF : dériver
      // le jumeau .pdf de chaque fichier .html de cours (même chemin).
      // Les éventuels 404 (parties sans PDF) sont éliminés par la
      // vérification HEAD ci-dessous — aucune erreur visible pour l'élève.
      Array.from(candidateFiles).forEach((f) => {
        if (/^cours\/.+\.html$/i.test(f)) candidateFiles.add(f.replace(/\.html$/i, '.pdf'));
      });

      // ═══ ÉTAPE 2b : v6.2 — ce qui est DÉJÀ en cache est éliminé SANS
      // réseau (CHECK_CACHED côté SW). 2e visite = vérification instantanée,
      // rien n'est retéléchargé (fini « il faut que je les retélécharge »).
      // Les manifestes JSON des matières sont inclus : s'ils sont déjà en
      // cache, le passage suivant est 100 % instantané (aucune modale).
      const allCandidatesSet = new Set([
        ...subjectFiles,
        ...appPages,
        ...readerAssets,
        ...Array.from(candidateFiles)
      ]);

      let alreadyCached = new Set();
      try {
        alreadyCached = await new Promise((resolve) => {
          if (!navigator.serviceWorker.controller) { resolve(new Set()); return; }
          const ch = new MessageChannel();
          // ✅ v6.2 — 12 s : la vérification peut demander quelques secondes
          // sur un téléphone lent avec ~1 400 candidats (mesuré : ~2 s).
          const timeout = setTimeout(() => resolve(new Set()), 12000);
          ch.port1.onmessage = (ev) => {
            const d = ev.data || {};
            if (d.type === 'CHECK_CACHED_RESULT') {
              clearTimeout(timeout);
              resolve(new Set(d.cached || []));
            }
          };
          navigator.serviceWorker.controller.postMessage(
            { type: 'CHECK_CACHED', files: Array.from(allCandidatesSet) },
            [ch.port2]
          );
        });
      } catch (e) {
        alreadyCached = new Set();
      }

      // Fichiers déjà prêts : on ne les vérifie même pas en HEAD (0 réseau).
      // ✅ v6.2 — les 404 CONNUS (parties sans PDF/corrections, stables) sont
      // mémorisés localement : les passages suivants ne les re-interrogent
      // plus → la vérification complète devient quasi instantanée.
      const knownMissing = loadKnownMissing();
      const toVerify = Array.from(allCandidatesSet).filter((f) =>
        !alreadyCached.has(f) && !knownMissing.has(f));

      // Si TOUT est déjà en cache (ou ne peut exister) : affichage instantané
      if (toVerify.length === 0 && allCandidatesSet.size > 0) {
        const cachedJson = subjectFiles.every((j) => alreadyCached.has(j));
        markOfflineReady({ total: alreadyCached.size, failed: 0, instant: true });
        showToast('✅ Tout le contenu est déjà prêt hors ligne', 'success');
        if (cachedJson) {
          // Mise à jour du bouton profil s'il existe
          const txt = document.getElementById('downloadOfflineText');
          if (txt) txt.textContent = 'Contenu prêt hors ligne ✅';
        }
        return;
      }

      // ═══ ÉTAPE 3 : vérifier ce qui existe (uniquement les manquants) ═══
      showToast('🔍 Vérification des fichiers...', 'info');

      const existingFiles = [];
      const missingNow = [];
      const BATCH = 25;

      for (let i = 0; i < toVerify.length; i += BATCH) {
        if (downloadCancelled) break;
        const batch = toVerify.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(async (file) => {
            try {
              const check = await fetch(file, { method: 'HEAD' });
              return check.ok ? file : null;
            } catch (e) {
              return null;
            }
          })
        );
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled' && r.value) existingFiles.push(r.value);
          else missingNow.push(batch[idx]);
        });
      }

      // ✅ v6.2 — mémoire des 404 : la prochaine vérification sera instantanée
      if (missingNow.length > 0) saveKnownMissing(missingNow);

      if (existingFiles.length === 0 && alreadyCached.size === 0) {
        showToast('ℹ️ Aucun fichier disponible pour le moment', 'info');
        return;
      }

      // ✅ v6.2 — RIEN de nouveau à télécharger (tout ce qui existe est déjà
      // sur l'appareil, le reste est 404 stable) : succès instantané, sans
      // modale ni « téléchargement » fantôme à 0 fichier.
      const pendingJson = validJsonFiles.filter((j) => !alreadyCached.has(j));
      if (existingFiles.length === 0 && pendingJson.length === 0) {
        markOfflineReady({ total: alreadyCached.size, failed: 0, instant: true });
        showToast('✅ Tout le contenu est déjà prêt hors ligne', 'success');
        const txt = document.getElementById('downloadOfflineText');
        if (txt) txt.textContent = 'Contenu prêt hors ligne ✅';
        return;
      }

      // ═══ ÉTAPE 4 : télécharger UNIQUEMENT ce qui manque ═══
      // Les manifestes JSON des matières sont toujours nécessaires (sans eux,
      // la liste des cours ne s'affiche pas hors ligne).
      const allFiles = [...pendingJson, ...existingFiles];

      // ✅ v6.4 — état initial mémorisé : « Réduire » peut basculer vers la
      // pastille dès la 1ʳᵉ seconde, avant le premier DOWNLOAD_PROGRESS.
      lastProgressData = {
        done: 0, failed: 0, skipped: alreadyCached.size,
        total: alreadyCached.size + allFiles.length, percent: 0
      };
      openDownloadUI(alreadyCached.size + allFiles.length, alreadyCached.size);

      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        const data = event.data;
        if (data.type === 'DOWNLOAD_PROGRESS') {
          updateDownloadProgress(data);
        } else if (data.type === 'DOWNLOAD_COMPLETE') {
          // ✅ v5.4 — le nombre d'échecs réel est transmis (avant : forcé à 0)
          completeDownload({
            done: data.done || 0,
            failed: data.failed || 0,
            skipped: data.skipped || 0,
            total: data.total || (data.done || 0)
          });
        } else if (data.type === 'DOWNLOAD_CANCELLED') {
          // ✅ v6.2 — téléchargement annulé par l'élève
          handleDownloadCancelled(data || {});
        } else if (data.type === 'DOWNLOAD_ERROR') {
          // ✅ C2 — gestion de l'erreur SW (offline ou autre)
          showToast(data.message || 'Erreur de téléchargement', 'error');
          closeDownloadModal();
          hideBgPill();
        }
      };

      // ✅ v6.4 — background:true → le SW télécharge à 2 fichiers en
      // parallèle (au lieu de 3) : la navigation de l'élève reste fluide.
      navigator.serviceWorker.controller.postMessage(
        { type: 'DOWNLOAD_ALL', files: allFiles, background: downloadMode === 'bg' },
        [channel.port2]
      );

    } catch (error) {
      console.error(error);
      showToast('❌ Erreur: ' + error.message, 'error');
      closeDownloadModal();
    }
  }

  // ═══ MODALE DE PROGRESSION ═══
  // ✅ v6.2 — bouton « Annuler » visible pendant tout le téléchargement
  // (demande du propriétaire) + comptage des fichiers déjà en cache.
  function openDownloadModal(total, alreadyCached) {
    if (modalEl) return;

    const cachedNote = (alreadyCached || 0) > 0
      ? `<span style="color:#3AB67E">✔ ${alreadyCached} déjà prêt${alreadyCached > 1 ? 's' : ''} sur l'appareil</span>`
      : '';

    modalEl = document.createElement('div');
    modalEl.className = 'arvexa-download-overlay';
    modalEl.innerHTML = `
      <div class="arvexa-download-modal">
        <div class="arvexa-download-icon">
          <i class="fas fa-cloud-arrow-down"></i>
        </div>
        <h3 class="arvexa-download-title">Téléchargement hors ligne</h3>
        <p class="arvexa-download-sub">
          Téléchargement du contenu pour accès hors ligne...<br>${cachedNote}
        </p>

        <div class="arvexa-download-progress">
          <div class="arvexa-download-bar">
            <div class="arvexa-download-fill" id="arvexaDlFill"></div>
          </div>
          <div class="arvexa-download-stats">
            <span id="arvexaDlDone">0</span> / <span id="arvexaDlTotal">${total}</span>
            <span id="arvexaDlPercent">0%</span>
          </div>
        </div>

        <div class="arvexa-download-info" id="arvexaDlInfo">
          Préparation...
        </div>

        <div class="arvexa-download-actions">
          <button class="arvexa-download-cancel" id="arvexaDlCancel" type="button">
            Annuler
          </button>
          <button class="arvexa-download-min" id="arvexaDlMin" type="button" title="Le téléchargement continue en arrière-plan pendant que tu navigues">
            Réduire
          </button>
          <button class="arvexa-download-close" id="arvexaDlClose" style="display:none">
            Fermer
          </button>
        </div>
        <div class="arvexa-download-hint">💡 Réduis la fenêtre ou change de page : le téléchargement continue tout seul en arrière-plan.</div>
      </div>
    `;

    document.body.appendChild(modalEl);
    document.getElementById('arvexaDlClose').addEventListener('click', closeDownloadModal);
    document.getElementById('arvexaDlCancel').addEventListener('click', cancelDownload);
    // ✅ v6.4 — « Réduire » : la modale se replie en pastille d'arrière-plan
    document.getElementById('arvexaDlMin').addEventListener('click', minimizeDownloadModal);
  }

  // ✅ v6.2 — « Annuler » : coupe le téléchargement côté SW, immédiatement
  function cancelDownload() {
    downloadCancelled = true;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'DOWNLOAD_CANCEL' });
      }
    } catch (e) {}
    const btn = document.getElementById('arvexaDlCancel');
    if (btn) {
      btn.disabled = true;
      // ✅ v6.3 — la pastille a un bouton ROND : pas de texte long dedans
      if (downloadMode !== 'bg') btn.textContent = 'Annulation...';
    }
    const info = document.getElementById('arvexaDlInfo');
    if (info) info.textContent = 'Annulation du téléchargement...';
  }

  function handleDownloadCancelled(data) {
    const done = data.done || 0;
    const skipped = data.skipped || 0;
    const kept = done + skipped;
    if (kept > 0) markOfflineReady({ total: kept, failed: data.failed || 0, cancelled: true });
    showToast(
      kept > 0
        ? `⏹ Téléchargement annulé — ${kept} fichier${kept > 1 ? 's' : ''} déjà prêt${kept > 1 ? 's' : ''} hors ligne`
        : '⏹ Téléchargement annulé',
      'info'
    );
    closeDownloadModal();
    hideBgPill();
  }

  function updateDownloadProgress(data) {
    // ✅ v6.4 — mémoire de la dernière progression (bouton « Réduire »)
    lastProgressData = {
      done: data.done || 0, failed: data.failed || 0,
      skipped: data.skipped || 0, total: data.total || 0,
      percent: data.percent || 0
    };
    const fill = document.getElementById('arvexaDlFill');
    const done = document.getElementById('arvexaDlDone');
    const total = document.getElementById('arvexaDlTotal');
    const percent = document.getElementById('arvexaDlPercent');
    const info = document.getElementById('arvexaDlInfo');

    if (fill) fill.style.width = data.percent + '%';
    if (done) done.textContent = (data.done || 0) + (data.skipped || 0);
    if (total) total.textContent = data.total;
    if (percent) percent.textContent = data.percent + '%';
    if (info) {
      const skippedTxt = (data.skipped || 0) > 0 ? ` · ${data.skipped} déjà en cache` : '';
      info.textContent = `${data.done || 0} fichier${(data.done || 0) > 1 ? 's' : ''} téléchargé${(data.done || 0) > 1 ? 's' : ''}${skippedTxt}`;
    }
  }

  function completeDownload(data) {
    const info = document.getElementById('arvexaDlInfo');
    const close = document.getElementById('arvexaDlClose');
    const cancel = document.getElementById('arvexaDlCancel');

    // ✅ v6.2 — l'état « prêt hors ligne » est mémorisé de façon persistante
    const readyCount = (data.done || 0) + (data.skipped || 0);
    if (readyCount > 0) {
      markOfflineReady({ total: readyCount, failed: data.failed || 0 });
    }

    if (info) {
      const warn = data.failed > 0
        ? `<br>⚠️ ${data.failed} fichier${data.failed > 1 ? 's' : ''} en échec — réessaie plus tard`
        : '';
      const skippedTxt = (data.skipped || 0) > 0
        ? `<br>✔ ${data.skipped} déjà présent${data.skipped > 1 ? 's' : ''} sur l'appareil`
        : '';
      info.innerHTML = `✅ <strong>${readyCount}</strong> fichier${readyCount > 1 ? 's' : ''} prêt${readyCount > 1 ? 's' : ''} hors ligne${skippedTxt}${warn}`;
    }

    if (cancel) cancel.style.display = 'none';
    const minBtn = document.getElementById('arvexaDlMin');
    if (minBtn) minBtn.style.display = 'none'; /* ✅ v6.4 */
    if (close) close.style.display = 'block';

    // ✅ v6.2 — jamais de « 0 fichier prêt » trompeur : si rien n'était à
    // télécharger, c'est que tout était déjà à jour.
    if (readyCount === 0 && (data.failed || 0) === 0) {
      showToast('✅ Contenu déjà à jour hors ligne', 'success');
    } else {
      showToast(data.failed > 0
        ? `✅ ${readyCount} fichiers prêts · ⚠️ ${data.failed} en échec`
        : `✅ ${readyCount} fichier${readyCount > 1 ? 's' : ''} prêt${readyCount > 1 ? 's' : ''} pour hors ligne`,
        data.failed > 0 ? 'info' : 'success');
    }

    setTimeout(() => closeDownloadModal(), 2500);

    // ✅ v6.3 — en mode arrière-plan : la pastille se ferme toute seule
    if (downloadMode === 'bg') setTimeout(hideBgPill, 2600);
  }

  function closeDownloadModal() {
    if (modalEl) {
      modalEl.style.opacity = '0';
      setTimeout(() => {
        if (modalEl) {
          modalEl.remove();
          modalEl = null;
        }
      }, 300);
    }
  }

  // ✅ v6.4 — la modale du profil ne bloque PLUS la page : elle se replie
  // en pastille d'arrière-plan et le téléchargement continue (job SW).
  function minimizeDownloadModal() {
    const last = lastProgressData || { done: 0, failed: 0, skipped: 0, total: 0, percent: 0 };
    downloadMode = 'bg';
    closeDownloadModal();
    if ((last.total || 0) > 0) {
      openBgPill(last.total, last.skipped || 0);
      updateDownloadProgress(last);
      startBgPolling();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ v6.3 — TÉLÉCHARGEMENT EN ARRIÈRE-PLAN
  // La pastille ne bloque RIEN : l'élève navigue, le job vit dans le SW,
  // la pastille se rattache sur chaque page qui inclut offline.js.
  // ═══════════════════════════════════════════════════════════════
  function openDownloadUI(total, alreadyCached) {
    if (downloadMode === 'bg') openBgPill(total, alreadyCached);
    else openDownloadModal(total, alreadyCached);
  }

  function openBgPill(total, alreadyCached) {
    if (bgPillEl) return;

    bgPillEl = document.createElement('div');
    bgPillEl.className = 'arvexa-bg-pill';
    bgPillEl.id = 'arvexaBgPill';
    // ✅ v6.4 — mini-carte « façon modale du profil » : icône dorée, titre,
    // %, barre de progression dorée, info, ✕. Bas-droite, NON bloquante.
    bgPillEl.innerHTML = [
      '<span class="arvexa-bg-pill-ico">📥</span>',
      '<span class="arvexa-bg-pill-body">',
      '  <span class="arvexa-bg-pill-top">',
      '    <span class="arvexa-bg-pill-title">Téléchargement hors ligne</span>',
      '    <span id="arvexaDlPercent">0%</span>',
      '  </span>',
      '  <span class="arvexa-bg-pill-bar"><span class="arvexa-bg-pill-fill" id="arvexaDlFill"></span></span>',
      '  <span class="arvexa-bg-pill-sub" id="arvexaDlInfo">en arrière-plan…</span>',
      '</span>',
      '<button class="arvexa-bg-pill-cancel" id="arvexaDlCancel" type="button" title="Annuler le téléchargement" aria-label="Annuler le téléchargement">✕</button>'
    ].join('');
    document.body.appendChild(bgPillEl);

    const cancelBtn = document.getElementById('arvexaDlCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelDownload);

    // ✅ v6.4 — se hisse AU-DESSUS de la bannière d'installation si elle est
    // visible (et la suit si elle apparaît/disparaît pendant le job).
    updatePillOffset();
    if (bgPillOffsetTimer) clearInterval(bgPillOffsetTimer);
    bgPillOffsetTimer = setInterval(updatePillOffset, 1500);
  }

  // ✅ v6.4 — place la pastille au-dessus de la bannière d'installation
  // (#arvexaInstallBanner, bas-centre) : zéro chevauchement, rien de caché.
  function updatePillOffset() {
    if (!bgPillEl) return;
    let bottomPx = null;
    try {
      const banner = document.getElementById('arvexaInstallBanner');
      if (banner) {
        const r = banner.getBoundingClientRect();
        if (r.height > 4 && r.bottom > 0 && r.top < window.innerHeight) {
          bottomPx = Math.round(window.innerHeight - r.top + 10);
        }
      }
    } catch (e) {}
    bgPillEl.style.bottom = (bottomPx != null) ? bottomPx + 'px' : '';
  }

  function hideBgPill() {
    if (!bgPillEl) return;
    const el = bgPillEl;
    bgPillEl = null;
    if (bgPillOffsetTimer) { clearInterval(bgPillOffsetTimer); bgPillOffsetTimer = null; } /* ✅ v6.4 */
    el.style.opacity = '0';
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 300);
  }

  function queryDownloadState(cb) {
    try {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) { cb(null); return; }
      const ch = new MessageChannel();
      const timer = setTimeout(() => { cb(null); try { ch.port1.close(); } catch (e) {} }, 4000);
      ch.port1.onmessage = (ev) => {
        clearTimeout(timer);
        cb(ev.data || {});
        try { ch.port1.close(); } catch (e) {}
      };
      navigator.serviceWorker.controller.postMessage({ type: 'DOWNLOAD_STATUS' }, [ch.port2]);
    } catch (e) { cb(null); }
  }

  function startBgPolling() {
    if (bgPollTimer) clearInterval(bgPollTimer);
    bgPollTimer = setInterval(() => {
      if (!bgPillEl) { clearInterval(bgPollTimer); bgPollTimer = null; return; }
      queryDownloadState((res) => {
        if (!bgPillEl) return;
        const st = res && res.state;
        if (st && st.running) {
          updateDownloadProgress({
            done: st.done || 0, failed: st.failed || 0,
            skipped: st.skipped || 0, total: st.total, percent: st.percent || 0
          });
        } else {
          clearInterval(bgPollTimer); bgPollTimer = null;
          const last = res && res.last;
          const ready = last ? (last.done || 0) + (last.skipped || 0) : 0;
          if (ready > 0) markOfflineReady({ total: ready, failed: (last && last.failed) || 0 });
          showToast(ready > 0
            ? ((last && last.ok)
              ? '✅ ' + ready + ' fichier' + (ready > 1 ? 's' : '') + ' prêt' + (ready > 1 ? 's' : '') + ' hors ligne'
              : '⏹ Téléchargement arrêté — ' + ready + ' fichier' + (ready > 1 ? 's' : '') + ' déjà prêt' + (ready > 1 ? 's' : ''))
            : '⏹ Téléchargement arrêté',
            last && last.ok ? 'success' : 'info');
          const txt = document.getElementById('downloadOfflineText');
          if (txt && ready > 0) txt.textContent = 'Mettre à jour le contenu hors ligne';
          hideBgPill();
        }
      });
    }, 1500);
  }

  function reattachBgDownload() {
    if (modalEl || bgPillEl) return;
    queryDownloadState((res) => {
      if (modalEl || bgPillEl) return;
      const st = res && res.state;
      if (st && st.running) {
        // ✅ v6.3 — un téléchargement d'arrière-plan est EN COURS (la page
        // d'origine a pu être fermée) : on rattache la pastille.
        downloadMode = 'bg';
        openBgPill(st.total, st.skipped || 0);
        updateDownloadProgress({
          done: st.done || 0, failed: st.failed || 0,
          skipped: st.skipped || 0, total: st.total, percent: st.percent || 0
        });
        startBgPolling();
      } else {
        const last = res && res.last;
        if (last && last.finished && (Date.now() - (last.ts || 0) < 15000)) {
          const ready = (last.done || 0) + (last.skipped || 0);
          if (ready > 0) markOfflineReady({ total: ready, failed: last.failed || 0 });
          showToast(ready > 0
            ? '✅ ' + ready + ' fichier' + (ready > 1 ? 's' : '') + ' prêt' + (ready > 1 ? 's' : '') + ' hors ligne'
            : '✅ Contenu à jour hors ligne',
            'success');
          const txt = document.getElementById('downloadOfflineText');
          if (txt && ready > 0) txt.textContent = 'Mettre à jour le contenu hors ligne';
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ✅ v6.3 — POP-UP POST-INSCRIPTION
  // register.html pose arvexa_new_registration=1 → la première page
  // ARVEXA (onboarding ou accueil) propose le téléchargement en
  // arrière-plan. Une seule fois (choix persisté), jamais pour les
  // anciens élèves ni si le contenu est déjà prêt.
  // ═══════════════════════════════════════════════════════════════
  function maybeShowWelcomeDownload() {
    try {
      if (localStorage.getItem(NEWREG_KEY) !== '1') return;
      if (localStorage.getItem(BGDL_CHOICE_KEY)) {
        // Décision déjà prise (ou pop-up déjà montré) → nettoyage du flag
        localStorage.removeItem(NEWREG_KEY);
        return;
      }
    } catch (e) { return; }

    // Pas de réseau / SW pas prêt → la page suivante réessaiera
    if (!isOnline || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;

    // Déjà prêt hors ligne (autre appareil déjà configuré) → ne pas déranger
    if (isOfflineReady() || bgPillEl) {
      try { localStorage.removeItem(NEWREG_KEY); } catch (e) {}
      return;
    }

    try { localStorage.setItem(BGDL_CHOICE_KEY, 'shown'); } catch (e) {}
    showWelcomePopup();
  }

  function showWelcomePopup() {
    if (document.getElementById('arvexaWelcomeDl')) return;

    const ov = document.createElement('div');
    ov.className = 'arvexa-welcome-overlay';
    ov.id = 'arvexaWelcomeDl';
    ov.innerHTML = [
      '<div class="arvexa-welcome-card">',
      '  <div class="arvexa-welcome-icon">📥</div>',
      '  <h3 class="arvexa-welcome-title">Bienvenue sur ARVEXA 🎉</h3>',
      '  <p class="arvexa-welcome-sub">Télécharge tout ton contenu (cours, PDF, exercices) pour le lire même <strong>sans Internet</strong>.',
      '  <br><span style="opacity:.78">Le téléchargement se fait en arrière-plan — tu peux continuer à utiliser l\'app normalement.</span></p>',
      '  <div class="arvexa-welcome-actions">',
      '    <button class="arvexa-welcome-ok" type="button">Télécharger en arrière-plan</button>',
      '    <button class="arvexa-welcome-later" type="button">Plus tard</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(ov);

    ov.querySelector('.arvexa-welcome-ok').addEventListener('click', () => {
      try {
        localStorage.setItem(BGDL_CHOICE_KEY, 'auto');
        localStorage.removeItem(NEWREG_KEY);
      } catch (e) {}
      hideWelcomePopup();
      downloadAllForOffline(true);
    });

    ov.querySelector('.arvexa-welcome-later').addEventListener('click', () => {
      try {
        localStorage.setItem(BGDL_CHOICE_KEY, 'later');
        localStorage.removeItem(NEWREG_KEY);
      } catch (e) {}
      hideWelcomePopup();
    });
  }

  function hideWelcomePopup() {
    const ov = document.getElementById('arvexaWelcomeDl');
    if (!ov) return;
    ov.style.opacity = '0';
    setTimeout(() => { try { ov.remove(); } catch (e) {} }, 300);
  }

  // ═══ STYLES ═══
  function injectStyles() {
    if (document.getElementById('arvexaOfflineStyles')) return;

    const style = document.createElement('style');
    style.id = 'arvexaOfflineStyles';
    style.textContent = `
      .arvexa-offline-banner {
        display: none;
        /* ✅ v6.2 — SURIMPOSÉ (fixed) : la bannière ne décale PLUS le contenu
           de la page quand elle apparaît/disparaît (fini le site « instable ») */
        position: fixed;
        top: 0; left: 0; right: 0;
        z-index: 999;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        background: linear-gradient(90deg, rgba(184,92,58,.18), rgba(184,92,58,.10));
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(184,92,58,.2);
        color: #FFB8A0;
        font-family: 'Inter', sans-serif;
        font-size: 12.5px;
        font-weight: 600;
        animation: arvexaBannerIn 0.3s cubic-bezier(0.25,1,0.5,1);
        pointer-events: auto;
      }
      .arvexa-offline-banner.show { display: flex; }
      .arvexa-offline-banner .arvexa-offline-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #E74C3C; box-shadow: 0 0 8px #E74C3C;
        flex-shrink: 0;
        animation: arvexaPulseDot 1.5s ease-in-out infinite;
      }
      .arvexa-offline-banner .arvexa-offline-text {
        flex: 1; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .arvexa-offline-banner .arvexa-offline-retry {
        width: 28px; height: 28px; border-radius: 50%;
        border: 1px solid rgba(255,184,160,.25);
        background: rgba(255,255,255,.04);
        color: #FFB8A0; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; transition: all 0.2s ease; flex-shrink: 0;
      }
      .arvexa-offline-banner .arvexa-offline-retry:hover {
        background: rgba(255,184,160,.15);
        border-color: rgba(255,184,160,.5);
      }

      .arvexa-offline-toast {
        position: fixed; top: 20px; left: 50%;
        transform: translateX(-50%) translateY(-80px);
        padding: 12px 20px; border-radius: 12px;
        background: rgba(20,22,20,.96);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(224,184,74,.3);
        color: #F5F0E8;
        font-family: 'Inter', sans-serif;
        font-size: 13px; font-weight: 500;
        z-index: 10000; opacity: 0; pointer-events: none;
        transition: all 0.4s cubic-bezier(0.25,1,0.5,1);
        max-width: 90%;
        box-shadow: 0 12px 40px rgba(0,0,0,.5);
        text-align: center;
      }
      .arvexa-offline-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      .arvexa-offline-toast.success { border-color: rgba(58,182,126,.5); }
      .arvexa-offline-toast.error { border-color: rgba(231,76,60,.5); }

      .arvexa-download-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 10001;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        animation: arvexaFadeIn 0.3s ease;
        transition: opacity 0.3s ease;
      }
      .arvexa-download-modal {
        background: linear-gradient(145deg, #141414, #0A0A0A);
        border: 1px solid rgba(184,134,11,.25);
        border-radius: 20px;
        padding: 28px 24px 22px;
        max-width: 440px; width: 100%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,.6);
        animation: arvexaSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
      }
      .arvexa-download-icon {
        font-size: 42px; margin-bottom: 12px;
        color: #E0B84A;
        animation: arvexaBounce 2s ease-in-out infinite;
      }
      .arvexa-download-title {
        font-family: 'Playfair Display', serif;
        font-size: 20px; font-weight: 700;
        color: #F5F0E8; margin-bottom: 6px;
      }
      .arvexa-download-sub {
        font-size: 13px; color: #8A8A7A;
        margin-bottom: 20px; line-height: 1.5;
      }
      .arvexa-download-progress { margin-bottom: 16px; }
      .arvexa-download-bar {
        height: 8px; border-radius: 8px;
        background: rgba(255,255,255,.06);
        overflow: hidden; margin-bottom: 10px;
      }
      .arvexa-download-fill {
        height: 100%; width: 0%;
        background: linear-gradient(90deg, #B8860B, #E0B84A);
        border-radius: 8px;
        transition: width 0.3s ease;
        box-shadow: 0 0 12px rgba(224,184,74,.5);
      }
      .arvexa-download-stats {
        display: flex; justify-content: space-between;
        font-size: 12px; color: #8A8A7A;
        font-weight: 600;
      }
      .arvexa-download-info {
        font-size: 13px; color: #8A8A7A;
        margin-bottom: 16px;
        min-height: 20px;
      }
      .arvexa-download-close {
        padding: 11px 28px; border-radius: 30px;
        border: none;
        background: linear-gradient(135deg, #E0B84A, #B8860B);
        color: #0A0A0A;
        font-family: 'Inter', sans-serif;
        font-size: 13px; font-weight: 700;
        cursor: pointer;
        transition: all 0.25s ease;
      }
      .arvexa-download-close:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(184,134,11,.3);
      }
      /* ✅ v6.2 — bouton « Annuler » + rangée d'actions de la modale */
      .arvexa-download-actions {
        display: flex; align-items: center; justify-content: center;
        gap: 12px; min-height: 44px;
      }
      .arvexa-download-cancel {
        padding: 11px 28px; border-radius: 30px;
        border: 1px solid rgba(255,184,160,.35);
        background: transparent;
        color: #FFB8A0;
        font-family: 'Inter', sans-serif;
        font-size: 13px; font-weight: 600;
        cursor: pointer;
        transition: all 0.25s ease;
      }
      .arvexa-download-cancel:hover {
        background: rgba(255,184,160,.12);
        border-color: rgba(255,184,160,.6);
      }
      .arvexa-download-cancel:disabled {
        opacity: .55; cursor: default;
      }

      @keyframes arvexaBannerIn {
        from { opacity: 0; transform: translateY(-100%); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes arvexaPulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.3); }
      }
      @keyframes arvexaFadeIn {
        from { opacity: 0; } to { opacity: 1; }
      }
      @keyframes arvexaSlideUp {
        from { opacity: 0; transform: translateY(30px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes arvexaBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }

      @media (prefers-reduced-motion: reduce) {
        .arvexa-offline-banner,
        .arvexa-offline-dot,
        .arvexa-offline-toast,
        .arvexa-download-modal,
        .arvexa-download-icon {
          animation: none !important;
          transition: none !important;
        }
      }

      @media (max-width: 480px) {
        .arvexa-offline-banner { font-size: 11.5px; padding: 7px 10px; }
        .arvexa-download-modal { padding: 22px 18px 18px; }
        .arvexa-download-title { font-size: 18px; }
      }

      /* ═══ ✅ v6.4 — bouton « Réduire » (modale du profil NON bloquante) ═══ */
      .arvexa-download-min {
        padding: 11px 22px; border-radius: 30px;
        border: 1px solid rgba(224,184,74,.5);
        background: transparent;
        color: #E0B84A;
        font-family: 'Inter', sans-serif;
        font-size: 13px; font-weight: 700;
        cursor: pointer;
        transition: all 0.25s ease;
      }
      .arvexa-download-min:hover {
        background: rgba(224,184,74,.12);
        border-color: rgba(224,184,74,.85);
      }
      .arvexa-download-hint {
        margin-top: 12px;
        font-size: 11px; line-height: 1.5;
        color: #8A8A7A;
      }

      /* ═══ ✅ v6.4 — PASTILLE D'ARRIÈRE-PLAN, redesign « façon modale profil » ═══
         ✅ CORRECTION v6.4 : ces styles étaient PIÉGÉS dans le @media
         (max-width: 480px) → pastille SANS AUCUN STYLE au-delà de 480 px
         (« 0 css »). Posés désormais à TOUTES les tailles d'écran.
         Position : bas-DROITE — elle ne couvre plus le bouton menu
         (haut-gauche) ; updatePillOffset() la hisse au-dessus de la
         bannière d'installation quand celle-ci est visible. */
      .arvexa-bg-pill {
        position: fixed;
        right: 12px;
        bottom: calc(14px + env(safe-area-inset-bottom, 0px));
        z-index: 9300;
        display: flex; align-items: center; gap: 9px;
        padding: 10px;
        background: linear-gradient(145deg, #141414, #0A0A0A);
        border: 1px solid rgba(184,134,11,.35);
        border-radius: 16px;
        color: #F5F0E8;
        font-family: 'Inter', sans-serif;
        font-size: 11.5px; font-weight: 600;
        box-shadow: 0 14px 40px rgba(0,0,0,.55);
        max-width: min(290px, calc(100vw - 24px));
        animation: arvexaSlideUp .35s cubic-bezier(0.34,1.56,0.64,1);
        transition: opacity .3s ease, bottom .25s ease;
      }
      .arvexa-bg-pill-ico {
        flex: none; width: 32px; height: 32px; border-radius: 50%;
        background: linear-gradient(135deg, rgba(184,134,11,.28), rgba(184,134,11,.08));
        border: 1px solid rgba(184,134,11,.4);
        display: flex; align-items: center; justify-content: center;
        font-size: 15px;
      }
      .arvexa-bg-pill-body {
        display: flex; flex-direction: column; gap: 3px;
        min-width: 0; flex: 1;
      }
      .arvexa-bg-pill-top {
        display: flex; align-items: baseline; justify-content: space-between;
        gap: 8px;
      }
      .arvexa-bg-pill-title {
        font-weight: 700; font-size: 11.5px; color: #F5F0E8;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .arvexa-bg-pill-top #arvexaDlPercent {
        flex: none; font-weight: 800; font-size: 11.5px; color: #E0B84A;
      }
      .arvexa-bg-pill .arvexa-bg-pill-bar {
        display: block; width: 100%; height: 5px; border-radius: 999px;
        background: rgba(255,255,255,.10);
        overflow: hidden; flex: none;
      }
      .arvexa-bg-pill .arvexa-bg-pill-fill {
        display: block; height: 100%; width: 0%;
        background: linear-gradient(90deg, #B8860B, #E0B84A);
        border-radius: 999px;
        transition: width .4s ease;
        box-shadow: 0 0 10px rgba(224,184,74,.45);
      }
      .arvexa-bg-pill .arvexa-bg-pill-sub {
        font-weight: 500; font-size: 10.5px; color: rgba(245,240,232,.72);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        min-width: 0;
      }
      .arvexa-bg-pill-cancel {
        border: none; cursor: pointer; flex: none;
        width: 24px; height: 24px; border-radius: 50%;
        background: rgba(255,255,255,.1);
        color: #F5F0E8; font-size: 11px; line-height: 1;
        display: flex; align-items: center; justify-content: center;
        padding: 0; transition: background .2s ease;
      }
      .arvexa-bg-pill-cancel:hover { background: rgba(231,76,60,.45); }
      .arvexa-bg-pill-cancel:active { background: rgba(231,76,60,.65); }
      @media (max-width: 360px) {
        .arvexa-bg-pill { right: 8px; max-width: calc(100vw - 16px); }
      }

      /* ═══ ✅ v6.3 — POP-UP POST-INSCRIPTION (✅ v6.4 : sorti du @media 480px
         — styles appliqués à toutes les tailles d'écran) ═══ */
      .arvexa-welcome-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.55);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 9500;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        animation: arvexaFadeIn 0.3s ease;
        transition: opacity 0.3s ease;
      }
      .arvexa-welcome-card {
        background: linear-gradient(145deg, #141414, #0A0A0A);
        border: 1px solid rgba(184,134,11,.3);
        border-radius: 20px;
        padding: 26px 22px 20px;
        max-width: 420px; width: 100%;
        text-align: center;
        color: #F5F0E8;
        font-family: 'Inter', sans-serif;
        box-shadow: 0 20px 60px rgba(0,0,0,.6);
        animation: arvexaSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
      }
      .arvexa-welcome-icon {
        width: 54px; height: 54px; margin: 0 auto 12px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(184,134,11,.25), rgba(184,134,11,.08));
        border: 1px solid rgba(184,134,11,.35);
        display: flex; align-items: center; justify-content: center;
        font-size: 24px;
      }
      .arvexa-welcome-title {
        margin: 0 0 8px; font-size: 17px; font-weight: 800;
        color: #F5F0E8; letter-spacing: .2px;
      }
      .arvexa-welcome-sub {
        margin: 0; font-size: 12.5px; line-height: 1.6; opacity: .92;
      }
      .arvexa-welcome-actions {
        display: flex; flex-direction: column; gap: 10px; margin-top: 18px;
      }
      .arvexa-welcome-ok {
        border: none; cursor: pointer; border-radius: 12px;
        padding: 13px 16px; font-weight: 800; font-size: 13.5px;
        color: #0A0A0A;
        background: linear-gradient(135deg, #E0B84A, #B8860B);
        box-shadow: 0 6px 18px rgba(184,134,11,.3);
        font-family: 'Inter', sans-serif;
      }
      .arvexa-welcome-later {
        border: 1px solid rgba(245,240,232,.22);
        background: transparent; color: #F5F0E8;
        border-radius: 12px; padding: 11px 16px;
        font-weight: 600; font-size: 13px; cursor: pointer;
        font-family: 'Inter', sans-serif;
      }
    `;
    document.head.appendChild(style);
  }

  // ═══ INIT ═══
  function init() {
    injectStyles();
    loadPendingData();

    // ✅ v6.2 — page ouverte alors qu'on est déjà hors ligne (démarrage à
    // froid sans réseau) : la bannière peut s'afficher immédiatement.
    if (!isOnline && offlineSince === null) {
      offlineSince = Date.now() - (OFFLINE_HYSTERESIS_MS + 1000);
    }

    const boot = () => {
      createBanner();
      bindNetworkEvents();
      updateUI();

      // ✅ v6.3 — rattacher la pastille d'arrière-plan (téléchargement en
      // cours venu d'une page précédente) + pop-up post-inscription.
      setTimeout(() => {
        reattachBgDownload();
        maybeShowWelcomeDownload();
      }, 1800);

      if (isOnline && pendingSync.length > 0) {
        setTimeout(syncPendingData, 1500);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  // ═══ API PUBLIQUE ═══
  window.arvexaOffline = {
    isOnline: () => isOnline,

    queue: function (data) {
      pendingSync.push({
        data: data,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
      savePendingData();
    },

    canPerform: function (action) {
      if (isOnline) return true;
      const allowed = ['read', 'navigate', 'notes', 'calculator', 'formula', 'cours'];
      return allowed.includes(action);
    },

    sync: function () {
      if (isOnline) syncPendingData();
      else showToast('📶 Impossible de synchroniser hors ligne', 'error');
    },

    pending: function () {
      loadPendingData();
      return [...pendingSync];
    },

    setSyncHandler: function (fn) {
      window.__arvexaSync = fn;
    },

    downloadAll: downloadAllForOffline,

    // ✅ v6.3 — téléchargement en arrière-plan (pastille, non bloquant)
    downloadInBackground: function () { return downloadAllForOffline(true); },

    // ✅ v6.2 — l'application peut savoir si le contenu hors ligne est prêt
    isOfflineReady: isOfflineReady,

    cacheUrl: function (url) {
      if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_URL',
        url
      });
    },

    getStats: function () {
      return new Promise((resolve) => {
        if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
          resolve({});
          return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => {
          if (e.data.type === 'STATS_RESULT') resolve(e.data.stats);
        };
        navigator.serviceWorker.controller.postMessage(
          { type: 'STATS' },
          [channel.port2]
        );
        setTimeout(() => resolve({}), 2000);
      });
    },

    toast: showToast
  };

  init();

  console.log('✅ ARVEXA — Mode hors ligne v6.4 (arrière-plan non bloquant) prêt');
})();
