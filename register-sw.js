// ================================================================
// REGISTER SERVICE WORKER — ARVEXA School
// Version : OFFLINE v1.4 — Toast unique par version + préchargement fluide
// ================================================================

(function () {
  'use strict';

  // ═══ 0. BARRIÈRE D'INSTALLATION PWA (v5.6) — capture TÔT du prompt natif ═══
  // Chrome émet beforeinstallprompt tôt : on le capture ici (avant tout le
  // reste) pour que install-banner.js puisse l'utiliser quel que soit son
  // moment de chargement. preventDefault = on remplace la mini-infobar
  // Chrome par notre bannière ARVEXA.
  try {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.__arvexaBIP = e;
      try { document.dispatchEvent(new CustomEvent('arvexa-bip')); } catch (err) {}
    });
  } catch (e) {}

  // ═══ 1. ENREGISTREMENT SW ═══
  if ('serviceWorker' in navigator) {

    // ── Détection de mise à jour, posée AVANT le register (anti-course) ──
    let updatePending = false;

    // Filet 1 : le nouveau SW prend le contrôle PENDANT la session
    try {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!updatePending) return;
        updatePending = false;
        setTimeout(showUpdateToast, 600);
      });
    } catch (e) {}

    // Filet 2 : le SW notifie lui-même son activation (post-claim). Couvre le
    // cas où claim() a eu lieu AVANT l'exécution de ce script (reload) : on
    // compare la version annoncée à la dernière version connue de l'appareil.
    try {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type !== 'SW_ACTIVATED' || !data.version) return;
        let known = null;
        try { known = localStorage.getItem('arvexa-sw-version'); } catch (e) {}
        try { localStorage.setItem('arvexa-sw-version', data.version); } catch (e) {}
        if (known && known !== data.version) {
          console.log('[SW] Version appliquée :', data.version, '(ancienne :', known + ')');
          setTimeout(showUpdateToast, 400);
        }
      });
    } catch (e) {}

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('service-worker.js', {
          scope: './',
          updateViaCache: 'none'
        })
        .then((registration) => {
          console.log('[SW] Enregistré. Scope:', registration.scope);

          // Filet 3 : un nouveau SW attend déjà d'être activé au chargement
          if (registration.waiting && navigator.serviceWorker.controller) {
            console.log('[SW] Nouvelle version en attente au chargement');
            updatePending = true;
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] Nouvelle version détectée — activation silencieuse');
                updatePending = true;
                // ⚡ On active la nouvelle version SANS reload
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });

          // Quand le nouveau SW prend le contrôle après une mise à jour, on
          // propose l'application immédiate (la page affichée est encore
          // l'ancienne si elle vient du cache). Clic = rechargement propre.
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!updatePending) return;
            updatePending = false;
            setTimeout(showUpdateToast, 600);
          });

          setInterval(() => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => {});
            }
          }, 60 * 60 * 1000);

          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => {});
            }
          });
        })
        .catch((error) => {
          console.warn('[SW] Erreur:', error.message);
        });
    });
  }

  // ═══ 1b. TOAST « NOUVELLE VERSION » ═══
  // ✅ v1.4 — affiché UNE SEULE FOIS par version (persisté) : plus aucun
  // bandeau qui apparaît/disparaît en boucle (cause d'instabilité signalée).
  // Positionné EN HAUT : il ne se superpose plus à la bannière d'installation
  // ni aux boutons de navigation du bas.
  function showUpdateToast() {
    if (document.getElementById('arvexaUpdateToast')) return;
    let version = 'inconnue';
    try { version = localStorage.getItem('arvexa-sw-version') || 'inconnue'; } catch (e) {}
    try {
      if (localStorage.getItem('arvexa-sw-version-toast') === version) return;
      localStorage.setItem('arvexa-sw-version-toast', version);
    } catch (e) {}
    try {
      const lang = (localStorage.getItem('arvexa-lang') || 'fr').startsWith('en') ? 'en' : 'fr';
      const pill = document.createElement('div');
      pill.id = 'arvexaUpdateToast';
      pill.setAttribute('role', 'button');
      pill.textContent = lang === 'en'
        ? '✨ New version — tap to apply'
        : '✨ Nouvelle version — touche pour actualiser';
      pill.style.cssText = [
        'position:fixed',
        'left:50%',
        'transform:translateX(-50%)',
        'top:calc(14px + env(safe-area-inset-top, 0px))',
        'z-index:99999',
        'background:#141412',
        'color:#E0B84A',
        'border:1px solid rgba(224,184,74,.45)',
        'border-radius:999px',
        'padding:10px 16px',
        'font:600 12.5px/1.25 Inter,system-ui,sans-serif',
        'box-shadow:0 6px 24px rgba(0,0,0,.5)',
        'cursor:pointer',
        'max-width:calc(100vw - 32px)',
        'text-align:center',
        'opacity:0',
        'transition:opacity .25s ease'
      ].join(';');
      pill.addEventListener('click', () => { try { location.reload(); } catch (e) {} });
      document.body.appendChild(pill);
      requestAnimationFrame(() => { pill.style.opacity = '1'; });
      setTimeout(() => {
        pill.style.opacity = '0';
        setTimeout(() => { try { pill.remove(); } catch (e) {} }, 400);
      }, 8000);
      console.log('[SW] Toast nouvelle version affiché (', version, ')');
    } catch (e) {}
  }

  // ═══ 2. INJECTION offline.js ═══
  function injectOffline() {
    if (document.getElementById('arvexaOfflineScript')) return;

    const path = window.location.pathname.toLowerCase();
    const SKIP = ['login','register','forgot-password','auth-choice','onboarding','conditions','confidentialite','offline','404'];
    if (SKIP.some((p) => path.includes(p))) return;

    const script = document.createElement('script');
    script.id = 'arvexaOfflineScript';
    script.src = 'offline.js';
    script.defer = true;
    script.onerror = () => console.warn('[Offline] Impossible de charger offline.js');
    document.head.appendChild(script);
  }

  // ═══ 2b. INJECTION barrière d'installation PWA (v5.6) ═══
  // Affiche « Installe ARVEXA sur ton écran d'accueil » tant que l'app est
  // consultée dans Chrome ; disparaît uniquement une fois installée.
  function injectInstallBanner() {
    if (document.getElementById('arvexaInstallBannerScript')) return;

    const path = window.location.pathname.toLowerCase();
    const SKIP = ['offline', '404', 'admin'];
    if (SKIP.some((p) => path.includes(p))) return;

    const script = document.createElement('script');
    script.id = 'arvexaInstallBannerScript';
    script.src = 'install-banner.js';
    script.defer = true;
    script.onerror = () => console.warn('[InstallBanner] non chargé');
    document.head.appendChild(script);
  }

  // ═══ 3. INJECTION analytics.js ═══
  function injectAnalytics() {
    if (document.getElementById('arvexaAnalyticsScript')) return;
    if (window.location.pathname.includes('admin')) return;

    const script = document.createElement('script');
    script.id = 'arvexaAnalyticsScript';
    script.src = 'analytics.js';
    script.async = true;
    script.type = 'module';
    script.onerror = () => console.warn('[Analytics] non chargé');
    document.head.appendChild(script);
  }

  // ═══ 2c. PRÉCHARGEMENT FLUIDE (v1.4) ═══
  // Dès que l'élève presse un lien (pointerdown ≈ 100 ms AVANT la navigation),
  // la page suivante commence à se charger en tâche de fond → la transition
  // entre les pages devient quasi instantanée, même en 2G. Desktop : survol.
  function injectPrefetch() {
    if (window.__arvexaPrefetchInit) return;
    window.__arvexaPrefetchInit = true;

    let saveData = false;
    try {
      const c = navigator.connection;
      if (c && (c.saveData || c.effectiveType === 'slow-2g')) saveData = true;
    } catch (e) {}
    if (saveData) return;

    const seen = new Set();
    const isPrefetchable = (a) => {
      try {
        if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
        if (a.hasAttribute('data-no-prefetch')) return false;
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
        const u = new URL(a.href, location.href);
        if (u.origin !== location.origin) return false;
        if (!/\.html?$/i.test(u.pathname) && u.pathname !== '/') return false;
        if (/admin|logout|conditions|confidentialite/i.test(u.pathname)) return false;
        return true;
      } catch (e) { return false; }
    };

    const prefetch = (a) => {
      try {
        const href = a.href;
        if (seen.has(href)) return;
        seen.add(href);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        link.as = 'document';
        document.head.appendChild(link);
      } catch (e) {}
    };

    // Mobile : pointerdown (le doigt touche ≈ 80-120 ms avant le tap)
    document.addEventListener('pointerdown', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (isPrefetchable(a)) prefetch(a);
    }, { capture: true, passive: true });

    // Desktop : survol (120 ms de délai anti-fausse-maneuvre)
    document.addEventListener('mouseover', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (isPrefetchable(a)) {
        setTimeout(() => { if (a.isConnected && isPrefetchable(a)) prefetch(a); }, 120);
      }
    }, { capture: true, passive: true });
  }

  // ═══ 4. LANCEMENT ═══
  function boot() {
    injectOffline();
    injectInstallBanner();
    injectAnalytics();
    injectTour();
    injectPrefetch();
  }

  // ═══ INJECTION DU TUTORIEL ═══
  function injectTour() {
    if (document.getElementById('arvexaTourScript')) return;

    const path = window.location.pathname.toLowerCase();
    const SKIP = [
      'login', 'register', 'forgot-password', 'auth-choice',
      'onboarding.html', 'conditions', 'confidentialite',
      'offline', '404', 'onboarding-tour',
      // ✅ v4.30 — ne JAMAIS interrompre une lecture ou un examen :
      // le tour reprendra au retour sur l'accueil / les listes
      'lecture.html', 'exam.html', 'exam-history.html'
    ];

    if (SKIP.some((p) => path.includes(p))) return;

    try {
      if (localStorage.getItem('arvexa_tour_completed_v1') === '1') return;
    } catch (e) { return; }

    if (!document.querySelector('link[data-arvexa-tour-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'tour-styles.css';
      link.setAttribute('data-arvexa-tour-css', '1');
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.id = 'arvexaTourScript';
    script.src = 'onboarding-tour.js';
    script.defer = true;
    script.onerror = () => console.warn('[Tour] Impossible de charger onboarding-tour.js');
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ═══ 5. LOGS ═══
  window.addEventListener('online', () => console.log('[SW] En ligne'));
  window.addEventListener('offline', () => console.log('[SW] Hors ligne'));

  // ═══ 6. NETTOYAGE MANUEL (console) ═══
  window.arvexaClearSW = async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.unregister();
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      console.log('[SW] Tout nettoyé. Recharge la page.');
    } catch (e) {
      console.error(e);
    }
  };
})();
