/* ============================================================
   ARVEXA Wake Lock v1.0 — Task 27
   Écran maintenu allumé pendant les générations IA afin que la
   mise en veille du téléphone ne coupe plus la connexion serveur.

   - API Screen Wake Lock native (Android Chrome 84+, iOS Safari 16.4+)
   - Repli : vidéo muette en boucle (technique NoSleep, MP4 H.264
     baseline 1,6 Ko embarqué) pour les navigateurs plus anciens
   - Compteur de références par tag : plusieurs générations qui se
     chevauchent ne s'éteignent pas mutuellement
   - Ré-acquisition automatique au retour sur l'onglet (le navigateur
     relâche le verrou quand la page passe en arrière-plan)
   - Aucune fuite : tout acquire() a son release() garanti (finally)
   ============================================================ */
(function (global) {
  'use strict';
  if (global.ARVEXAWakeLock) return;

  var TAGS = {};              // tag -> nb d'acquisitions actives
  var nativeLock = null;      // WakeLockSentinel partagé
  var fallbackVideo = null;   // <video> de repli
  var fallbackOn = false;     // repli vidéo en cours d'utilisation
  var pendingEnsure = null;   // acquisition en cours (dédupliquée)

  function anyHeld() {
    for (var t in TAGS) { if (TAGS[t] > 0) return true; }
    return false;
  }
  function nativeSupported() {
    return !!(global.navigator && global.navigator.wakeLock &&
              typeof global.navigator.wakeLock.request === 'function');
  }
  function log() {
    try { console.info.apply(console, ['[WakeLock]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  // --- Repli vidéo (technique NoSleep simplifiée) ---
  var FALLBACK_MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAANCbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAABkAAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAm10cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAABkAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAACAAAAAgAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAZAAAAAAAABAAAAAAHlbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABkG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAVBzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAACAAIABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAe/+EAFmdCwB7ZCWwEQAAAAwBAAAADAoPFi5IBAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAA3yAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAIAAAIAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAIAAAAAQAAADRzdHN6AAAAAAAAAAAAAAAIAAAChQAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAkAAAAUc3RjbwAAAAAAAAABAAADcgAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjEuNy4xMDMAAAAIZnJlZQAAAtJtZGF0AAACcAYF//9s3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCAzMWUxOWY5IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MToweDExMSBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0wIHdlaWdodHA9MCBrZXlpbnQ9MjUwIGtleWludF9taW49NSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAA1liIQEfJigADYjJ114AAAABkGaOAj5YAAAAAZBmlQCPlgAAAAGQZpgEfLAAAAABkGagBHywAAAAAZBmqAR8sAAAAAGQZrAEPLAAAAABUGa4D/L';
  function startFallback() {
    if (fallbackVideo) return playFallback();
    var v;
    try {
      v = global.document.createElement('video');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('muted', '');
      v.muted = true; v.loop = true; v.preload = 'auto';
      v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0.001;pointer-events:none;z-index:-1;top:0;left:0;';
      v.src = FALLBACK_MP4;
      (global.document.body || global.document.documentElement).appendChild(v);
      fallbackVideo = v;
    } catch (e) { return Promise.resolve(false); }
    return playFallback();
  }
  function playFallback() {
    var v = fallbackVideo;
    if (!v) return Promise.resolve(false);
    var p;
    try { p = v.play(); } catch (e) { return Promise.resolve(false); }
    if (p && typeof p.then === 'function') {
      return p.then(function () { return true; }).catch(function () { return false; });
    }
    return Promise.resolve(!v.paused);
  }
  function stopFallback() {
    var v = fallbackVideo;
    if (!v) return;
    try { v.pause(); } catch (e) {}
    try { if (v.parentNode) v.parentNode.removeChild(v); } catch (e) {}
    fallbackVideo = null;
  }

  // --- Acquisition d'une instance de verrou (partagée) ---
  function ensureLock() {
    if (pendingEnsure) return pendingEnsure;
    pendingEnsure = acquireInternal().then(function (ok) {
      pendingEnsure = null;
      return ok;
    }, function () {
      pendingEnsure = null;
      return false;
    });
    return pendingEnsure;
  }
  function acquireInternal() {
    if (nativeSupported()) {
      return global.navigator.wakeLock.request('screen').then(function (sentinel) {
        nativeLock = sentinel;
        try {
          sentinel.addEventListener('release', function () {
            if (nativeLock === sentinel) nativeLock = null;
            // Verrou repris par le système (économie batterie) pendant
            // qu'une génération tourne : on re-demande une fois.
            if (anyHeld() && !fallbackOn &&
                global.document.visibilityState === 'visible') {
              setTimeout(function () {
                if (anyHeld() && !API.active()) ensureLock();
              }, 500);
            }
          });
        } catch (e) {}
        // Course acquire/release avant résolution : on libère si plus besoin
        if (!anyHeld()) { releaseInternal(); return true; }
        log('écran maintenu allumé (natif)');
        return true;
      }).catch(function (err) {
        log('verrou natif refusé (' + (err && err.name) + ') → repli vidéo');
        return startFallback().then(function (ok) {
          fallbackOn = !!ok;
          if (!anyHeld() && ok) { stopFallback(); fallbackOn = false; return false; }
          if (ok) log('écran maintenu allumé (repli vidéo)');
          return ok;
        });
      });
    }
    return startFallback().then(function (ok) {
      fallbackOn = !!ok;
      if (ok) log('écran maintenu allumé (repli vidéo, API native absente)');
      else log('maintien de l\'écran indisponible sur ce navigateur');
      return ok;
    });
  }
  function releaseInternal() {
    if (nativeLock) {
      var s = nativeLock;
      nativeLock = null;
      try { s.release(); } catch (e) {}
      log('verrou relâché');
    }
    if (fallbackVideo) stopFallback();
    fallbackOn = false;
  }

  // --- API publique ---
  var API = {
    supported: function () { return nativeSupported(); },
    acquire: function (tag) {
      tag = tag || 'default';
      TAGS[tag] = (TAGS[tag] || 0) + 1;
      if (nativeLock || fallbackOn || pendingEnsure) return; // déjà actif / en cours
      ensureLock();
    },
    release: function (tag) {
      tag = tag || 'default';
      if (TAGS[tag]) TAGS[tag]--;
      if (!anyHeld()) releaseInternal();
    },
    isHeld: function (tag) {
      if (tag) return TAGS[tag] > 0;
      return anyHeld();
    },
    active: function () { return !!(nativeLock || fallbackOn); }
  };

  // Le navigateur relâche le verrou quand la page est cachée :
  // on ré-acquiert dès le retour sur l'onglet si une génération tourne.
  if (global.document && global.document.addEventListener) {
    global.document.addEventListener('visibilitychange', function () {
      if (global.document.visibilityState === 'visible' &&
          anyHeld() && !API.active()) {
        log('retour sur l\'onglet → ré-acquisition du verrou');
        ensureLock();
      }
    });
  }
  // Nettoyage de confort quand la page est quittée
  if (global.addEventListener) {
    global.addEventListener('pagehide', function () { releaseInternal(); });
  }

  global.ARVEXAWakeLock = API;
})(typeof window !== 'undefined' ? window : this);
