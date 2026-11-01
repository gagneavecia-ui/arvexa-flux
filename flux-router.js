/* ═══════════════════════════════════════════════════════════════════════
   ⚡ ARVEXA FLUX v1 — NAVIGATION INSTANTANÉE (prototype)
   ─────────────────────────────────────────────────────────────────────
   Objectif : le ressenti d'une application React (type AXIA) — les pages
   s'affichent INSTANTANÉMENT, sans jamais recharger le document :
     • clic sur un lien → le contenu est échangé sur place (styles de page
       remplacés, body remplacé, scripts ré-exécutés dans l'ordre) ;
     • chaque page vue est mise en cache (mémoire + sessionStorage) ;
     • prefetch agressif : survol, liens visibles, puis TOUTES les pages
       internes en tâche de fond → la navigation suivante = 0 ms ;
     • précédent / suivant instantanés (popstate + cache) ;
     • barre de progression discrète uniquement si le réseau traîne ;
     • fondu fluide via l'API View Transitions quand elle existe ;
     • repli automatique vers la navigation classique au moindre problème.
   Les scripts du site redémarrent à chaque page (comportement fidèle) ;
   les setInterval de la page sortante sont purgés (aucune fuite), et les
   scripts partagés (thème, i18n, contact…) sont idempotents à la relance.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__ARVEXA_FLUX__) return; /* déjà actif (head échangé) */

  var FLUX = window.__ARVEXA_FLUX__ = { v: 1, navs: 0, hits: 0, lastMs: 0, bootedAt: Date.now() };
  /* Marqueur de session : preuve « zéro rechargement » (les tests vérifient
     qu'il survit à une navigation — un rechargement complet le reset). */
  window.__ARVEXA_FLUX_MARKER = Date.now();

  /* ── Réglages ─────────────────────────────────────────────────────── */
  var MEM_MAX = 24;                  /* pages gardées en mémoire vive      */
  var SS_KEY = 'arvexa_flux_pages';  /* cache de session (onglet courant)  */
  var SS_MAX = 12;                   /* pages gardées en sessionStorage    */
  var SS_PAGE_MAX = 380 * 1024;      /* pages trop grosses → mémoire seule */
  var PREFETCH_CONCURRENCY = 2;
  var IDLE_CRAWL_DELAY = 2500;       /* crawl complet après 2,5 s de calme */
  var BAR_DELAY = 140;               /* barre si le réseau dépasse 140 ms  */

  /* ── Caches ───────────────────────────────────────────────────────── */
  var MEM = new Map(); /* url -> {h, ts} */

  function memTrim() {
    while (MEM.size > MEM_MAX) {
      var oldest = null, oldestTs = Infinity;
      MEM.forEach(function (v, k) { if (v.ts < oldestTs) { oldestTs = v.ts; oldest = k; } });
      if (oldest) MEM.delete(oldest); else break;
    }
  }

  function ssAll() {
    try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function ssPut(url, html) {
    if (html.length > SS_PAGE_MAX) return;
    try {
      var o = ssAll();
      o[url] = { h: html, ts: Date.now() };
      var keys = Object.keys(o);
      if (keys.length > SS_MAX) {
        keys.sort(function (a, b) { return o[a].ts - o[b].ts; });
        while (keys.length > SS_MAX) { delete o[keys.shift()]; }
      }
      sessionStorage.setItem(SS_KEY, JSON.stringify(o));
    } catch (e) {
      /* quota : on ne garde que les 5 plus récentes */
      try {
        var o2 = ssAll();
        var k2 = Object.keys(o2).sort(function (a, b) { return o2[b].ts - o2[a].ts; });
        var keep = {};
        for (var i = 0; i < Math.min(5, k2.length); i++) keep[k2[i]] = o2[k2[i]];
        sessionStorage.setItem(SS_KEY, JSON.stringify(keep));
      } catch (e2) { /* sessionStorage indisponible : mémoire seule */ }
    }
  }

  function getCached(url) {
    var m = MEM.get(url);
    if (m) return m.h;
    var o = ssAll();
    if (o[url] && o[url].h) {
      MEM.set(url, { h: o[url].h, ts: o[url].ts });
      return o[url].h;
    }
    return null;
  }

  function putCache(url, html) {
    MEM.set(url, { h: html, ts: Date.now() });
    memTrim();
    ssPut(url, html);
  }

  /* ── URL ──────────────────────────────────────────────────────────── */
  function norm(href) {
    try {
      var u = new URL(href, location.href);
      return u.origin + u.pathname + u.search;
    } catch (e) { return null; }
  }

  function docUrl() { return location.origin + location.pathname + location.search; }

  function isNavigable(a) {
    if (!a || a.hasAttribute('download') || a.dataset.fluxOff !== undefined) return false;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return false;
    if (/^(javascript|mailto|tel|sms|data|blob):/i.test(href)) return false;
    var u;
    try { u = new URL(a.href); } catch (e) { return false; }
    if (u.origin !== location.origin) return false;
    if (/\.pdf$/i.test(u.pathname)) return false;   /* liens PDF bruts : natif */
    if (u.pathname.indexOf('/api/') === 0) return false;
    return true;
  }

  /* ── Barre de progression (style auto-injecté, survit aux échanges) ── */
  function ensureChrome() {
    if (!document.getElementById('flux-style')) {
      var st = document.createElement('style');
      st.id = 'flux-style';
      st.textContent =
        '#flux-bar{position:fixed;top:0;left:0;height:3px;width:0;z-index:2147483647;' +
        'background:linear-gradient(90deg,#D4AF37,#F5D97A);border-radius:0 2px 2px 0;' +
        'opacity:0;transition:width .18s ease,opacity .25s ease;pointer-events:none}' +
        '#flux-bar.on{opacity:1}' +
        '@media (prefers-reduced-motion:reduce){#flux-bar{transition:none}}';
      (document.head || document.documentElement).appendChild(st);
    }
    if (!document.getElementById('flux-bar') && document.body) {
      var b = document.createElement('div');
      b.id = 'flux-bar';
      document.body.appendChild(b);
    }
  }

  function bar(on) {
    var b = document.getElementById('flux-bar');
    if (!b) return;
    if (on) {
      b.style.width = '0';
      b.classList.add('on');
      requestAnimationFrame(function () { b.style.width = '72%'; });
    } else {
      b.style.width = '100%';
      setTimeout(function () { b.classList.remove('on'); b.style.width = '0'; }, 220);
    }
  }

  /* ── Intervalles de page : purgés à chaque changement ─────────────── */
  var pageIntervals = new Set();
  var _setInterval = window.setInterval.bind(window);
  var _clearInterval = window.clearInterval.bind(window);
  window.setInterval = function (fn, ms) {
    var id = _setInterval(fn, ms);
    pageIntervals.add(id);
    return id;
  };

  function killPageIntervals() {
    pageIntervals.forEach(function (id) { try { _clearInterval(id); } catch (e) {} });
    pageIntervals.clear();
  }

  /* ── Ré-exécution des scripts ─────────────────────────────────────── */
  /* Scripts du HEAD du nouveau document : nodes détachés → on crée des
     <script> neufs connectés au head vivant (l'exécution suit l'ordre).
     Les nœuds restent dans le head (les retirer n'annule pas l'exécution
     et les scripts partagés sont idempotents). */
  function runHeadScripts(doc) {
    var list = Array.prototype.slice.call(doc.head.querySelectorAll('script'));
    list.forEach(function (old) {
      var s = document.createElement('script');
      for (var i = 0; i < old.attributes.length; i++) {
        var at = old.attributes[i];
        s.setAttribute(at.name, at.value);
      }
      if (!old.src) s.textContent = old.textContent;
      document.head.appendChild(s);
    });
  }

  /* Scripts du BODY : ils sont déjà connectés (innerHTML ne les exécute
     pas) → on remplace chaque nœud par un jumeau neuf, dans l'ordre. */
  function runBodyScripts() {
    var list = Array.prototype.slice.call(document.body.querySelectorAll('script'));
    list.forEach(function (old) {
      var s = document.createElement('script');
      for (var i = 0; i < old.attributes.length; i++) {
        var at = old.attributes[i];
        s.setAttribute(at.name, at.value);
      }
      if (!old.src) s.textContent = old.textContent;
      old.parentNode.insertBefore(s, old);
      old.parentNode.removeChild(old);
    });
  }

  /* ── L'échange de page ────────────────────────────────────────────── */
  function swap(url, html, opts) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    opts = opts || {};

    if (doc.title) document.title = doc.title;
    var lang = doc.documentElement.getAttribute('lang');
    if (lang) document.documentElement.setAttribute('lang', lang);

    /* Stylesheets manquantes → ajoutées au head vivant avant l'échange */
    var liveStyles = new Set();
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
      try { liveStyles.add(new URL(l.getAttribute('href'), location.href).href); } catch (e) {}
    });
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) {
      var href;
      try { href = new URL(l.getAttribute('href'), location.href).href; } catch (e) { return; }
      if (!liveStyles.has(href)) document.head.appendChild(l.cloneNode(true));
    });

    var reduce = false;
    try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    var doSwap = function () {
      /* 1. purger la page sortante AVANT de démarrer la nouvelle */
      killPageIntervals();

      /* 2. styles de page : ceux du head courant (hors routeur) partent,
            ceux du nouveau document arrivent */
      document.querySelectorAll('head > style').forEach(function (s) {
        if (s.id === 'flux-style') return;
        s.remove();
      });
      doc.querySelectorAll('head > style').forEach(function (s) {
        document.head.appendChild(s.cloneNode(true));
      });

      /* 3. body : attributs + contenu */
      var nb = doc.body, ob = document.body;
      Array.prototype.slice.call(ob.attributes).forEach(function (a) { ob.removeAttribute(a.name); });
      Array.prototype.slice.call(nb.attributes).forEach(function (a) { ob.setAttribute(a.name, a.value); });
      ob.innerHTML = nb.innerHTML;

      /* 4. scripts : head du nouveau document, puis body (ordre fidèle) */
      runHeadScripts(doc);
      runBodyScripts();

      /* 5. chrome du routeur */
      ensureChrome();

      /* 6. position de lecture */
      if (opts.pop) {
        window.scrollTo(0, (opts.scroll !== undefined) ? opts.scroll : 0);
      } else if (location.hash) {
        var el = null;
        try { el = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
        if (el && el.scrollIntoView) el.scrollIntoView();
        else window.scrollTo(0, 0);
      } else {
        window.scrollTo(0, 0);
      }
    };

    var t0 = performance.now();
    FLUX.navs++;
    if (!reduce && document.startViewTransition) {
      try { document.startViewTransition(doSwap); }
      catch (e) { doSwap(); }
    } else {
      doSwap();
    }
    FLUX.lastMs = Math.round(performance.now() - t0);

    /* observateurs de prefetch + signal aux modules du site */
    prefetchObserve();
    try {
      document.dispatchEvent(new CustomEvent('flux:navigated', { detail: { url: url, ms: FLUX.lastMs } }));
    } catch (e) {}
  }

  /* ── Navigation ───────────────────────────────────────────────────── */
  var currentAbort = null;

  function saveScroll() {
    try { history.replaceState({ __fluxScroll: window.scrollY }, '', location.href); } catch (e) {}
  }

  function pushUrl(url) {
    try { history.pushState({ __flux: 1 }, '', url); } catch (e) { window.location.href = url; }
  }

  function go(href, opts) {
    opts = opts || {};
    var url = norm(href);
    if (!url) return;

    /* même document + force = popstate hash : comportement natif */
    if (url === docUrl() && !opts.force) return;

    /* annule une récupération réseau en cours (le dernier clic gagne) */
    if (currentAbort) { try { currentAbort.abort(); } catch (e) {} currentAbort = null; }

    var cached = getCached(url);
    if (cached) {
      FLUX.hits++;
      if (!opts.pop) { saveScroll(); pushUrl(url); }
      swap(url, cached, { pop: opts.pop, scroll: opts.scroll });
      return;
    }

    currentAbort = new AbortController();
    var myAbort = currentAbort;
    var barTimer = setTimeout(function () { bar(true); }, BAR_DELAY);

    fetch(url, {
      credentials: 'same-origin',
      signal: myAbort.signal,
      headers: { 'Accept': 'text/html' }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (html) {
      clearTimeout(barTimer);
      bar(false);
      if (myAbort.signal.aborted) return;
      putCache(url, html);
      if (!opts.pop) { saveScroll(); pushUrl(url); }
      swap(url, html, { pop: opts.pop, scroll: opts.scroll });
    }).catch(function (err) {
      clearTimeout(barTimer);
      bar(false);
      if (err && err.name === 'AbortError') return;
      /* repli : navigation classique (404, réseau coupé sans cache…) */
      window.location.href = href;
    });
  }

  /* ── Interception des clics ───────────────────────────────────────── */
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented) return;
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var t = ev.target;
    var a = t && t.closest ? t.closest('a[href]') : null;
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (!isNavigable(a)) return;
    var url = norm(a.href);
    if (!url) return;
    ev.preventDefault();
    if (url === docUrl() && (a.getAttribute('href') || '').indexOf('#') !== -1) {
      return; /* ancre de la page courante : natif */
    }
    saveScroll();
    go(url, {});
  }, false);

  /* ── Précédent / suivant instantanés ─────────────────────────────── */
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  window.addEventListener('popstate', function (ev) {
    var url = norm(location.href);
    if (!url) return;
    go(url, { pop: true, force: true, scroll: (ev.state && ev.state.__fluxScroll) || 0 });
  });

  /* ── Prefetch : survol → visibles → tout le site en fond ──────────── */
  var queue = [];
  var queued = new Set();
  var inflight = 0;

  function isSlow() {
    try {
      var c = navigator.connection;
      if (!c) return false;
      if (c.saveData) return true;
      return /2g$/i.test(c.effectiveType || '');
    } catch (e) { return false; }
  }

  function enqueue(url, front) {
    if (!url || queued.has(url) || MEM.has(url)) return;
    var o = ssAll();
    if (o[url] && o[url].h) return;
    queued.add(url);
    if (front) queue.unshift(url); else queue.push(url);
    pump();
  }

  function pump() {
    while (inflight < PREFETCH_CONCURRENCY && queue.length) {
      var url = queue.shift();
      if (MEM.has(url)) { queued.delete(url); continue; }
      inflight++;
      fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'text/html' } })
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (html) { if (html) putCache(url, html); })
        .catch(function () {})
        .then(function () { inflight--; queued.delete(url); setTimeout(pump, 60); });
    }
  }

  function prefetchObserve() {
    if (isSlow() || !document.body) return;
    /* 1. liens visibles (proche du viewport) */
    try {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var u = norm(en.target.href);
          if (u && u !== docUrl()) enqueue(u, false);
          io.unobserve(en.target);
        });
      }, { rootMargin: '600px' });
      document.body.querySelectorAll('a[href]').forEach(function (a) {
        if (isNavigable(a)) io.observe(a);
      });
    } catch (e) {}

    /* 2. crawl complet en tâche de fond : toutes les pages internes */
    setTimeout(function () {
      if (isSlow()) return;
      var seen = {};
      document.body.querySelectorAll('a[href]').forEach(function (a) {
        if (!isNavigable(a)) return;
        var u = norm(a.href);
        if (u && !seen[u]) { seen[u] = 1; enqueue(u, false); }
      });
    }, IDLE_CRAWL_DELAY);
  }

  /* survol / focus : priorité haute */
  var hoverTimer = null;
  document.addEventListener('mouseover', function (ev) {
    var t = ev.target;
    var a = t && t.closest ? t.closest('a[href]') : null;
    if (!a || !isNavigable(a)) return;
    if (hoverTimer) clearTimeout(hoverTimer);
    var url = norm(a.href);
    hoverTimer = setTimeout(function () { if (url) enqueue(url, true); }, 70);
  }, { passive: true });
  document.addEventListener('focusin', function (ev) {
    var t = ev.target;
    var a = t && t.closest ? t.closest('a[href]') : null;
    if (a && isNavigable(a)) { var u = norm(a.href); if (u) enqueue(u, true); }
  }, { passive: true });

  /* ── Démarrage ────────────────────────────────────────────────────── */
  function boot() {
    ensureChrome();
    prefetchObserve();
    try { document.dispatchEvent(new CustomEvent('flux:ready')); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
