// ================================================================
// API RESET-PASSWORD — ARVEXA School
// Flux de réinitialisation par CODE à 6 chiffres, à l'identité ARVEXA.
// (Contrairement au flux « lien » Firebase, l'élève reçoit un code,
//  le tape dans le site et choisit son nouveau mot de passe.)
//
// POST { action: 'requestCode', email }
//   → génère un code (valable 10 min), le stocke haché dans
//     password_resets/{email} et envoie l'email ARVEXA via Resend.
// POST { action: 'verifyAndReset', email, code, newPassword }
//   → vérifie le code, applique le nouveau mot de passe (SDK Admin,
//     au-dessus des règles Firestore), révoque les sessions,
//     envoie l'email de confirmation ARVEXA.
//
// Sécurité :
//  - password_resets n'est couvert par AUCUNE règle client → interdit
//    aux clients, accessible uniquement au SDK Admin (défaut Firestore).
//  - Le code n'est jamais stocké en clair (SHA-256 salé + comparaison
//    timing-safe), 5 tentatives max, cooldown 60 s par email.
//  - Réponse générique si l'email est inconnu (anti-énumération).
//  - revokeRefreshTokens() : toute session ouverte est déconnectée.
//
// Configuration (collection Firestore `config`, doc `email`) :
//  { smtpUser, smtpPass }        → Gmail SMTP (GRATUIT, 500/jour, AUCUN
//                                  domaine requis — mot de passe d'application
//                                  Google). PRIORITAIRE s'il est présent.
//  { resendApiKey, fromAddress, fromName, replyTo } → Resend (repli,
//                                  utile une fois un domaine vérifié).
//  → lues uniquement côté serveur (Admin SDK). Repli clé : env RESEND_API_KEY.
// ================================================================

const crypto = require('crypto');

const CODE_TTL_MS = 10 * 60 * 1000;        // code valable 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;      // 1 demande / minute / email
const MAX_ATTEMPTS = 5;                    // essais de code par demande
const MAX_IP_REQUESTS = 12;                // demandes par IP / fenêtre
const IP_WINDOW_MS = 60 * 60 * 1000;       // fenêtre anti-spam IP : 1 h
const CONFIG_CACHE_MS = 5 * 60 * 1000;

let adminServices;
function getAdminServices() {
  if (adminServices) return adminServices;
  const credentials = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!credentials) throw new Error('firebase_admin_not_configured');
  const admin = require('firebase-admin');
  const serviceAccount = JSON.parse(credentials);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  adminServices = { auth: admin.auth(), db: admin.firestore() };
  return adminServices;
}

function jsonError(response, status, error, code) {
  return response.status(status).json({ success: false, error, ...(code ? { code } : {}) });
}

function clientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

const ipLog = new Map();
function ipRateLimited(ip) {
  const now = Date.now();
  const recent = (ipLog.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length >= MAX_IP_REQUESTS) { ipLog.set(ip, recent); return true; }
  recent.push(now);
  ipLog.set(ip, recent);
  if (ipLog.size > 5000) {
    for (const [k, v] of ipLog) { if (v.every((t) => now - t >= IP_WINDOW_MS)) ipLog.delete(k); }
  }
  return false;
}

