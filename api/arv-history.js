// ================================================================
// API ARV-HISTORY — ARVEXA School
// Liste les conversations de l'élève pour la sidebar
// ================================================================

const WINDOW_MS = 60 * 1000;
// ✅ v4.13 — 30→40/min : endpoint en lecture seule (liste des conversations),
// ne doit jamais bloquer une navigation normale.
const MAX_REQUESTS_PER_WINDOW = 40;
const requestLog = new Map();

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

function clientIp(request) {
  return String(
    request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown'
  ).split(',')[0].trim();
}

function rateLimited(ip) {
  const key = `${ip}|history`;
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requestLog.set(key, recent);
  if (requestLog.size > 5000) {
    for (const [k, v] of requestLog) {
      if (v.every((t) => now - t >= WINDOW_MS)) requestLog.delete(k);
    }
  }
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

async function verifyFirebaseToken(request) {
  const authorization = request.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await getAdminServices().auth.verifyIdToken(match[1]);
  } catch (_) {
    return null;
  }
}

function toISO(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v._seconds !== undefined) return new Date(v._seconds * 1000).toISOString();
  if (v.seconds !== undefined) return new Date(v.seconds * 1000).toISOString();
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return null;
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ success: false, error: 'Méthode non autorisée.' });
  }

  if (rateLimited(clientIp(request))) {
    return response.status(429).json({ success: false, error: 'Service momentanément saturé. Réessaie dans quelques secondes.' });
  }

  let user;
  try {
    user = await verifyFirebaseToken(request);
  } catch (_) {
    user = null;
  }

  if (!user) {
    return response.status(401).json({ success: false, error: 'Connexion requise.' });
  }

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const action = body.action || request.query?.action || 'list';

  try {
    const { db } = getAdminServices();
    const uid = user.uid;

    // ═══ LISTER ═══
    if (action === 'list') {
      const limit = Math.min(30, Number(body.limit) || 20);
      const snap = await db
        .collection('users').doc(uid).collection('conversations')
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();

      const conversations = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || 'Conversation',
          messageCount: Number(data.messageCount || 0),
          createdAt: toISO(data.createdAt),
          updatedAt: toISO(data.updatedAt)
        };
      });

      return response.status(200).json({ success: true, conversations });
    }

    // ═══ CHARGER UNE CONVERSATION ═══
    if (action === 'load') {
      const conversationId = body.conversationId;
      if (!conversationId) {
        return response.status(400).json({ success: false, error: 'conversationId requis.' });
      }

      const convRef = db.collection('users').doc(uid).collection('conversations').doc(conversationId);
      const convSnap = await convRef.get();
      if (!convSnap.exists) {
        return response.status(404).json({ success: false, error: 'Conversation introuvable.' });
      }

      const messagesSnap = await convRef.collection('messages')
        .orderBy('createdAt', 'asc')
        .limit(200)
        .get();

      const messages = messagesSnap.docs.map((d) => {
        const m = d.data();
        return {
          id: d.id,
          role: m.role,
          content: m.content,
          createdAt: toISO(m.createdAt)
        };
      });

      return response.status(200).json({
        success: true,
        conversation: {
          id: conversationId,
          title: convSnap.data().title || 'Conversation'
        },
        messages
      });
    }

    // ═══ SUPPRIMER ═══
    if (action === 'delete') {
      const conversationId = body.conversationId;
      if (!conversationId) {
        return response.status(400).json({ success: false, error: 'conversationId requis.' });
      }

      const convRef = db.collection('users').doc(uid).collection('conversations').doc(conversationId);
      // Supprimer les messages en batch
      const messagesSnap = await convRef.collection('messages').limit(500).get();
      const batch = db.batch();
      messagesSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(convRef);
      await batch.commit();

      return response.status(200).json({ success: true });
    }

    return response.status(400).json({ success: false, error: 'Action inconnue.' });

  } catch (error) {
    console.error('ARV-HISTORY failed:', error.message);
    return response.status(503).json({ success: false, error: 'Service temporairement indisponible.' });
  }
};
