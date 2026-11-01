// api/health.js
// ✅ Diagnostic de configuration — ajouté le 2026-10-26
// Permet de vérifier en un coup d'œil (sans accès aux logs Vercel) que
// toutes les variables d'environnement critiques sont présentes et que
// Firebase admin fonctionne réellement.
// Aucune donnée sensible n'est exposée : uniquement des booléens.

function resolveSiteUrl(req) {
  const envOrigin = (process.env.APP_ORIGIN || '').trim().replace(/\/+$/, '');
  if (envOrigin) return envOrigin.startsWith('http') ? envOrigin : `https://${envOrigin}`;
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : 'https://arvexaschool.vercel.app';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', resolveSiteUrl(req));
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const checks = {
    firebaseAdminCredentials: !!(process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT),
    saspayApiKey: !!process.env.SASPAY_API_KEY,
    saspayWebhookSecret: !!process.env.SASPAY_WEBHOOK_SECRET,
    groqKey: !!process.env.GROQ_API_KEY,
    openrouterKey: !!process.env.OPENROUTER_API_KEY,
    mistralKey: !!process.env.MISTRAL_API_KEY
  };

  // Test réel d'initialisation de Firebase admin (même logique que les API)
  let firebaseWorks = false;
  let firebaseError = null;
  if (checks.firebaseAdminCredentials) {
    try {
      const { initializeApp, cert, getApps } = await import('firebase-admin/app');
      const raw = (process.env.FIREBASE_ADMIN_CREDENTIALS
               || process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
      let sa;
      try { sa = JSON.parse(raw); }
      catch (e) { sa = JSON.parse(raw.replace(/\\n/g, '\n')); }
      if (!sa || !sa.project_id || !sa.private_key || !sa.client_email) {
        throw new Error('incomplete');
      }
      if (!getApps().length) initializeApp({ credential: cert(sa) });
      const { getFirestore } = await import('firebase-admin/firestore');
      getFirestore();
      firebaseWorks = true;
    } catch (e) {
      firebaseError = e.message || 'unknown';
    }
  } else {
    firebaseError = 'FIREBASE_ADMIN_CREDENTIALS absente';
  }

  const allCriticalOk = checks.firebaseAdminCredentials && checks.saspayApiKey
    && checks.saspayWebhookSecret && firebaseWorks;

  // ✅ v2 — Banc d'essai RÉEL de chaque fournisseur IA (?providers=1).
  // Un ping minimal (16 tokens) par fournisseur : ok, latence, message d'erreur.
  let providers = null;
  if ((req.query && req.query.providers) || String(req.url || '').includes('providers=1')) {
    const probe = async (endpoint, model, key, extraHeaders) => {
      if (!key) return { configured: false };
      const t0 = Date.now();
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 15000);
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'User-Agent': 'ARVEXA-School/1.0 (health probe)',
            ...(extraHeaders || {})
          },
          body: JSON.stringify({
            model,
            max_tokens: 220,
            messages: [{ role: 'user', content: 'Réponds uniquement : OK' }]
          }),
          signal: ctrl.signal
        });
        const raw = await r.text();
        let d = null;
        try { d = JSON.parse(raw); } catch (e) {}
        if (!r.ok) {
          const msg = (d && d.error && d.error.message) || `HTTP ${r.status} — corps : ${raw.slice(0, 160)}`;
          return { configured: true, ok: false, status: r.status, error: msg, ms: Date.now() - t0 };
        }
        const msg0 = (d && d.choices && d.choices[0] && d.choices[0].message) || {};
        const content = String(msg0.content || '').trim();
        const hasReasoning = Boolean(msg0.reasoning || (d.choices[0] && d.choices[0].finish_reason));
        return {
          configured: true,
          ok: content.length > 0,
          contentPreview: content.slice(0, 24) || '(vide)',
          finishReason: (d.choices && d.choices[0] && d.choices[0].finish_reason) || null,
          ms: Date.now() - t0,
          _dbg: content.length > 0 ? undefined : (hasReasoning ? 'content vide mais finish_reason présent' : raw.slice(0, 120))
        };
      } catch (e) {
        return { configured: true, ok: false, error: e.name === 'AbortError' ? 'timeout 15s' : (e.message || 'erreur réseau'), ms: Date.now() - t0 };
      } finally { clearTimeout(to); }
    };
    const candidates = [process.env.MISTRAL_MODEL, 'mistral-small-latest', 'open-mistral-nemo', 'ministral-8b-latest']
      .filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
    const mistralResults = {};
    for (const model of candidates) {
      mistralResults[model] = await probe('https://api.mistral.ai/v1/chat/completions', model, process.env.MISTRAL_API_KEY);
      if (mistralResults[model].ok) break;
    }
    providers = {
      groq: await probe('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_MODEL || 'openai/gpt-oss-120b', process.env.GROQ_API_KEY),
      openrouter: await probe('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b', process.env.OPENROUTER_API_KEY, {
        'HTTP-Referer': (process.env.APP_ORIGIN || '').startsWith('http') ? process.env.APP_ORIGIN : 'https://arvexaschool.vercel.app',
        'X-Title': 'ARVEXA Notebook'
      }),
      mistral: mistralResults
    };
  }

  return res.status(200).json({
    ok: allCriticalOk,
    time: new Date().toISOString(),
    firebase: { works: firebaseWorks, error: firebaseError },
    env: checks,
    models: {
      groq: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      openrouter: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b',
      mistral: process.env.MISTRAL_MODEL || 'open-mistral-nemo'
    },
    providers
  });
}