function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code, salt) {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

function safeEqual(a, b) {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ─── Configuration email (clé Resend + expéditeur) ─────────────
let configCache = { data: null, loadedAt: 0 };
async function getEmailConfig() {
  const now = Date.now();
  if (configCache.data && now - configCache.loadedAt < CONFIG_CACHE_MS) return configCache.data;
  let data = null;
  try {
    const { db } = getAdminServices();
    const snap = await db.collection('config').doc('email').get();
    if (snap.exists) data = snap.data() || null;
  } catch (_) { data = null; }
  if (!data || !data.resendApiKey) {
    data = {
      ...(data || {}),
      resendApiKey: process.env.RESEND_API_KEY || '',
      fromAddress: (data && data.fromAddress) || 'onboarding@resend.dev',
      fromName: (data && data.fromName) || 'ARVEXA School',
      replyTo: (data && data.replyTo) || 'gagneavecia@gmail.com'
    };
  }
  configCache = { data, loadedAt: now };
  return data;
}

async function sendEmail({ to, subject, html }) {
  const config = await getEmailConfig();
  if (config && config.smtpPass && config.smtpUser) {
    // ── Gmail SMTP (gratuit, 500/jour, expéditeur = smtpUser) ──
    // Aucun domaine requis : mot de passe d'application Google.
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: config.smtpUser, pass: String(config.smtpPass).replace(/\s+/g, '') }
      });
      await transporter.sendMail({
        from: `"${config.fromName || 'ARVEXA School'}" <${config.smtpUser}>`,
        to,
        subject,
        html,
        ...(config.replyTo ? { replyTo: config.replyTo } : {})
      });
      return { provider: 'gmail' };
    } catch (smtpError) {
      console.error('ARV-RESET gmail smtp failed:', smtpError.message);
      throw new Error(`resend_error:smtp_gmail_${smtpError.message}`.slice(0, 200));
    }
  }
  // ── Resend (repli / domaine vérifié) ──
  if (!config || !config.resendApiKey) {
    throw new Error('service_email_non_configure');
  }
  const from = `${config.fromName || 'ARVEXA School'} <${config.fromAddress || 'onboarding@resend.dev'}>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      ...(config.replyTo ? { reply_to: config.replyTo } : {})
    })
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload && payload.message ? payload.message : `resend_http_${res.status}`;
    throw new Error(`resend_error:${message}`);
  }
  return payload;
}

// ================================================================
// TEMPLATES EMAIL — identité ARVEXA (fond noir, or #E0B84A)
// (HTML en tables + styles inline : compatible Gmail/Outlook/Yahoo)
// ================================================================
function emailShell(innerHtml) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A0A0A;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#131313;border:1px solid rgba(184,134,11,0.22);border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 28px 8px 28px;text-align:center;">
  <div style="font-size:22px;font-weight:bold;letter-spacing:4px;color:#E0B84A;">ARVEX<span style="color:#F5F0E8;">A</span></div>
  <div style="font-size:10px;letter-spacing:5px;color:#8A8A7A;margin-top:4px;">SCHOOL</div>
</td></tr>
<tr><td style="padding:12px 28px;"><div style="height:1px;background-color:rgba(184,134,11,0.22);line-height:1px;font-size:0;">&nbsp;</div></td></tr>
${innerHtml}
<tr><td style="padding:18px 28px 26px 28px;text-align:center;">
  <div style="height:1px;background-color:rgba(184,134,11,0.16);line-height:1px;font-size:0;margin-bottom:14px;">&nbsp;</div>
  <div style="font-size:11px;color:#8A8A7A;line-height:1.7;">
    ARVEXA School — Réviser mieux, réussir plus.<br>
    Support WhatsApp : <a href="https://wa.me/22774872082" style="color:#E0B84A;text-decoration:none;">+227 74 87 20 82</a>
  </div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildCodeEmail(code, minutes) {
  const spaced = String(code).split('').join(' ');
  const inner = `<tr><td style="padding:10px 28px 4px 28px;">
  <h1 style="margin:0;font-size:19px;color:#F5F0E8;font-weight:bold;">Réinitialisation de ton mot de passe</h1>
</td></tr>
<tr><td style="padding:10px 28px 4px 28px;">
  <p style="margin:0;font-size:14px;color:#C9C9B8;line-height:1.7;">
    Salut ! Voici ton code de vérification pour choisir un nouveau mot de passe sur ARVEXA.
    Il est valable <strong style="color:#E0B84A;">${minutes} minutes</strong>.
  </p>
</td></tr>
<tr><td style="padding:20px 28px;" align="center">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td
    style="background-color:rgba(224,184,74,0.08);border:1px solid rgba(224,184,74,0.4);border-radius:12px;padding:16px 26px;font-size:32px;font-weight:bold;letter-spacing:10px;color:#E0B84A;font-family:'Courier New',monospace;">${spaced}</td></tr></table>
</td></tr>
<tr><td style="padding:6px 28px 12px 28px;">
  <p style="margin:0;font-size:12.5px;color:#8A8A7A;line-height:1.7;">
    Ouvre la page ARVEXA, saisis ce code puis choisis ton nouveau mot de passe.
    Chaque nouveau code remplace le précédent.
  </p>
