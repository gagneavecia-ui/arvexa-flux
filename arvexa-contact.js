/* ═══════════════════════════════════════════════════════════════
   ARVEXA — NUMÉRO DE CONTACT / WHATSAPP  (SOURCE UNIQUE — v6.6)
   ═══════════════════════════════════════════════════════════════
   👉 POUR CHANGER DE NUMÉRO : modifie UNIQUEMENT les 2 lignes
      ci-dessous, puis redéploie. AUCUN autre fichier à toucher :
      tous les liens WhatsApp (wa.me), les liens tel: et les textes
      marqués [data-contact-phone] sont mis à jour automatiquement
      sur toutes les pages qui chargent ce fichier.
   ⚠️ Les QR codes de paiement (mynita_qr.png, amanata_qr.png) ne
      sont PAS touchés par ce fichier : régénère-les depuis les
      applications Mynita / Amanata si le numéro de paiement change. */
(function(){
'use strict';
var CONTACT = {
  phoneDisplay: '+227 74 87 20 82',  /* ← numéro affiché aux élèves */
  phoneRaw: '22774872082',           /* ← numéro brut (liens wa.me / tel:) */
  whatsappGroupUrl: ''               /* ← lien d'invitation du GROUPE WhatsApp (chat.whatsapp.com/…). Vide = le bouton « Rejoindre le groupe » ouvre la discussion support. */
};
window.ARVEXA_CONTACT = CONTACT;

function applyContact(){
  try {
    /* 1. Tous les liens WhatsApp → numéro courant (préserve ?text=…) */
    var wa = document.querySelectorAll('a[href*="wa.me"]');
    for (var i = 0; i < wa.length; i++) {
      var a = wa[i];
      var old = a.getAttribute('href') || '';
      var idx = old.indexOf('?');
      var q = idx > -1 ? old.substring(idx) : '';
      a.setAttribute('href', 'https://wa.me/' + CONTACT.phoneRaw + q);
    }
    /* 2. Liens téléphone tel: */
    var tels = document.querySelectorAll('a[href^="tel:"]');
    for (var j = 0; j < tels.length; j++) {
      tels[j].setAttribute('href', 'tel:+' + CONTACT.phoneRaw);
    }
    /* 3. Textes affichés marqués data-contact-phone */
    var els = document.querySelectorAll('[data-contact-phone]');
    for (var k = 0; k < els.length; k++) {
      els[k].textContent = CONTACT.phoneDisplay;
    }
  } catch (e) { /* silencieux : ne jamais bloquer la page */ }
}

/* Script chargé en <head> → DOM en cours de chargement */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyContact);
} else {
  applyContact();
}
/* Relançable après une injection dynamique : ARVEXA_APPLY_CONTACT() */
window.ARVEXA_APPLY_CONTACT = applyContact;
})();
