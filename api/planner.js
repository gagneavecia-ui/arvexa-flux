// ================================================================
// API PLANNER v2.0 — ARVEXA School
// Planificateur Premium alimenté par IA
// Cascade : Groq → OpenRouter → Mistral → Fallback local enrichi
// Cache intelligent + invalidation auto si nouvel examen
// ================================================================

const MAX_REQUESTS_PER_WINDOW = 15; // ✅ v4.13 — 12→15 (NAT partagé)
const requestLog = new Map();

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 heures
const PLAN_VERSION = '2.0';

const MIN_ATTEMPTS_FOR_SOLID = 5;
const MIN_ATTEMPTS_FOR_LIMITED = 2;

let adminServices;

// ════════════════════════════════════════════════════════════════
// FIREBASE ADMIN
// ════════════════════════════════════════════════════════════════
function getAdminServices() {
  if (adminServices) return adminServices;
  const credentials = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!credentials) throw new Error('firebase_admin_not_configured');
  const admin = require('firebase-admin');
  const serviceAccount = JSON.parse(credentials);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  adminServices = {
    auth: admin.auth(),
    db: admin.firestore(),
    FieldValue: admin.firestore.FieldValue
  };
  return adminServices;
}

// ════════════════════════════════════════════════════════════════
// UTILITAIRES
// ════════════════════════════════════════════════════════════════
function jsonError(response, status, error, code) {
  return response.status(status).json({ success: false, error, ...(code ? { code } : {}) });
}

function clientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();
}