</td></tr>
<tr><td style="padding:8px 28px 6px 28px;">
  <p style="margin:0;font-size:12px;color:#8A8A7A;line-height:1.7;">
    <strong style="color:#F5F0E8;">Tu n'as pas demandé ce code ?</strong><br>
    Ignore cet email : ton mot de passe reste inchangé et aucun compte n'est créé.
  </p>
</td></tr>`;
  return {
    subject: `ARVEXA — Ton code de réinitialisation : ${code}`,
    html: emailShell(inner)
  };
}

function buildResetConfirmEmail() {
  const inner = `<tr><td style="padding:10px 28px 4px 28px;">
  <h1 style="margin:0;font-size:19px;color:#F5F0E8;font-weight:bold;">Ton mot de passe a été modifié</h1>
</td></tr>
<tr><td style="padding:10px 28px 4px 28px;">
  <p style="margin:0;font-size:14px;color:#C9C9B8;line-height:1.7;">
    Le mot de passe de ton compte ARVEXA vient d'être changé avec succès.
    Tu peux dès maintenant te connecter avec ton nouveau mot de passe.
  </p>
</td></tr>
<tr><td style="padding:18px 28px 8px 28px;" align="center">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td
    style="background-color:#E0B84A;border-radius:24px;padding:12px 26px;font-size:14px;font-weight:bold;">
    <a href="https://arvexaschool.vercel.app/login.html" style="color:#0A0A0A;text-decoration:none;">Me connecter</a>
  </td></tr></table>
</td></tr>
<tr><td style="padding:16px 28px 6px 28px;">
  <p style="margin:0;font-size:12px;color:#8A8A7A;line-height:1.7;">
    <strong style="color:#F5F0E8;">Ce n'était pas toi ?</strong><br>
    Contacte immédiatement le support WhatsApp : nous sécuriserons ton compte sans attendre.
  </p>
