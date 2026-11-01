// ================================================================
// INSTALL BANNER — ARVEXA School (v5.6)
// Barrière d'installation demandée par le propriétaire :
// « dès l'ouverture dans Chrome, l'utilisateur reçoit une barrière
//   d'installation ; elle disparaît uniquement s'il a installé sur
//   son écran d'accueil ; elle reste active s'il revient dans Chrome »
//
// RÈGLES APPLIQUÉES :
//   1. App ouverte dans Chrome (navigateur)  → bannière AFFICHÉE.
//   2. App installée (mode standalone / iOS standalone) → JAMAIS.
//   3. Pas de bouton « fermer » : seule l'installation la fait partir.
//   4. Android/Chrome : bouton = prompt natif beforeinstallprompt.
//      iOS/Safari ou critères non remplis : modal « comment installer ».
// ================================================================
(function () {
  'use strict';

  var BANNER_ID = 'arvexaInstallBanner';
  var FLAG = 'arvexa_pwa_installed';

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    } catch (e) {}
    if (window.navigator && window.navigator.standalone === true) return true; // iOS installé
    try {
      if (document.referrer && document.referrer.indexOf('android-app://') === 0) return true;
    } catch (e) {}
    return false;
  }

  function isIOS() {
    try {
      var ua = navigator.userAgent || '';
      if (/iphone|ipad|ipod/i.test(ua)) return true;
      // iPadOS 13+ se présente comme macOS avec écran tactile
      return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
    } catch (e) { return false; }
  }

  function markInstalled() {
    try { localStorage.setItem(FLAG, String(Date.now())); } catch (e) {}
  }

  function removeBanner() {
    try {
      var b = document.getElementById(BANNER_ID);
      if (b) b.remove();
      var s = document.getElementById(BANNER_ID + 'Style');
      if (s) s.remove();
    } catch (e) {}
  }

  /* ── Styles ──────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById(BANNER_ID + 'Style')) return;
    var st = document.createElement('style');
    st.id = BANNER_ID + 'Style';
    st.textContent = [
      '#' + BANNER_ID + '{position:fixed;left:50%;transform:translateX(-50%);',
      'bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9400;',
      'display:flex;align-items:center;gap:12px;padding:12px 14px;',
      'width:calc(100% - 28px);max-width:430px;border-radius:18px;',
      'background:#10100E;border:1px solid rgba(224,184,74,.42);',
      'box-shadow:0 12px 34px rgba(0,0,0,.45);color:#F5F0E8;',
      'font-family:Inter,system-ui,-apple-system,sans-serif;',
      'opacity:0;transition:opacity .4s ease;}',
      'html[data-theme="light"] #' + BANNER_ID + '{background:#FFFFFF;color:#22302A;',
      'border-color:rgba(184,134,11,.5);box-shadow:0 12px 30px rgba(26,58,42,.20);}',
      '#' + BANNER_ID + '.show{opacity:1;}',
      '#' + BANNER_ID + ' img{width:44px;height:44px;border-radius:12px;flex:0 0 auto;',
      'box-shadow:0 2px 8px rgba(0,0,0,.35);}',
      '#' + BANNER_ID + ' .ib-txt{flex:1 1 auto;min-width:0;}',
      '#' + BANNER_ID + ' .ib-title{font-size:13.5px;font-weight:700;letter-spacing:.2px;}',
      '#' + BANNER_ID + ' .ib-sub{font-size:11.5px;opacity:.78;margin-top:2px;line-height:1.45;}',
      '#' + BANNER_ID + ' .ib-btn{flex:0 0 auto;border:none;cursor:pointer;',
      'background:linear-gradient(135deg,#E0B84A,#B8860B);color:#14120A;',
      'font-family:inherit;font-size:12.5px;font-weight:700;letter-spacing:.3px;',
      'padding:9px 16px;border-radius:999px;white-space:nowrap;}',
      '#' + BANNER_ID + ' .ib-btn:active{transform:scale(.97);}',
      '#arvexaInstallHow{position:fixed;inset:0;z-index:9600;display:flex;',
      'align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);',
      'font-family:Inter,system-ui,sans-serif;opacity:0;transition:opacity .3s ease;}',
      '#arvexaInstallHow.show{opacity:1;}',
      '#arvexaInstallHow .ih-card{background:#141412;color:#F5F0E8;width:100%;',
      'max-width:430px;border-radius:20px 20px 0 0;padding:22px 20px 26px;',
      'border-top:1px solid rgba(224,184,74,.4);}',
      'html[data-theme="light"] #arvexaInstallHow .ih-card{background:#FFFFFF;color:#22302A;}',
      '#arvexaInstallHow .ih-title{font-size:15px;font-weight:700;margin-bottom:14px;',
      'color:#E0B84A;}',
      '#arvexaInstallHow .ih-step{display:flex;gap:10px;margin-bottom:10px;',
      'font-size:13px;line-height:1.55;}',
      '#arvexaInstallHow .ih-num{flex:0 0 22px;height:22px;border-radius:50%;',
      'background:rgba(224,184,74,.15);color:#E0B84A;font-weight:700;font-size:12px;',
      'display:flex;align-items:center;justify-content:center;}',
      '#arvexaInstallHow .ih-close{margin-top:14px;width:100%;border:none;cursor:pointer;',
      'background:linear-gradient(135deg,#E0B84A,#B8860B);color:#14120A;',
      'font-family:inherit;font-size:13px;font-weight:700;padding:11px;border-radius:999px;}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ── Modal « comment installer » (iOS / prompt natif absent) ─── */
  function showHowTo() {
    if (document.getElementById('arvexaInstallHow')) return;
    var ios = isIOS();
    var steps = ios ? [
          'Touche le bouton <b>Partager</b> (le carré avec la flèche vers le haut, en bas de l\u2019écran).',
          'Dans la liste, touche <b>\u00ab\u00A0Sur l\u2019écran d\u2019accueil\u00A0\u00bb</b>.',
          'Puis touche <b>\u00ab\u00A0Ajouter\u00A0\u00bb</b> en haut à droite.'
        ] : [
          'Touche le menu <b>\u22ee</b> (les trois points, en haut à droite de Chrome).',
          'Touche <b>\u00ab\u00A0Installer l\u2019application\u00A0\u00bb</b> ou <b>\u00ab\u00A0Ajouter à l\u2019écran d\u2019accueil\u00A0\u00bb</b>.',
          'Confirme avec <b>\u00ab\u00A0Installer\u00A0\u00bb</b>.'
        ];
    var ov = document.createElement('div');
    ov.id = 'arvexaInstallHow';
    var card = document.createElement('div');
    card.className = 'ih-card';
    var title = document.createElement('div');
    title.className = 'ih-title';
    title.textContent = 'Installer ARVEXA sur ton téléphone';
    card.appendChild(title);
    steps.forEach(function (txt, i) {
      var row = document.createElement('div');
      row.className = 'ih-step';
      var n = document.createElement('span');
      n.className = 'ih-num';
      n.textContent = String(i + 1);
      var t = document.createElement('span');
      t.innerHTML = txt; // chaîne interne statique (pas d'entrée utilisateur)
      row.appendChild(n);
      row.appendChild(t);
      card.appendChild(row);
    });
    var close = document.createElement('button');
    close.className = 'ih-close';
    close.textContent = 'J\u2019ai compris';
    close.addEventListener('click', function () { ov.remove(); });
    card.appendChild(close);
    ov.appendChild(card);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });
  }

  /* ── Bannière ────────────────────────────────────────────────── */
  function showBanner() {
    if (isStandalone()) { markInstalled(); return; } // installé → jamais
    if (document.getElementById(BANNER_ID)) return;
    injectStyles();

    var bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Installer l\u2019application ARVEXA');

    var img = document.createElement('img');
    img.src = 'icon.png';
    img.alt = 'ARVEXA';

    var txt = document.createElement('div');
    txt.className = 'ib-txt';
    var t1 = document.createElement('div');
    t1.className = 'ib-title';
    t1.textContent = 'Installe ARVEXA sur ton \u00e9cran d\u2019accueil';
    var t2 = document.createElement('div');
    t2.className = 'ib-sub';
    t2.textContent = 'Ouverture directe, plein \u00e9cran et cours disponibles m\u00eame sans Internet.';
    txt.appendChild(t1);
    txt.appendChild(t2);

    var btn = document.createElement('button');
    btn.className = 'ib-btn';
    btn.type = 'button';
    btn.textContent = 'Installer';
    btn.addEventListener('click', function () {
      var p = window.__arvexaBIP || null;
      if (p && typeof p.prompt === 'function') {
        try {
          p.prompt();
          if (p.userChoice && typeof p.userChoice.then === 'function') {
            p.userChoice.then(function (res) {
              if (res && res.outcome === 'accepted') {
                markInstalled();
                removeBanner();
              }
              /* dismissed → la bannière reste (consigne propriétaire) */
              try { window.__arvexaBIP = null; } catch (e) {}
            }).catch(function () {});
          }
        } catch (e) { showHowTo(); }
      } else {
        showHowTo();
      }
    });

    bar.appendChild(img);
    bar.appendChild(txt);
    bar.appendChild(btn);
    document.body.appendChild(bar);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { bar.classList.add('show'); });
    });
  }

  /* ── Capture du prompt natif (si register-sw.js ne l'a pas eu) ── */
  try {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      window.__arvexaBIP = e;
    });
  } catch (e) {}

  try {
    window.addEventListener('appinstalled', function () {
      markInstalled();
      removeBanner();
    });
  } catch (e) {}

  function init() {
    if (isStandalone()) { markInstalled(); return; }
    /* légère attente : laisser l'écran de chargement ARVEXA jouer son rôle */
    setTimeout(showBanner, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