function rateLimited(ip) {
  const key = `${ip}|planner`;
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((time) => now - time < 60000);
  recent.push(now);
  requestLog.set(key, recent);
  if (requestLog.size > 5000) {
    for (const [k, v] of requestLog) {
      if (v.every((t) => now - t >= 60000)) requestLog.delete(k);
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

function isPremiumUser(data) {
  if (!data) return false;
  const active = data.premium === true || data.isUnlocked === true || data.hasDeposited === true;
  if (!active) return false;
  const end = data.subscriptionEndDate?.toDate?.() ||
    (data.subscriptionEndDate?.seconds ? new Date(data.subscriptionEndDate.seconds * 1000) : null);
  return !end || end.getTime() > Date.now();
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function round2(n) {
  if (n === null || n === undefined || isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function normalizeSubjectKey(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
  const map = {
    mathematiques: 'mathematiques', maths: 'mathematiques', math: 'mathematiques',
    physique: 'physique', physiques: 'physique',
    chimie: 'chimie', svt: 'svt', francais: 'francais', anglais: 'anglais',
    philosophie: 'philosophie', philo: 'philosophie',
    histoire_geo: 'histoire_geo', histoiregeo: 'histoire_geo', eps: 'eps'
  };
  return map[s] || s;
}

const SUBJECT_LABELS = {
  mathematiques: 'Mathématiques', physique: 'Physique', chimie: 'Chimie',
  svt: 'SVT', francais: 'Français', anglais: 'Anglais',
  philosophie: 'Philosophie', histoire_geo: 'Histoire-Géo', eps: 'EPS'
};

const SUBJECT_ICONS = {
  mathematiques: 'fa-square-root-variable', physique: 'fa-bolt', chimie: 'fa-flask',
  svt: 'fa-dna', francais: 'fa-book-open', anglais: 'fa-globe',
  philosophie: 'fa-brain', histoire_geo: 'fa-landmark', eps: 'fa-person-running'
};

const COEFFICIENTS = {
  mathematiques: 5, physique: 3, chimie: 2, svt: 5, francais: 3,
  anglais: 2, philosophie: 2, histoire_geo: 2, eps: 1
};

// ════════════════════════════════════════════════════════════════
// AGRÉGATION
// ════════════════════════════════════════════════════════════════
function aggregateStudentData(results) {
  const totalAttempts = results.length;
  const grouped = new Map();
  let oldestDate = null;
  let newestDate = null;

  results.forEach((entry) => {
    const key = normalizeSubjectKey(entry.subjectKey || entry.subject) || 'autre';
    if (!grouped.has(key)) {
      grouped.set(key, {
        subjectKey: key,
        label: SUBJECT_LABELS[key] || entry.subject || key,
        icon: SUBJECT_ICONS[key] || 'fa-book',
        coefficient: COEFFICIENTS[key] || 1,
        attempts: 0,
        totalScore: 0,
        scores: [],
        weakChapters: [],
        strongChapters: [],
        dates: [],
        exams: []
      });
    }

    const item = grouped.get(key);
    const score = Number(entry.score ?? entry.totalScore ?? 0);
    if (!isNaN(score) && score >= 0 && score <= 20) {
      item.attempts += 1;
      item.totalScore += score;
      item.scores.push(score);
      item.exams.push({
        score,
        date: toDate(entry.date || entry.createdAt),
        title: entry.chapterTitle || entry.examTitle || 'Examen'
      });
    }

    if (Array.isArray(entry.difficulties)) {
      entry.difficulties.forEach((diff) => {
        const s = Number(diff.score || 0);
        const max = Number(diff.maxScore || 5);
        const ratio = max > 0 ? s / max : 0;
        const chapterInfo = {
          number: diff.number,
          score: round2(s),
          maxScore: round2(max),
          ratio: round2(ratio),
          advice: String(diff.advice || '').slice(0, 200)
        };
        if (ratio < 0.5) item.weakChapters.push(chapterInfo);
        else if (ratio >= 0.85) item.strongChapters.push(chapterInfo);
      });
    }

    const date = toDate(entry.date || entry.createdAt);
    if (date) {
      item.dates.push(date.getTime());
      if (!oldestDate || date < oldestDate) oldestDate = date;
      if (!newestDate || date > newestDate) newestDate = date;
    }
  });

  const subjects = [];
  grouped.forEach((item, key) => {
    const average = item.scores.length > 0
      ? round2(item.scores.reduce((a, b) => a + b, 0) / item.scores.length)
      : null;

    // Évolution 30 jours
    let evolution = null;
    if (item.exams.length >= 2) {
      const now = Date.now();
      const cutoff = now - 30 * 24 * 60 * 60 * 1000;
      const recent = item.exams.filter((e) => e.date && e.date.getTime() >= cutoff).map((e) => e.score);
      const previous = item.exams.filter((e) => e.date && e.date.getTime() < cutoff).map((e) => e.score);
      if (recent.length > 0 && previous.length > 0) {
        const avgR = recent.reduce((a, b) => a + b, 0) / recent.length;
        const avgP = previous.reduce((a, b) => a + b, 0) / previous.length;
        evolution = round2(avgR - avgP);
      }
    }

    const dedup = (arr) => {
      const seen = new Set();
      return arr.filter((c) => {
        if (seen.has(c.number)) return false;
        seen.add(c.number);
        return true;
      });
    };
    item.weakChapters = dedup(item.weakChapters).sort((a, b) => a.ratio - b.ratio).slice(0, 6);
    item.strongChapters = dedup(item.strongChapters).slice(0, 4);

    let trend = 'stable';
    if (evolution !== null && evolution > 0.5) trend = 'hausse';
    else if (evolution !== null && evolution < -0.5) trend = 'baisse';

    let priorityScore = 0;
    if (average !== null && average < 12) priorityScore += Math.min(40, (12 - average) * 5);
    if (evolution !== null && evolution < -0.5) priorityScore += 15;
    if (item.weakChapters.length >= 2) priorityScore += 15;
    else if (item.weakChapters.length === 1) priorityScore += 8;
    if (item.attempts >= 3) priorityScore += 3;
    priorityScore = Math.min(100, Math.round(priorityScore));

    let priorityLevel = 'none';
    if (average === null) priorityLevel = 'none';
    else if (priorityScore >= 55) priorityLevel = 'high';
    else if (priorityScore >= 25) priorityLevel = 'medium';
    else priorityLevel = 'low';

    const priorityLabel = {
      high: 'Urgente', medium: 'Importante', low: 'Entretien', none: 'Aucune donnée'
    }[priorityLevel];

    const coef = COEFFICIENTS[key] || 1;
    let baseMinutes = 30;
    if (priorityLevel === 'high') baseMinutes = 120;
    else if (priorityLevel === 'medium') baseMinutes = 60;
    const recommendedMinutes = Math.min(180, baseMinutes * Math.ceil(coef / 3));

    subjects.push({
      subjectKey: key,
      subject: item.label,
      icon: item.icon,
      coefficient: coef,
      attempts: item.attempts,
      averageScore: average,
      evolution,
      trend,
      priority: priorityLabel,
      priorityLevel,
      priorityScore,
      recommendedMinutes,
      weakChapters: item.weakChapters,
      strongChapters: item.strongChapters,
      lastDate: item.dates.length > 0 ? new Date(Math.max(...item.dates)).toISOString() : null
    });
  });

  subjects.sort((a, b) => b.priorityScore - a.priorityScore);

  let totalWeighted = 0;
  let totalCoef = 0;
  subjects.forEach((s) => {
    if (s.averageScore === null) return;
    totalWeighted += s.averageScore * s.coefficient;
    totalCoef += s.coefficient;
  });
  const generalAverage = totalCoef > 0 ? round2(totalWeighted / totalCoef) : null;

  let readinessScore = 0;
  if (generalAverage !== null) readinessScore = (generalAverage / 20) * 60;
  const subjectsWithData = subjects.filter((s) => s.averageScore !== null).length;
  readinessScore += Math.min(20, subjectsWithData * 4);
  const evolutions = subjects.filter((s) => s.evolution !== null);
  if (evolutions.length > 0) {
    const avgEvo = evolutions.reduce((a, b) => a + b.evolution, 0) / evolutions.length;
    readinessScore += Math.min(20, Math.max(-10, avgEvo * 10));
  }
  readinessScore = Math.max(0, Math.min(100, Math.round(readinessScore)));

  let readinessLevel = 'insuffisant';
  let readinessLabel = 'Données insuffisantes';
  if (totalAttempts >= 3 && generalAverage !== null) {
    if (readinessScore >= 75) { readinessLevel = 'solide'; readinessLabel = 'Préparation solide'; }
    else if (readinessScore >= 55) { readinessLevel = 'progressing'; readinessLabel = 'En progression'; }
    else { readinessLevel = 'reinforce'; readinessLabel = 'À renforcer'; }
  }

  let targetScore = 12;
  let targetHorizon = '4 semaines';
  if (generalAverage !== null) {
    if (generalAverage < 8) { targetScore = round2(generalAverage + 2); targetHorizon = '6 semaines'; }
    else if (generalAverage < 11) { targetScore = round2(generalAverage + 1.5); targetHorizon = '4 semaines'; }
    else if (generalAverage < 13) { targetScore = round2(Math.min(14, generalAverage + 1)); targetHorizon = '3 semaines'; }
    else if (generalAverage < 15) { targetScore = round2(Math.min(16, generalAverage + 0.5)); targetHorizon = '3 semaines'; }
    else { targetScore = round2(Math.min(18, generalAverage + 0.5)); targetHorizon = '4 semaines'; }
  }

  let dataQuality = 'insuffisante';
  let dataQualityLabel = 'Données insuffisantes';
  if (totalAttempts >= MIN_ATTEMPTS_FOR_SOLID) {
    dataQuality = 'solide';
    dataQualityLabel = 'Analyse solide';
  } else if (totalAttempts >= MIN_ATTEMPTS_FOR_LIMITED) {
    dataQuality = 'limitée';
    dataQualityLabel = 'Analyse limitée';
  }

  const alerts = [];
  subjects.forEach((s) => {
    if (s.evolution !== null && s.evolution < -1) {
      alerts.push({
        type: 'danger', icon: 'fa-arrow-trend-down',
        title: `${s.subject} en baisse`,
        message: `-${Math.abs(s.evolution)} pt sur les 30 derniers jours`
      });
    }
    if (s.attempts >= 3 && s.averageScore !== null && s.averageScore < 8) {
      alerts.push({
        type: 'warning', icon: 'fa-exclamation-triangle',
        title: `${s.subject} critique`,
        message: `Moyenne ${s.averageScore}/20 sur ${s.attempts} examens`
      });
    }
  });
  if (totalAttempts > 0) {
    const lastDate = newestDate;
    if (lastDate) {
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSince > 10) {
        alerts.push({
          type: 'info', icon: 'fa-clock',
          title: 'Reprise recommandée',
          message: `Ton dernier examen date de ${daysSince} jours`
        });
      }
    }
  }

  return {
    subjects, generalAverage, totalAttempts,
    dataQuality, dataQualityLabel,
    readinessScore, readinessLevel, readinessLabel,
    targetScore, targetHorizon,
    alerts,
    coefficients: COEFFICIENTS,
    oldestDate: oldestDate ? oldestDate.toISOString() : null,
    newestDate: newestDate ? newestDate.toISOString() : null
  };
}

// ════════════════════════════════════════════════════════════════
// HELPER : date ISO du jour + décalage
// ════════════════════════════════════════════════════════════════
function isoDatePlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ════════════════════════════════════════════════════════════════
// PROMPT IA v2 (enrichi)
// ════════════════════════════════════════════════════════════════
function plannerPrompt(aggregated) {
  const {
    subjects, generalAverage, totalAttempts, dataQuality,
    readinessScore, readinessLabel, targetScore, targetHorizon
  } = aggregated;

  const today = new Date().toISOString().slice(0, 10);

  const subjectsSummary = subjects.map((s) => ({
    matiere: s.subject,
    subjectKey: s.subjectKey,
    coefficient: s.coefficient,
    moyenne: s.averageScore !== null ? `${s.averageScore}/20` : 'inconnue',
    tentatives: s.attempts,
    tendance: s.trend,
    evolution_30j: s.evolution !== null ? `${s.evolution > 0 ? '+' : ''}${s.evolution} pt` : 'inconnue',
    priorite_actuelle: s.priority,
    chapitres_faibles: s.weakChapters.map((c) => `Ex${c.number} (${c.score}/${c.maxScore})`),
    chapitres_forts: s.strongChapters.map((c) => `Ex${c.number}`)
  }));

  return `Tu es un coach pédagogique expert du BAC au Niger (Terminale D).
Ta mission : générer un PLAN DE RÉVISION HEBDOMADAIRE COMPLET ET ACTIONNABLE pour un élève.

═══════════════════════════════════════════════════════════════
CONTEXTE DE L'ÉLÈVE
═══════════════════════════════════════════════════════════════
Date du jour : ${today}
Examens analysés : ${totalAttempts}
Qualité des données : ${dataQuality}
Moyenne générale pondérée : ${generalAverage !== null ? generalAverage + '/20' : 'non calculable'}
Score de préparation : ${readinessScore}/100 (${readinessLabel})
Objectif système : ${targetScore}/20 en ${targetHorizon}

Détail par matière :
${JSON.stringify(subjectsSummary, null, 2)}

═══════════════════════════════════════════════════════════════
RÈGLES CRITIQUES
═══════════════════════════════════════════════════════════════
1. Priorise les matières "Urgente" et "Importante"
2. Cible SPÉCIFIQUEMENT les chapitres faibles (utilise les numéros fournis)
3. Alterne les matières pour éviter la fatigue cognitive
4. Chaque session doit être CONCRÈTE et MESURABLE :
   ❌ "Réviser maths"
   ✅ "Refaire Ex3 dérivées composées + 3 exercices similaires"
5. Chaque session doit avoir des ÉTAPES numérotées explicites
6. Chaque session doit avoir un CRITÈRE DE RÉUSSITE vérifiable
7. Alterne les thèmes : Découverte → Approfondissement → Consolidation → Repos → Bilan
8. Prévois AU MOINS 1 jour de repos (le dimanche idéalement)
9. Utilise un ton PROFESSIONNEL et BIENVEILLANT
10. Si données insuffisantes (< 3 examens), propose des actions génériques utiles + recommande de passer plus d'examens
11. Fournis les LIENS vers les ressources (reviseur, examen, fiche)

═══════════════════════════════════════════════════════════════
THÈMES DES JOURS (à assigner intelligemment)
═══════════════════════════════════════════════════════════════
- "Découverte" : première approche d'une notion
- "Approfondissement" : travail en profondeur
- "Consolidation" : révision active
- "Pratique" : exercices intensifs
- "Repos" : pause bien méritée (15 min max)
- "Bilan" : récap de la semaine

═══════════════════════════════════════════════════════════════
FORMAT DE RÉPONSE (JSON UNIQUEMENT)
═══════════════════════════════════════════════════════════════
{
  "weekGoal": {
    "title": "Titre court de l'objectif principal de la semaine",
    "description": "1 phrase claire",
    "measurable": "Comment savoir si l'objectif est atteint (ex: 'Réussir 80% des exercices types')",
    "deadline": "Dimanche soir"
  },
  "summary": "Résumé analytique 3-4 phrases (niveau global + points forts + points faibles + tendance)",
  "estimatedGain": "Gain estimé si plan suivi (ex: '+1.5 pt en maths')",
  "targetScore": ${targetScore},
  "targetHorizon": "${targetHorizon}",
  "swot": {
    "strengths": ["Force 1", "Force 2"],
    "weaknesses": ["Faiblesse 1", "Faiblesse 2"],
    "opportunities": ["Opportunité 1"],
    "threats": ["Menace 1"]
  },
  "priorities": [
    {
      "subject": "Mathématiques",
      "subjectKey": "mathematiques",
      "priority": "Urgente",
      "recommendedMinutes": 120,
      "averageScore": 11.5,
      "attempts": 3,
      "weakChapters": ["Ex3 - Dérivées composées", "Ex5 - Intégrales"],
      "reason": "Moyenne faible ET en baisse. 2 exercices critiques identifiés.",
      "concreteGoal": "Réussir 5 dérivées composées d'affilée sans erreur",
      "linkedResources": [
        { "type": "reviseur", "label": "Fiche dérivées", "url": "reviseur.html" },
        { "type": "exam", "label": "Mini-examen dérivées", "url": "exam.html" }
      ]
    }
  ],
  "sessions": [
    {
      "day": 1,
      "date": "${isoDatePlusDays(0)}",
      "theme": "Découverte",
      "subject": "Mathématiques",
      "subjectKey": "mathematiques",
      "durationMinutes": 30,
      "task": "Refaire Ex3 sur les dérivées composées",
      "steps": [
        "Relire la fiche pendant 8 min",
        "Refaire l'exercice sans regarder la correction",
        "Comparer avec la correction",
        "Noter l'erreur principale"
      ],
      "objective": "Maîtriser la règle de dérivation en chaîne",
      "successCriteria": "Tu réussis 3 exercices sur 4 sans erreur",
      "linkedResources": []
    },
    {
      "day": 7,
      "date": "${isoDatePlusDays(6)}",
      "theme": "Bilan",
      "subject": "Bilan hebdomadaire",
      "subjectKey": "general",
      "durationMinutes": 15,
      "task": "Faire le point sur la semaine",
      "steps": [
        "Relire les notes prises",
        "Refaire 1 exercice de chaque matière",
        "Noter les progrès et les difficultés restantes"
      ],
      "objective": "Consolider les acquis de la semaine",
      "successCriteria": "Tu identifies 3 progrès concrets",
      "linkedResources": []
    }
  ],
  "weekOverview": {
    "totalHours": 4.5,
    "focusSubject": "Mathématiques",
    "secondarySubject": "Physique",
    "difficultyCurve": "progressif",
    "restDays": [7]
  },
  "successMetrics": [
    { "label": "Sessions complétées", "target": "6/7" },
    { "label": "Exercices réussis", "target": "≥ 80%" },
    { "label": "Notions maîtrisées", "target": "3 nouvelles" }
  ],
  "encouragement": "Message personnel 2-3 phrases basé sur l'historique réel",
  "nextReviewDate": "${isoDatePlusDays(7)}"
}

CONTRAINTES :
- priorities : 2 à 5 matières
- sessions : EXACTEMENT 7 sessions (une par jour, day de 1 à 7)
- Chaque session entre 15 et 60 minutes
- swot : 2-4 items par catégorie
- successMetrics : 3 à 5 métriques mesurables
- restDays : au moins 1 jour dans la semaine
- Ton professionnel, précis, jamais vague
- Aucune donnée inventée
- Réponds UNIQUEMENT avec l'objet JSON`;
}

// ════════════════════════════════════════════════════════════════
// PROVIDERS
// ════════════════════════════════════════════════════════════════
function getProviders() {
  return [
    { name: 'Groq', key: process.env.GROQ_API_KEY,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', headers: {} },
    { name: 'OpenRouter', key: process.env.OPENROUTER_API_KEY,
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b',
      headers: { 'HTTP-Referer': process.env.APP_ORIGIN || '', 'X-Title': 'ARVEXA School' } },
    { name: 'Mistral', key: process.env.MISTRAL_API_KEY,
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      model: process.env.MISTRAL_MODEL || 'open-mistral-nemo', headers: {} }
  ].filter((p) => Boolean(p.key));
}

async function callProvider(provider, prompt, maxTokens = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const body = {
      model: provider.model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: 'Tu produis exclusivement du JSON valide.' },
        { role: 'user', content: prompt }
      ]
    };
    // gpt-oss = modèle de raisonnement : effort bas → tokens réservés au contenu
    if (/gpt-oss/.test(provider.model || '')) body.reasoning_effort = 'low';

    if (provider.name === 'Groq' || provider.name === 'OpenRouter') {
      body.response_format = { type: 'json_object' };
    }

    const result = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.key}`,
        ...provider.headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const data = await result.json().catch(() => null);
    if (!result.ok) {
      const msg = data?.error?.message || data?.message || `HTTP ${result.status}`;
      throw new Error(`${provider.name}: ${msg}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${provider.name}: réponse vide`);

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } finally {
    clearTimeout(timeout);
  }
}

// ════════════════════════════════════════════════════════════════
// VALIDATION v2 (tolérante)
// ════════════════════════════════════════════════════════════════
function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') return false;
  if (typeof plan.summary !== 'string' || plan.summary.length < 20) return false;

  // weekGoal peut être string (v1) OU object (v2)
  const hasGoal = plan.weekGoal && (
    typeof plan.weekGoal === 'string' ||
    (typeof plan.weekGoal === 'object' && plan.weekGoal.title)
  );
  if (!hasGoal) return false;

  if (!Array.isArray(plan.priorities) || plan.priorities.length < 1) return false;
  if (!Array.isArray(plan.sessions) || plan.sessions.length < 5) return false;

  const validPriority = plan.priorities.every(
    (p) => p && typeof p.subject === 'string' && typeof p.priority === 'string'
  );
  if (!validPriority) return false;

  const validSession = plan.sessions.every(
    (s) => s && typeof s.day === 'number' &&
      typeof s.subject === 'string' && typeof s.task === 'string'
  );
  if (!validSession) return false;

  return true;
}

async function generateWithFallback(prompt) {
  const providers = getProviders();
  if (!providers.length) throw new Error('provider_missing');

  const errors = [];
  for (const provider of providers) {
    try {
      console.log(`[AI-PLANNER] Tentative ${provider.name}...`);
      const plan = await callProvider(provider, prompt);

      if (validatePlan(plan)) {
        console.log(`[AI-PLANNER] ✅ ${provider.name} a généré un plan valide`);
        return { plan, aiUsed: true };
      }

      errors.push(`${provider.name}: structure invalide`);
      console.warn(`[AI-PLANNER] ⚠️ ${provider.name} : structure invalide`);
    } catch (error) {
      errors.push(`${provider.name}: ${error.message}`);
      console.warn(`[AI-PLANNER] ❌ ${provider.name} échec: ${error.message}`);
    }
  }

  throw new Error('all_providers_failed: ' + errors.join(' | '));
}

// ════════════════════════════════════════════════════════════════
// FALLBACK LOCAL ENRICHI v2
// ════════════════════════════════════════════════════════════════
function buildLocalPlan(aggregated) {
  const {
    subjects, generalAverage, totalAttempts, dataQuality, dataQualityLabel,
    readinessScore, readinessLevel, readinessLabel, targetScore, targetHorizon, alerts
  } = aggregated;

  const priorities = subjects
    .filter((s) => s.averageScore !== null && s.priorityLevel !== 'none')
    .slice(0, 5)
    .map((s) => {
      const weakChapterLabel = s.weakChapters.length > 0
        ? `Ex${s.weakChapters[0].number}`
        : null;

      return {
        subject: s.subject,
        subjectKey: s.subjectKey,
        icon: s.icon,
        averageScore: s.averageScore,
        attempts: s.attempts,
        priority: s.priority,
        recommendedMinutes: s.recommendedMinutes,
        weakChapters: s.weakChapters.map((c) => `Ex${c.number} (${c.score}/${c.maxScore})`),
        reason: s.evolution !== null && s.evolution < -0.5
          ? `Moyenne en baisse (${s.evolution} pt sur 30j)`
          : s.weakChapters.length > 0
            ? `${s.weakChapters.length} chapitre(s) faible(s) identifié(s)`
            : `Moyenne ${s.averageScore}/20`,
        concreteGoal: weakChapterLabel
          ? `Réussir 5 exercices du type ${weakChapterLabel}`
          : `Améliorer la moyenne de ${s.subject} à ${Math.min(20, Math.round(s.averageScore + 1))}/20`,
        linkedResources: [
          { type: 'reviseur', label: `Fiche ${s.subject}`, url: 'reviseur.html' },
          { type: 'exam', label: `Mini-examen ${s.subject}`, url: 'exam.html' }
        ]
      };
    });

  const prioritySubjects = priorities.length > 0
    ? priorities
    : subjects.filter((s) => s.averageScore !== null).slice(0, 3);

  // Thèmes des 7 jours
  const dayThemes = ['Découverte', 'Approfondissement', 'Pratique', 'Consolidation', 'Pratique', 'Consolidation', 'Bilan'];

  const sessions = [];
  for (let day = 1; day <= 7; day++) {
    const isRestDay = day === 7;
    const theme = dayThemes[day - 1];

    if (prioritySubjects.length === 0) {
      sessions.push({
        day,
        date: isoDatePlusDays(day - 1),
        theme,
        subject: 'Organisation',
        subjectKey: 'general',
        durationMinutes: 30,
        task: 'Effectuer un premier examen pour créer tes priorités',
        steps: ['Aller dans Mode Examen', 'Choisir une matière', 'Faire un sujet complet'],
        objective: 'Obtenir une première analyse',
        successCriteria: 'Tu as terminé 1 examen',
        linkedResources: [{ type: 'exam', label: 'Mode Examen', url: 'exam.html' }]
      });
      continue;
    }

    if (isRestDay) {
      sessions.push({
        day,
        date: isoDatePlusDays(day - 1),
        theme: 'Repos / Bilan',
        subject: 'Bilan hebdomadaire',
        subjectKey: 'general',
        durationMinutes: 15,
        task: 'Faire le point sur la semaine',
        steps: [
          'Relire les notes prises',
          'Refaire 1 exercice de chaque matière travaillée',
          'Noter 3 progrès et 1 difficulté restante'
        ],
        objective: 'Consolider les acquis de la semaine',
        successCriteria: 'Tu identifies 3 progrès concrets',
        linkedResources: []
      });
      continue;
    }

    const subject = prioritySubjects[(day - 1) % prioritySubjects.length];
    const weakChapter = subject.weakChapters && subject.weakChapters[0];

    let task, steps, objective, successCriteria;
    if (weakChapter) {
      const wc = typeof weakChapter === 'string' ? weakChapter : `Ex${weakChapter.number}`;
      task = `Travailler ${wc} de ${subject.subject}`;
      steps = [
        `Relire la fiche ${subject.subject} (8 min)`,
        `Refaire ${wc} sans regarder la correction`,
        'Faire 2 exercices similaires',
        'Comparer avec la correction et noter les erreurs'
      ];
      objective = `Maîtriser ${wc}`;
      successCriteria = 'Tu réussis 3 exercices sur 4 sans erreur';
    } else {
      task = `Renforcer ${subject.subject} avec des exercices progressifs`;
      steps = [
        'Relire les notions clés (10 min)',
        'Faire 3 exercices faciles',
        'Faire 2 exercices moyens',
        'Vérifier les corrections'
      ];
      objective = 'Renforcer les bases';
      successCriteria = 'Tu réussis 4 exercices sur 5';
    }

    sessions.push({
      day,
      date: isoDatePlusDays(day - 1),
      theme,
      subject: subject.subject,
      subjectKey: subject.subjectKey,
      durationMinutes: Math.min(subject.recommendedMinutes || 30, 45),
      task,
      steps,
      objective,
      successCriteria,
      linkedResources: subject.linkedResources || []
    });
  }

  const strengths = subjects
    .filter((s) => s.averageScore !== null && s.averageScore >= 14)
    .map((s) => `${s.subject} (${s.averageScore}/20)`);

  const weaknesses = subjects
    .filter((s) => s.averageScore !== null && s.averageScore < 10)
    .map((s) => `${s.subject} (${s.averageScore}/20)`);

  const opportunities = [
    'Des chapitres précis identifiés pour progresser',
    'Un plan structuré = gain de temps'
  ];

  const threats = [];
  subjects.forEach((s) => {
    if (s.evolution !== null && s.evolution < -0.5) threats.push(`${s.subject} en baisse`);
  });
  if (totalAttempts < 3) threats.push('Manque d\'examens pour analyse fiable');

  // Summary
  let summary;
  if (totalAttempts === 0) {
    summary = "Aucun examen enregistré. Commence par un examen pour qu'on puisse analyser ton niveau et te proposer un plan adapté.";
  } else if (totalAttempts < 3) {
    const names = priorities.slice(0, 2).map((p) => p.subject).join(' et ');
    summary = `Analyse basée sur ${totalAttempts} examen${totalAttempts > 1 ? 's' : ''}. ${priorities.length > 0 ? `Tes priorités identifiées : ${names}.` : ''} Passe 2-3 examens supplémentaires pour affiner ton plan.`;
  } else {
    const names = priorities.slice(0, 2).map((p) => p.subject).join(' et ');
    summary = `Analyse basée sur ${totalAttempts} examens. ${generalAverage !== null ? `Moyenne générale : ${generalAverage}/20.` : ''} ${names ? `Priorités actuelles : ${names}.` : 'Toutes les matières sont à niveau équilibré.'}`;
  }

  const focusSubject = priorities[0]?.subject || 'Général';
  const secondarySubject = priorities[1]?.subject || null;

  return {
    weekGoal: {
      title: priorities.length > 0
        ? `Renforcer ${priorities[0].subject}${priorities[1] ? ' et ' + priorities[1].subject : ''}`
        : 'Créer une base de données d\'examens',
      description: priorities.length > 0
        ? `Travailler en priorité les chapitres faibles de ${priorities[0].subject}.`
        : 'Passer 2-3 examens pour obtenir une analyse fiable.',
      measurable: priorities.length > 0 && priorities[0].averageScore !== null
        ? `Atteindre ${Math.min(20, Math.round(priorities[0].averageScore + 1))}/20 en ${priorities[0].subject}`
        : 'Terminer 3 examens',
      deadline: 'Dimanche soir'
    },
    summary,
    estimatedGain: priorities.length > 0 && priorities[0].averageScore !== null
      ? `+${Math.min(2, Math.max(0.5, round2((12 - priorities[0].averageScore) * 0.3)))} pt en ${priorities[0].subject}`
      : 'Non calculable',
    targetScore,
    targetHorizon,
    swot: { strengths, weaknesses, opportunities, threats },
    priorities,
    sessions,
    weekOverview: {
      totalHours: round2(sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60),
      focusSubject,
      secondarySubject,
      difficultyCurve: 'progressif',
      restDays: [7]
    },
    successMetrics: [
      { label: 'Sessions complétées', target: '6/7' },
      { label: 'Exercices réussis', target: '≥ 75%' },
      { label: 'Notions maîtrisées', target: '3 nouvelles' }
    ],
    encouragement: generalAverage !== null && generalAverage >= 14
      ? `Bravo pour ton niveau (${generalAverage}/20). Continue pour sécuriser ta réussite.`
      : `Chaque session compte. Tiens ce rythme et tu verras des résultats d'ici 2 semaines.`,
    nextReviewDate: isoDatePlusDays(7),
    generatedLocally: true
  };
}

// ════════════════════════════════════════════════════════════════
// CACHE
// ════════════════════════════════════════════════════════════════
async function getCachedPlan(uid, resultCount) {
  try {
    const { db } = getAdminServices();
    const cacheRef = db.collection('users').doc(uid).collection('plannerCache').doc('current');
    const snapshot = await cacheRef.get();
    if (!snapshot.exists) return null;

    const data = snapshot.data();
    const cachedAt = toDate(data.cachedAt);
    if (!cachedAt) return null;

    // Invalidation si version différente
    if (data.plan?._meta?.version !== PLAN_VERSION) {
      console.log('[AI-PLANNER] Cache invalidé : version obsolète');
      return null;
    }

    // Invalidation si nouvel examen détecté
    if (resultCount && data.resultCount !== undefined && data.resultCount !== resultCount) {
      console.log(`[AI-PLANNER] Cache invalidé : ${data.resultCount} → ${resultCount} examens`);
      return null;
    }

    const age = Date.now() - cachedAt.getTime();
    if (age > CACHE_TTL_MS) return null;

    return data.plan || null;
  } catch (_) { return null; }
}

async function savePlanToCache(uid, plan, resultCount) {
  try {
    const { db, FieldValue } = getAdminServices();
    const cacheRef = db.collection('users').doc(uid).collection('plannerCache').doc('current');
    await cacheRef.set({
      plan,
      resultCount,
      cachedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Cache save failed:', e.message);
  }
}

// ════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════
module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return jsonError(response, 405, 'Méthode non autorisée.');
  }

  if (rateLimited(clientIp(request))) {
    return jsonError(response, 429, 'Beaucoup d\'élèves en ce moment. Réessaie dans une minute.');
  }

  let user;
  try {
    user = await verifyFirebaseToken(request);
  } catch (_) {
    user = null;
  }

  if (!user) {
    return jsonError(response, 401, 'Connexion requise.', 'AUTH_REQUIRED');
  }

  try {
    const { db } = getAdminServices();
    const uid = user.uid;

    // Premium check
    const userSnapshot = await db.collection('users').doc(uid).get();
    if (!isPremiumUser(userSnapshot.data())) {
      return jsonError(response, 403, 'Le planificateur est réservé aux comptes Premium.', 'PREMIUM_REQUIRED');
    }

    // Récupérer les examens
    const snapshot = await db.collection('users').doc(uid)
      .collection('examResults')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const results = snapshot.docs.map((d) => d.data());
    const resultCount = results.length;

    // Cache
    const forceRefresh = request.query?.refresh === 'true' || request.body?.refresh === true;
    if (!forceRefresh) {
      const cached = await getCachedPlan(uid, resultCount);
      if (cached) {
        console.log('[AI-PLANNER] ✅ Plan servi depuis le cache');
        return response.status(200).json({
          success: true,
          plan: cached,
          resultCount,
          cached: true
        });
      }
    }

    // Agréger
    const aggregated = aggregateStudentData(results);
    console.log(`[AI-PLANNER] ${resultCount} examens, qualité: ${aggregated.dataQuality}, readiness: ${aggregated.readinessScore}`);

    // IA
    let plan;
    let aiSucceeded = false;

    try {
      const prompt = plannerPrompt(aggregated);
      const result = await generateWithFallback(prompt);
      plan = result.plan;
      aiSucceeded = true;
      console.log('[AI-PLANNER] ✅ Plan IA généré');
    } catch (aiError) {
      console.warn('[AI-PLANNER] ⚠️ Fallback local:', aiError.message);
      plan = buildLocalPlan(aggregated);
    }

    // Enrichir avec métadonnées
    const enrichedPlan = {
      ...plan,
      _meta: {
        version: PLAN_VERSION,
        resultCount,
        dataQuality: aggregated.dataQuality,
        dataQualityLabel: aggregated.dataQualityLabel,
        generalAverage: aggregated.generalAverage,
        readinessScore: aggregated.readinessScore,
        readinessLevel: aggregated.readinessLevel,
        readinessLabel: aggregated.readinessLabel,
        targetScore: aggregated.targetScore,
        targetHorizon: aggregated.targetHorizon,
        alerts: aggregated.alerts,
        aiGenerated: aiSucceeded,
        generatedAt: new Date().toISOString()
      }
    };

    await savePlanToCache(uid, enrichedPlan, resultCount);

    return response.status(200).json({
      success: true,
      plan: enrichedPlan,
      resultCount,
      aiGenerated: aiSucceeded,
      cached: false
    });

  } catch (error) {
    console.error('[AI-PLANNER] Erreur critique:', error.message);
    return jsonError(response, 503, 'Le planificateur est temporairement indisponible. Réessaie dans quelques minutes.');
  }
};

module.exports.config = { maxDuration: 60 };