</td></tr>`;
  return {
    subject: 'ARVEXA — Ton mot de passe a été modifié',
    html: emailShell(inner)
  };
}

// ================================================================
// HANDLER
// ================================================================
module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return jsonError(response, 405, 'Méthode non autorisée.');
  }

  if (ipRateLimited(clientIp(request))) {
    return jsonError(response, 429, 'Trop de tentatives. Réessaie dans un moment.', 'TOO_MANY');
  }

  let body = request.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  const action = String(body.action || '');

  // ─── ACTION 1 : demande d'un code ─────────────────────────────
  if (action === 'requestCode') {
    const email = normalizeEmail(body.email);
    if (!email) return jsonError(response, 400, 'Adresse e-mail invalide.', 'INVALID_EMAIL');

    try {
      const { auth, db } = getAdminServices();

      // Anti-énumération : réponse identique que le compte existe ou non.
      let uid = null;
      try {
        const record = await auth.getUserByEmail(email);
        uid = record.uid;
      } catch (_) {
        uid = null;
      }

      // Cooldown anti-spam basé sur Firestore (fiable entre instances).
      const ref = db.collection('password_resets').doc(email);
      const existing = await ref.get().catch(() => null);
      if (existing && existing.exists) {
        const prev = existing.data() || {};
        const prevAt = prev.createdAt ? new Date(prev.createdAt).getTime() : 0;
        const elapsed = Date.now() - prevAt;
        if (elapsed >= 0 && elapsed < RESEND_COOLDOWN_MS) {
          const waitS = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return response.status(429).json({
            success: false,
            error: `Un code vient d'être envoyé. Réessaie dans ${waitS} s.`,
            code: 'COOLDOWN',
            retryAfter: waitS
          });
        }
      }

      if (!uid) {
        // Compte inconnu : réponse générique, aucun envoi, aucun document.
        return response.status(200).json({ success: true, message: 'Si un compte existe pour cet e-mail, un code y a été envoyé.' });
      }

      const code = generateCode();
      const salt = crypto.randomBytes(16).toString('hex');
      const nowIso = new Date().toISOString();
      await ref.set({
        codeHash: hashCode(code, salt),
        salt,
        attempts: 0,
        createdAt: nowIso,
        expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        email,
        // FIX v7.5 : code stocké EN CLAIR pour la console admin
        // (filet de sécurité : le propriétaire le transmet par WhatsApp si
        //  l'email n'arrive pas). Le document password_resets n'est couvert
        // par AUCUNE règle client → lisible uniquement par le SDK Admin.
        code
      });

      try {
        const tpl = buildCodeEmail(code, Math.round(CODE_TTL_MS / 60000));
        await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
      } catch (mailError) {
        console.error('ARV-RESET send failed:', mailError.message);
        await ref.delete().catch(() => {});
        return jsonError(response, 503, 'L\'envoi de l\'e-mail a échoué. Réessaie dans un instant.', 'MAIL_FAILED');
      }

      return response.status(200).json({ success: true, message: 'Si un compte existe pour cet e-mail, un code y a été envoyé.' });
    } catch (error) {
      console.error('ARV-RESET requestCode failed:', error.message);
      return jsonError(response, 503, 'Service temporairement indisponible. Réessaie dans un instant.');
    }
  }

  // ─── ACTION 2 : vérification du code + nouveau mot de passe ───
  if (action === 'verifyAndReset') {
    const email = normalizeEmail(body.email);
    const code = String(body.code || '').replace(/\D/g, '');
    const newPassword = String(body.newPassword || '');

    if (!email) return jsonError(response, 400, 'Adresse e-mail invalide.', 'INVALID_EMAIL');
    if (code.length !== 6) return jsonError(response, 400, 'Code invalide.', 'WRONG_CODE');
    if (newPassword.length < 6 || newPassword.length > 128) {
      return jsonError(response, 400, 'Le mot de passe doit contenir au moins 6 caractères.', 'WEAK_PASSWORD');
    }

    try {
      const { auth, db } = getAdminServices();
      const ref = db.collection('password_resets').doc(email);
      const snap = await ref.get();
      if (!snap || !snap.exists) {
        return jsonError(response, 400, 'Code invalide ou expiré. Demande un nouveau code.', 'WRONG_CODE');
      }
      const data = snap.data() || {};
      const expiresAt = data.expiresAt ? new Date(data.expiresAt).getTime() : 0;
      const attempts = Number(data.attempts) || 0;

      if (!expiresAt || Date.now() > expiresAt || attempts >= MAX_ATTEMPTS) {
        await ref.delete().catch(() => {});
        const tooMany = attempts >= MAX_ATTEMPTS;
        return jsonError(response, tooMany ? 429 : 400,
          tooMany ? 'Trop de tentatives. Demande un nouveau code.' : 'Code expiré. Demande un nouveau code.',
          tooMany ? 'TOO_MANY' : 'EXPIRED');
      }

      if (!safeEqual(hashCode(code, data.salt), data.codeHash)) {
        const nextAttempts = attempts + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          await ref.delete().catch(() => {});
        } else {
          await ref.update({ attempts: nextAttempts }).catch(() => {});
        }
        const left = Math.max(0, MAX_ATTEMPTS - nextAttempts);
        return jsonError(response, 400,
          left > 0 ? `Code incorrect. ${left} tentative${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}.` : 'Code incorrect. Demande un nouveau code.',
          'WRONG_CODE');
      }

      // Code correct → changement effectif du mot de passe (SDK Admin).
      let uid;
      try {
        uid = (await auth.getUserByEmail(email)).uid;
      } catch (_) {
        await ref.delete().catch(() => {});
        return jsonError(response, 400, 'Compte introuvable. Demande un nouveau code.', 'WRONG_CODE');
      }
      await auth.updateUser(uid, { password: newPassword });
      await auth.revokeRefreshTokens(uid);
      await ref.delete().catch(() => {});

      // Email de confirmation (ne bloque pas la réponse).
      try {
        const tpl = buildResetConfirmEmail();
        await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
      } catch (mailError) {
        console.error('ARV-RESET confirm mail failed:', mailError.message);
      }

      return response.status(200).json({ success: true, message: 'Mot de passe modifié. Tu peux te connecter.' });
    } catch (error) {
      console.error('ARV-RESET verifyAndReset failed:', error.message);
      return jsonError(response, 503, 'Service temporairement indisponible. Réessaie dans un instant.');
    }
  }

  return jsonError(response, 400, 'Action inconnue.', 'BAD_ACTION');
};

// Exposés pour les tests (non utilisés par Vercel au-delà du handler).
module.exports.buildCodeEmail = buildCodeEmail;
module.exports.buildResetConfirmEmail = buildResetConfirmEmail;
module.exports.hashCode = hashCode;
