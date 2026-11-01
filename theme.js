/* ═══════════════════════════════════════════════════════════════════
   ARVEXA SCHOOL — THEME.JS
   Gestion du thème : sombre (défaut) / clair (activable dans Profil).
   Rôle :
     1. Appliquer le thème mémorisé (localStorage 'arvexa-theme').
     2. Tenir <meta name="theme-color"> à jour (barre système PWA).
     3. Exposer window.ARVEXA_THEME { get, set, toggle } pour les réglages.
     4. Synchroniser les onglets ouverts (événement storage).
   Note : l'application AVANT premier paint est faite par le mini-script
   inline présent dans le <head> de chaque page (anti-flash). Ce fichier
   confirme l'état, gère la bascule et la persistance.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'arvexa-theme';
  var META_COLORS = { dark: '#0A0A0A', light: '#F5F1E8' };

  function get() {
    try {
      return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function updateMeta(theme) {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      metas[i].setAttribute('content', META_COLORS[theme] || META_COLORS.dark);
    }
  }

  function apply(theme) {
    var root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
    updateMeta(theme);
  }

  function set(theme, persist) {
    if (theme !== 'light' && theme !== 'dark') theme = 'dark';
    apply(theme);
    if (persist !== false) {
      try { localStorage.setItem(KEY, theme); } catch (e) { /* stockage indisponible */ }
    }
    try {
      window.dispatchEvent(new CustomEvent('arvexa-themechange', { detail: { theme: theme } }));
    } catch (e) { /* vieux navigateurs */ }
  }

  function toggle() {
    set(get() === 'light' ? 'dark' : 'light');
  }

  /* Application immédiate (synchronise avec le boot inline du <head>) */
  apply(get());

  /* Synchronisation entre onglets */
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === KEY) apply(get());
  });

  /* API publique — utilisée par le réglage "Apparence" du profil */
  window.ARVEXA_THEME = { get: get, set: set, toggle: toggle };
})();
