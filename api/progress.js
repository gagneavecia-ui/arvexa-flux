// ================================================================
// API PROGRESS v8.7 — ARVEXA School
// Cahier intelligent + Fan-out IA + Tracking temps d'étude
// v8.6 « édition complète » (base v8.5 inchangée structurellement) :
//   - explications « comme un prof » enrichies (analogies, étapes)
//   - banque de questions SPLIT en 2 demi-tâches (base + avancée, 5-13 chacune)
//     fusionnées + renumérotées → 10-26 questions, taille « QCM » fiable chez Mistral
//   - QCM 8-12 imposés, distracteurs plausibles, explication chaque item
//   - anglais ré-ajouté (prompts language déjà dans le code)
//   - FILES séquentielles par fournisseur (anti-collision de concurrence)
//   - GEMINI 4e fournisseur (JSON natif responseMimeType) : questions + qcm primaires
//   - affectation calibrée sur les taux de succès réels : Groq = explication,
//     Mistral = structure + qcm (jsonMode), OpenRouter = questions (repli Mistral)
//   - extraction supprimée (la page n'utilise pas analysis.extracted)
//   - budget IA 70 s (maxDuration 90) — repli sur fournisseur inactif
//   - v4.14 : tâche QCM retirée (affichage + génération) — explication + banque
//     de questions uniquement ; les anciennes sections gardent leur QCM en base
// NOTE : maxDuration est assigné en FIN de module (visible par Vercel AU BUILD).
// ================================================================

const WINDOW_MS = 60 * 1000;

// ✅ Rate limit adaptatif par action
const RATE_LIMITS = {
  getDashboard: 20,
  listChapters: 30,
  createChapter: 10,
  getChapter: 30,
  createSection: 5,       // IA lourd = 5/min max
  getSection: 30,
  updateNotes: 30,
  deleteSection: 10,
  deleteChapter: 10,
  getFullLesson: 15,
  trackStudyTime: 60      // léger, fréquent
};

const DEFAULT_RATE_LIMIT = 30;
const requestLog = new Map();

// ────────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────────
var ALLOWED_SUBJECTS = new Set([
  'mathematiques', 'physique', 'chimie', 'svt',
  'philosophie', 'histoire', 'geographie', 'anglais'
]);

var ALLOWED_SUBJECTS_ARRAY = Array.from(ALLOWED_SUBJECTS);

var SUBJECT_INFO = {
  mathematiques: { label: 'Mathématiques',  profile: 'scientific' },
  physique:      { label: 'Physique',       profile: 'scientific' },
  chimie:        { label: 'Chimie',         profile: 'scientific' },
  svt:           { label: 'SVT',            profile: 'svt' },
  philosophie:   { label: 'Philosophie',    profile: 'philosophy' },
  histoire:      { label: 'Histoire',       profile: 'history' },
  geographie:    { label: 'Géographie',     profile: 'history' },
  anglais:       { label: 'Anglais',        profile: 'language' }
};
const MIN_CONTENT_LENGTH = 40;
const MAX_CONTENT_LENGTH = 2500; // calibré IA : aligné sur le cahier (budget analyse)

const FREE_SECTION_LIMIT = 5;
const GLOBAL_AI_TIME_BUDGET_MS = 78000;

let adminServices = null;

// ════════════════════════════════════════════════════════════════
// NORMALISATION LATEX
// ════════════════════════════════════════════════════════════════
const UNICODE_MATH_MAP = {
  'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ',
  'ε': '\\epsilon ', 'ζ': '\\zeta ', 'η': '\\eta ', 'θ': '\\theta ',
  'ι': '\\iota ', 'κ': '\\kappa ', 'λ': '\\lambda ', 'μ': '\\mu ',
  'ν': '\\nu ', 'ξ': '\\xi ', 'π': '\\pi ', 'ρ': '\\rho ',
  'σ': '\\sigma ', 'ς': '\\varsigma ', 'τ': '\\tau ', 'υ': '\\upsilon ',
  'φ': '\\phi ', 'χ': '\\chi ', 'ψ': '\\psi ', 'ω': '\\omega ',
  'Γ': '\\Gamma ', 'Δ': '\\Delta ', 'Θ': '\\Theta ',
  'Λ': '\\Lambda ', 'Ξ': '\\Xi ', 'Π': '\\Pi ',
  'Σ': '\\Sigma ', 'Υ': '\\Upsilon ', 'Φ': '\\Phi ',
  'Ψ': '\\Psi ', 'Ω': '\\Omega ',
  '×': '\\times ', '÷': '\\div ', '±': '\\pm ', '∓': '\\mp ',
  '·': '\\cdot ', '⋅': '\\cdot ', '∘': '\\circ ', '∗': '\\ast ',
  '⋆': '\\star ', '∙': '\\bullet ', '⊕': '\\oplus ', '⊗': '\\otimes ',
  '⊙': '\\odot ',
  '≤': '\\leq ', '≥': '\\geq ', '≠': '\\neq ', '≈': '\\approx ',
  '≡': '\\equiv ', '≅': '\\cong ', '∼': '\\sim ', '≃': '\\simeq ',
  '∝': '\\propto ', '≪': '\\ll ', '≫': '\\gg ',
  '∈': '\\in ', '∉': '\\notin ', '∋': '\\ni ', '⊂': '\\subset ',
  '⊃': '\\supset ', '⊆': '\\subseteq ', '⊇': '\\supseteq ',
  '⊄': '\\not\\subset ', '∪': '\\cup ', '∩': '\\cap ', '∅': '\\emptyset ',
  '∀': '\\forall ', '∃': '\\exists ', '∄': '\\nexists ', '¬': '\\neg ',
  '∧': '\\wedge ', '∨': '\\vee ',
  '∑': '\\sum ', '∏': '\\prod ', '∫': '\\int ', '∮': '\\oint ',
  '∂': '\\partial ', '∇': '\\nabla ', '√': '\\sqrt ',
  '→': '\\to ', '←': '\\leftarrow ', '↔': '\\leftrightarrow ',
  '↑': '\\uparrow ', '↓': '\\downarrow ', '↕': '\\updownarrow ',
  '⇒': '\\Rightarrow ', '⇐': '\\Leftarrow ', '⇔': '\\Leftrightarrow ',
  '⟹': '\\Longrightarrow ', '⟸': '\\Longleftarrow ', '⟺': '\\Longleftrightarrow ',
  '↦': '\\mapsto ', '↪': '\\hookrightarrow ', '↩': '\\hookleftarrow ',
  '↗': '\\nearrow ', '↘': '\\searrow ', '↙': '\\swarrow ', '↖': '\\nwarrow ',
  '⇌': '\\rightleftharpoons ', '⇋': '\\leftrightharpoons ',
  '⟶': '\\longrightarrow ', '⟵': '\\longleftarrow ',
  '∞': '\\infty ', 'ℵ': '\\aleph ', 'ℓ': '\\ell ', 'ℏ': '\\hbar ',
  'ℜ': '\\Re ', 'ℑ': '\\Im ', '°': '^{\\circ} ', '′': "'", '″': "''",
  '‰': '\\text{‰} ', '§': '\\text{§} ',
};

const SUPERSCRIPT_MAP = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')',
  'ⁿ': 'n', 'ⁱ': 'i'
};

const SUBSCRIPT_MAP = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')'
};

const NO_ARG_LATEX_COMMANDS = [
  'rightleftharpoons', 'leftrightharpoons', 'longrightarrow', 'longleftarrow',
  'Longleftrightarrow', 'Longleftarrow', 'Longrightarrow',
  'Leftrightarrow', 'leftrightarrow', 'rightarrow', 'leftarrow',
  'updownarrow', 'hookrightarrow', 'hookleftarrow',
  'Rightarrow', 'Leftarrow', 'to', 'gets', 'implies', 'impliedby',
  'iff', 'mapsto', 'longmapsto', 'leadsto',
  'varepsilon', 'vartheta', 'varsigma', 'varrho', 'varphi', 'varpi',
  'cdotp', 'cdot', 'times', 'div', 'pm', 'mp', 'ast', 'star', 'bullet',
  'circ', 'leq', 'geq', 'neq', 'approx', 'equiv', 'sim', 'simeq', 'propto',
  'cong', 'll', 'gg', 'subset', 'supset', 'subseteq', 'supseteq',
  'cup', 'cap', 'emptyset', 'forall', 'exists', 'nexists', 'neg', 'wedge',
  'vee', 'oplus', 'otimes', 'odot', 'sum', 'prod', 'int', 'oint',
  'partial', 'nabla', 'infty', 'aleph', 'ell', 'hbar',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma',
  'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon',
  'Phi', 'Psi', 'Omega',
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp',
  'lim', 'max', 'min', 'det', 'mod', 'gcd', 'lcm',
  'quad', 'qquad'
];

const CMD_SPACE_REGEX = new RegExp(
  `(\\\\(?:${NO_ARG_LATEX_COMMANDS.join('|')}))(?=[a-zA-Z0-9])`,
  'g'
);

const HAS_UNICODE_MATH_REGEX = /[α-ωΑ-Ω×÷±∓·⋅∘∗⋆∙⊕⊗⊙≤≥≠≈≡≅∼≃∝≪≫∈∉∋⊂⊃⊆⊇⊄∪∩∅∀∃∄¬∧∨∑∏∫∮∂∇√→←↔↑↓↕⇒⇐⇔⟹⟸⟺↦↪↩↗↘↙↖⇌⇋⟶⟵∞ℵℓℏℜℑ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]/;

function hasUnicodeMath(text) {
  if (!text || typeof text !== 'string') return false;
  return HAS_UNICODE_MATH_REGEX.test(text);
}

function replaceUnicodeScripts(text) {
  if (!text || typeof text !== 'string') return text;
  let r = text;

  r = r.replace(/([a-zA-Z0-9}\)\]_])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+)/g, (m, base, sups) => {
    const conv = sups.split('').map((c) => SUPERSCRIPT_MAP[c] || c).join('');
    return `${base}^{${conv}}`;
  });

  r = r.replace(/([a-zA-Z0-9}\)\]])([₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]+)/g, (m, base, subs) => {
    const conv = subs.split('').map((c) => SUBSCRIPT_MAP[c] || c).join('');
    return `${base}_{${conv}}`;
  });

  return r;
}

function replaceUnicodeMath(text) {
  if (!text || typeof text !== 'string') return text;

  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);

  return parts.map((part, i) => {
    if (i % 2 === 0) return part; // prose : la flèche Unicode reste Unicode (lisible)

    // DANS les maths : Unicode → LaTeX (KaTeX-friendly, fix $x → 3$)
    let r = part;
    for (const [uni, latex] of Object.entries(UNICODE_MATH_MAP)) {
      if (r.indexOf(uni) !== -1) {
        r = r.split(uni).join(latex);
      }
    }
    return r;
  }).join('');
}

function fixCommandSpacing(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(CMD_SPACE_REGEX, '$1 ');
}

function normalizeDelimiters(text) {
  if (!text || typeof text !== 'string') return text;
  let r = text;

  r = r.replace(/\\\(([\s\S]*?)\\\)/g, (m, inner) => `$${inner.trim()}$`);
  r = r.replace(/\\\[([\s\S]*?)\\\]/g, (m, inner) => `$$${inner.trim()}$$`);
  r = r.replace(/\\begin\{(?:equation|align|gather)\*?\}([\s\S]*?)\\end\{(?:equation|align|gather)\*?\}/g,
                (m, inner) => `$$${inner.trim()}$$`);

  return r;
}

function cleanBrokenDelimiters(text) {
  if (!text || typeof text !== 'string') return text;
  let r = text;

  r = r.replace(/\${6,}/g, '$$$$');
  r = r.replace(/\${5}/g, '$$$$');
  r = r.replace(/\${3}/g, '$$');
  r = r.replace(/\$\s*\$/g, ' ');
  r = r.replace(/\$\$\s*\$\$/g, ' ');

  return r;
}

// ✅ FIX « ADN\to ARN » : flèches LaTeX/ASCII orphelines (HORS des $…$)
// → Unicode lisible dans la prose. Dans les maths délimitées, on ne touche rien.
const ARROW_LAT2UNI = {
  Longleftrightarrow:'\u27FA', Longrightarrow:'\u27F9', Longleftarrow:'\u27F8',
  Leftrightarrow:'\u21D4', rightleftharpoons:'\u21CC', leftrightharpoons:'\u21CB',
  longrightarrow:'\u27F6', longleftarrow:'\u27F5', longmapsto:'\u27FC',
  leftrightarrow:'\u2194', hookrightarrow:'\u21AA', hookleftarrow:'\u21A9',
  Rightarrow:'\u21D2', Leftarrow:'\u21D0', updownarrow:'\u2195', Uparrow:'\u21D1', Downarrow:'\u21D3',
  downarrow:'\u2193', uparrow:'\u2191', nearrow:'\u2197', searrow:'\u2198', swarrow:'\u2199', nwarrow:'\u2196',
  mapsto:'\u21A6', rightarrow:'\u2192', leftarrow:'\u2190', leadsto:'\u2933',
  implies:'\u21D2', impliedby:'\u21D0', iff:'\u21D4', to:'\u2192', gets:'\u2190'
};
const ARROW_LAT2UNI_RE = new RegExp(
  '\\\\(' + Object.keys(ARROW_LAT2UNI).sort((a, b) => b.length - a.length).join('|') + ')(?![a-zA-Z])', 'g'
);

function arrowsToUnicode(text) {
  if (!text || typeof text !== 'string') return text;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part; // maths délimitées : intactes
    let r = part.replace(ARROW_LAT2UNI_RE, (m, c) => ARROW_LAT2UNI[c] || m);
    // Flèches ASCII usuelles écrites par les modèles (prose uniquement)
    r = r.replace(/<=>/g, '\u21D4').replace(/<->/g, '\u2194').replace(/-->/g, '\u27F6')
         .replace(/==>/g, '\u27F9').replace(/->/g, '\u2192').replace(/=>/g, '\u21D2');
    return r;
  }).join('');
}

function wrapOrphanLatex(text) {
  if (!text || typeof text !== 'string') return text;
  if (!/\\[a-zA-Z]/.test(text)) return text;

  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);

  return parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return wrapSegmentLatex(part);
  }).join('');
}

function wrapSegmentLatex(segment) {
  if (!segment) return segment;
  if (!/\\[a-zA-Z]/.test(segment)) return segment;

  let r = segment;

  r = r.replace(
    /\\begin\{([a-zA-Z*]+)\}([\s\S]*?)\\end\{\1\}/g,
    (match) => ` $$${match}$$ `
  );

  const KNOWN_CMDS = new Set([
    ...NO_ARG_LATEX_COMMANDS,
    'frac', 'sqrt', 'dfrac', 'tfrac', 'cfrac',
    'text', 'mathrm', 'mathbf', 'mathit', 'mathbb', 'mathcal', 'mathfrak',
    'left', 'right', 'big', 'Big', 'bigg', 'Bigg',
    'overline', 'underline', 'vec', 'hat', 'bar', 'dot', 'ddot', 'tilde',
    'binom', 'choose', 'pmod', 'bmod', 'operatorname',
    'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan',
    'lg', 'log', 'ln', 'exp',
    'quad', 'qquad', 'hspace', 'vspace'
  ]);

  r = r.replace(
    /(\\[a-zA-Z]+)((?:\s*\{[^}]*\})*)((?:\s*[_^]\s*(?:\{[^}]*\}|[a-zA-Z0-9]))*)/g,
    (match, cmd, args, scripts) => {
      if (!KNOWN_CMDS.has(cmd.slice(1))) return match;
      return ` $${cmd}${args || ''}${scripts || ''}$ `;
    }
  );

  r = r.replace(
    /(?:^|\s)([a-zA-Z]\s*[_^]\s*(?:\{[^}]*\}|[a-zA-Z0-9]))(?=\s|$|[.,;:!?])/g,
    (match, expr) => match.replace(expr, `$${expr.trim()}$`)
  );

  for (let iteration = 0; iteration < 5; iteration++) {
    const before = r;
    r = r.replace(
      /\$\s*([^$]*?)\s*\$\s*([+\-*/=<>()\[\]{}.,\s]*?)\s*\$\s*([^$]*?)\s*\$/g,
      (m, a, ops, b) => ` $${a.trim()} ${ops.trim()} ${b.trim()}$ `
    );
    if (before === r) break;
  }

  r = r.replace(/\$\s*\$/g, ' ');
  r = r.replace(/\$\s+/g, '$');
  r = r.replace(/\s+\$/g, '$');

  r = r.replace(/\s+/g, ' ');
  r = r.replace(/\s+([.,;:!?])/g, '$1');

  return r;
}

function cleanFormulaContent(formula) {
  if (!formula || typeof formula !== 'string') return formula;

  let open, close, inner;
  if (formula.startsWith('$$') && formula.endsWith('$$')) {
    open = '$$'; close = '$$';
    inner = formula.slice(2, -2);
  } else if (formula.startsWith('$') && formula.endsWith('$')) {
    open = '$'; close = '$';
    inner = formula.slice(1, -1);
  } else {
    return formula;
  }

  inner = inner.replace(/\s+/g, ' ').trim();
  inner = fixCommandSpacing(inner);
  inner = inner.replace(/^\$+/, '').replace(/\$+$/, '');

  return open + inner + close;
}

function cleanLatexText(text) {
  if (!text || typeof text !== 'string') return text;
  if (!text.trim()) return text;

  // Espaces insécables émis par certains modèles (U+00A0 / U+202F) → espace
  // normal : sinon tout le texte devient une seule ligne insécable qui déborde
  // des cartes QCM sur mobile (« le test sort de sa zone »).
  text = text.replace(/[\u00a0\u202f]/g, ' ');

  const hasBackslash = text.indexOf('\\') !== -1;
  const hasDollar = text.indexOf('$') !== -1;
  const hasUnicode = hasUnicodeMath(text);

  if (!hasBackslash && !hasDollar && !hasUnicode) return text;

  let r = text;

  r = normalizeDelimiters(r);
  r = cleanBrokenDelimiters(r);
  r = replaceUnicodeScripts(r);
  r = replaceUnicodeMath(r);
  r = arrowsToUnicode(r);
  r = fixCommandSpacing(r);
  r = wrapOrphanLatex(r);

  const parts = r.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  r = parts.map((part, i) => {
    if (i % 2 === 1) return cleanFormulaContent(part);
    return part;
  }).join('');

  r = r.replace(/[ \t]+/g, ' ');
  r = r.replace(/\s+([.,;:!?])/g, '$1');

  return r;
}

function deepClean(obj, depth = 0) {
  if (depth > 20) return obj;

  if (typeof obj === 'string') {
    if (obj.length < 6 && !/[\\$]/.test(obj) && !hasUnicodeMath(obj)) return obj;
    return cleanLatexText(obj);
  }

  if (Array.isArray(obj)) return obj.map((item) => deepClean(item, depth + 1));

  if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const k in obj) {
      if (k === 'id' || k === 'type' || k === 'level' || k === 'importance' ||
          k === 'correct' || k === 'notionId' || k === 'number') {
        cleaned[k] = obj[k];
        continue;
      }
      cleaned[k] = deepClean(obj[k], depth + 1);
    }
    return cleaned;
  }

  return obj;
}

// ════════════════════════════════════════════════════════════════
// FIREBASE ADMIN
// ════════════════════════════════════════════════════════════════
function getAdminServices() {
  if (adminServices) return adminServices;

  const credentials = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!credentials || !credentials.trim()) throw new Error('firebase_admin_not_configured');

  let serviceAccount;
  try { serviceAccount = JSON.parse(credentials); }
  catch (e) { throw new Error('firebase_admin_invalid_json'); }

  if (!serviceAccount.project_id || !serviceAccount.private_key) {
    throw new Error('firebase_admin_invalid_credentials');
  }

  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  adminServices = {
    auth: admin.auth(),
    db: admin.firestore(),
    FieldValue: admin.firestore.FieldValue,
    Timestamp: admin.firestore.Timestamp
  };
  return adminServices;
}

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────
function clientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();
}

// ✅ Rate limit adaptatif par action
// ⚠️ v4.13 — buckets ISOLÉS par (ip, action) : avant, TOUTES les actions
// partageaient un compteur unique, donc une navigation normale remplissait le
// bucket et la 1ʳᵉ suppression héritait d'un faux « trop de demandes ».
function rateLimited(ip, action) {
  const limit = RATE_LIMITS[action] || DEFAULT_RATE_LIMIT;
  const key = `${ip}|${action}`;
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requestLog.set(key, recent);
  if (requestLog.size > 5000) {
    for (const [k, v] of requestLog) {
      if (v.every((t) => now - t >= WINDOW_MS)) requestLog.delete(k);
    }
  }
  return recent.length > limit;
}

function jsonError(response, status, error, code) {
  return response.status(status).json({
    success: false,
    error,
    ...(code ? { code } : {})
  });
}

function applyCors(request, response) {
  const ALLOWED_ORIGINS = [
    'https://arvexaschool.vercel.app',
    'https://admin-89.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000'
  ];
  const origin = request.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  }
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Max-Age', '86400');
}

async function verifyFirebaseToken(request) {
  const authorization = request.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const { auth } = getAdminServices();
    return await auth.verifyIdToken(match[1]);
  } catch (error) {
    console.error('[PROGRESS AUTH] failed:', error.message);
    return null;
  }
}

function isPremiumUser(data) {
  if (!data) return false;
  const status = data.subscriptionStatus || 'none';
  if (status === 'pending') return false;

  const hasPremium = data.premium === true ||
                     data.isUnlocked === true ||
                     data.hasDeposited === true;

  const end = data.subscriptionEndDate?.toDate?.() ||
    (data.subscriptionEndDate?.seconds ? new Date(data.subscriptionEndDate.seconds * 1000) : null);

  if (hasPremium && end) return end.getTime() > Date.now();
  if (status === 'expired') return false;
  if (hasPremium && !end) return true;
  return false;
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

function todayKey() { return new Date().toISOString().slice(0, 10); }
function monthKey()  { return new Date().toISOString().slice(0, 7); }

function formatRelativeDate(value) {
  const iso = toISO(value);
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `il y a ${day}j`;
  if (day < 30) return `il y a ${Math.floor(day / 7)} sem.`;
  return d.toLocaleDateString('fr-FR');
}

function isMeaningfulContent(text) {
  if (!text || typeof text !== 'string') return false;
  const words = text.match(/[a-zA-ZÀ-ÿ]{2,}/g) || [];
  return words.length >= 5;
}

function formatMinutes(totalMin) {
  if (!totalMin || totalMin < 1) return '0 min';
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

function normalizeMathInput(text) {
  if (!text || typeof text !== 'string') return '';
  let r = text;
  r = r.replace(/([a-zA-Z0-9\)])\s*²/g, '$1^2');
  r = r.replace(/([a-zA-Z0-9\)])\s*³/g, '$1^3');
  r = r.replace(/([a-zA-Z0-9\)])\s*⁴/g, '$1^4');
  r = r.replace(/([a-zA-Z0-9\)])\s*⁵/g, '$1^5');
  r = r.replace(/√\s*\(([^)]+)\)/g, 'racine($1)');
  r = r.replace(/√\s*([a-zA-Z0-9]+)/g, 'racine($1)');
  r = r.replace(/≤/g, ' <= ');
  r = r.replace(/≥/g, ' >= ');
  r = r.replace(/≠/g, ' != ');
  r = r.replace(/∞/g, ' infini ');
  r = r.replace(/π/g, ' pi ');
  r = r.replace(/θ/g, ' theta ');
  r = r.replace(/α/g, ' alpha ');
  r = r.replace(/β/g, ' beta ');
  r = r.replace(/Δ/g, ' Delta ');
  r = r.replace(/∑/g, ' somme ');
  r = r.replace(/∫/g, ' integrale ');
  r = r.replace(/→/g, ' tend vers ');
  r = r.replace(/×/g, ' fois ');
  r = r.replace(/÷/g, ' divise par ');
  r = r.replace(/±/g, ' plus ou moins ');
  return r;
}

// ────────────────────────────────────────────────────────────────
// IA — FOURNISSEURS
// ────────────────────────────────────────────────────────────────
function getProviders() {
  return [
    {
      name: 'Groq',
      key: process.env.GROQ_API_KEY,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      jsonMode: true
    },
    {
      name: 'OpenRouter',
      key: process.env.OPENROUTER_API_KEY,
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b',
      jsonMode: true,
      headers: {
        'HTTP-Referer': process.env.APP_ORIGIN || '',
        'X-Title': 'ARVEXA Notebook'
      }
    },
    {
      name: 'Mistral',
      key: process.env.MISTRAL_API_KEY,
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
      jsonMode: true
    },
    {
      name: 'Gemini',
      key: process.env.GEMINI_API_KEY,
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-3.8-flash'}:generateContent`,
      gemini: true
    }
  ].filter((p) => Boolean(p.key));
}

// Les modeles (surtout Mistral) inserent des retours a la ligne LITTERAUX
// dans les longues proses -> JSON invalide. On les echappe avant parsing.
function escapeControlCharsInJsonStrings(s) {
  if (!s || typeof s !== 'string') return s;
  let out = '';
  let inStr = false, esc = false;
  const n = s.length;
  for (let i = 0; i < n; i++) {
    const ch = s[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (ch === '\\' && inStr) {
      // Backslash : valide seulement \" \\ / et \uXXXX.
      // b f n r t sont TRAITES COMME LATEX (\neq, \frac, \tan, \bar) car les
      // vraies nouvelles lignes sont interdites dans les valeurs (regle JSON).
      const next = i + 1 < n ? s[i + 1] : '';
      if (next === 'u' && /^[0-9a-fA-F]{4}/.test(s.slice(i + 2, i + 6))) { out += ch; esc = true; continue; }
      if ('"\\/'.includes(next)) { out += ch; esc = true; continue; }
      out += '\\\\';
      continue;
    }
    if (inStr) {
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
    }
    out += ch;
  }
  return out;
}

// Guillemets doubles NON echappes a l'interieur des chaines ("le nombre "a" tel que")
// -> heuristique : un " suivi d'un caractere non structurel est un guillemet interne.
function escapeInnerQuotes(s) {
  if (!s || typeof s !== 'string') return s;
  let out = '';
  let inStr = false, esc = false;
  const n = s.length;
  for (let i = 0; i < n; i++) {
    const ch = s[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\') { out += ch; esc = true; continue; }
    if (ch === '"') {
      if (!inStr) { inStr = true; out += ch; continue; }
      let j = i + 1;
      while (j < n && (s[j] === ' ' || s[j] === '\t' || s[j] === '\n' || s[j] === '\r')) j++;
      const next = j < n ? s[j] : '';
      if (next === '' || ':,}]'.includes(next)) { inStr = false; out += ch; }
      else { out += '\\"'; }
      continue;
    }
    out += ch;
  }
  return out;
}

function repairJson(str) {
  if (!str || typeof str !== 'string') return null;

  let s = String(str).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try { return JSON.parse(s); } catch (_) {}

  const firstBrace = s.indexOf('{');
  if (firstBrace === -1) return null;
  const lastBrace = s.lastIndexOf('}');
  // Reponse tronquee sans AUCUN '}' : reparer depuis la premiere accolade
  let candidate = (lastBrace > firstBrace) ? s.slice(firstBrace, lastBrace + 1) : s.slice(firstBrace);
  try { return JSON.parse(candidate); } catch (_) {}

  // Rejouer la PILE d'imbrication pour fermer dans le bon ordre
  const stack = [];
  let inString = false, escape = false;
  for (const ch of candidate) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
  }

  let suffix = '';
  if (escape) candidate = candidate.slice(0, -1);
  if (inString) suffix += '"';
  while (stack.length) suffix += stack.pop();
  candidate += suffix;

  try { return JSON.parse(candidate); } catch (_) {}
  return null;
}

async function callProvider(provider, { systemPrompt, userPrompt, maxTokens = 4000, deadline }) {
  const controller = new AbortController();
  const timeouts = { 'Groq': 20000, 'OpenRouter': 32000, 'Mistral': 55000, 'Gemini': 45000 };
  const baseTimeout = timeouts[provider.name] || 20000;
  const remaining = deadline ? Math.max(5000, deadline - Date.now()) : baseTimeout;
  const timeoutMs = Math.min(baseTimeout, remaining);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let rawContent = null;

    if (provider.gemini) {
      // API generateContent : JSON natif via responseMimeType
      const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }
        }
      };
      const result = await fetch(`${provider.endpoint}?key=${provider.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const data = await result.json().catch(() => null);
      if (!result.ok) {
        const msg = data?.error?.message || `HTTP ${result.status}`;
        throw new Error(`${provider.name}: ${msg}`);
      }
      rawContent = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      if (!rawContent) {
        const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'réponse vide';
        throw new Error(`${provider.name}: ${reason}`);
      }
    } else {
      const body = {
        model: provider.model,
        temperature: 0.3,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      };

      if (provider.jsonMode) body.response_format = { type: 'json_object' };

      const result = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.key}`,
          ...(provider.headers || {})
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const data = await result.json().catch(() => null);
      if (!result.ok) {
        const msg = data?.error?.message || `HTTP ${result.status}`;
        throw new Error(`${provider.name}: ${msg}`);
      }

      rawContent = data?.choices?.[0]?.message?.content;
      if (!rawContent) throw new Error(`${provider.name}: réponse vide`);
    }

    const cleaned = String(rawContent).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try { return JSON.parse(cleaned); }
    catch (_) {
      const repaired = repairJson(cleaned);
      if (repaired) {
        console.warn(`[AI] ${provider.name} — JSON réparé avec succès`);
        return repaired;
      }
      const sanitized = escapeControlCharsInJsonStrings(cleaned);
      try { return JSON.parse(sanitized); }
      catch (posErr) {
        const repaired2 = repairJson(sanitized);
        if (repaired2) {
          console.warn(`[AI] ${provider.name} — JSON réparé (contrôles + LaTeX)`);
          return repaired2;
        }
        // Diagnostic : message V8 (token fautif) + contexte si position disponible
        let ctx = ` [${String(posErr?.message || '').slice(0, 200)}]`;
        const pm = /position (\d+)/.exec(String(posErr?.message || ''));
        if (pm) {
          const p = parseInt(pm[1], 10);
          ctx += ` [vers ${sanitized.slice(Math.max(0, p - 120), p + 120).replace(/[\n\r\t]/g, '⏎')}]`;
        }
        console.warn(`[AI] ${provider.name} — JSON invalide non réparable. Début: ${cleaned.slice(0, 200)}`);
        throw new Error(`${provider.name}: JSON invalide${ctx}`);
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

// v8.6 — FILES SÉQUENTIELLES PAR FOURNISSEUR (anti-collision) :
// le fan-out simultané faisait partir 2 tâches lourdes (explanation + qcm)
// chez le MÊME fournisseur gratuit → concurrence refusée → tâches perdues.
// Désormais chaque fournisseur exécute SES tâches en file (séquentiel),
// les files tournent en parallèle. Repli sur fournisseur INACTIF uniquement.
// + GESTION DES 429 : un fournisseur en rate-limit est écarté 25 s (retry-after si fourni).
// Affectation calibrée sur les limites réelles observées :
// - Groq (TPM 8000/min) : UNIQUEMENT l'explication (tâche la plus critique)
// - OpenRouter (lent mais sans TPM serré) : questions + qcm en file
// - Mistral : structure
const TASK_PROVIDER_PREF = {
  explanation: ['Groq', 'Gemini', 'Mistral', 'OpenRouter'],
  structure:   ['Mistral', 'Gemini', 'OpenRouter', 'Groq'],
  questions_a: ['Gemini', 'Mistral', 'OpenRouter', 'Groq'],
  questions_b: ['Mistral', 'Gemini', 'OpenRouter', 'Groq'],
  qcm:         ['Gemini', 'Mistral', 'OpenRouter', 'Groq']
};

function distributeTasks(tasks, providers) {
  if (providers.length === 0) return [];
  const byName = new Map(providers.map((p) => [p.name, p]));
  const queues = new Map();
  tasks.forEach((task, i) => {
    const pref = TASK_PROVIDER_PREF[task.name] || providers.map((p) => p.name);
    let provider = null;
    for (const name of pref) {
      if (byName.has(name)) { provider = byName.get(name); break; }
    }
    if (!provider) provider = providers[i % providers.length];
    if (!queues.has(provider.name)) queues.set(provider.name, { provider, tasks: [] });
    queues.get(provider.name).tasks.push({ task, index: i });
  });
  return Array.from(queues.values());
}

async function runParallelTasks(tasks, providers, deadline) {
  const queues = distributeTasks(tasks, providers);
  const results = new Array(tasks.length).fill(null);
  // Concurrence max par fournisseur : Mistral (payant) accepte 2 requêtes
  // parallèles ; Groq est limité à 1 (TPM 8000/min) ; OpenRouter 2.
  const MAX_CONC = { 'Groq': 1, 'OpenRouter': 2, 'Mistral': 2, 'Gemini': 3 };
  const busy = new Map(providers.map((p) => [p.name, 0]));
  const blockedUntil = new Map(providers.map((p) => [p.name, 0]));

  function usable(p) {
    const cap = MAX_CONC[p.name] || 1;
    return (busy.get(p.name) || 0) < cap && (blockedUntil.get(p.name) || 0) <= Date.now();
  }
  function release(p) {
    busy.set(p.name, Math.max(0, (busy.get(p.name) || 1) - 1));
  }
  // Réserve atomiquement (test-and-set, sans await entre les deux) le premier
  // fournisseur UTILISABLE dans l'ordre de préférence donné (capacité libre +
  // non bloqué). Respecte l'ordre de TASK_PROVIDER_PREF pour les replis.
  async function reserveFromPref(prefNames, triedNames) {
    while (deadline && Date.now() < deadline - 8000) {
      for (const name of prefNames) {
        if (triedNames.includes(name)) continue;
        const p = providers.find((x) => x.name === name);
        if (p && usable(p)) { busy.set(p.name, (busy.get(p.name) || 0) + 1); return p; }
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    return null;
  }

  async function callMarked(provider, task) {
    try {
      const value = await callProvider(provider, {
        systemPrompt: task.systemPrompt,
        userPrompt: task.userPrompt,
        maxTokens: task.maxTokens,
        deadline
      });
      return value;
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('HTTP 429') || /rate limit/i.test(msg) || /quota/i.test(msg)) {
        // Quota JOURNALIER épuisé → inutile de retenter avant longtemps.
        // Quota à la minute → réessayer dans 25 s.
        const daily = /per day|TPD|daily/i.test(msg);
        const waitMs = daily ? 600000 : 25000;
        blockedUntil.set(provider.name, Date.now() + waitMs);
        console.warn(`[FAN-OUT] ${provider.name} en rate-limit (${daily ? 'QUOTIDIEN' : 'minute'}), écarté ${waitMs / 1000} s`);
      } else if (/abort/i.test(msg)) {
        // Fournisseur qui dépasse systématiquement son timeout → petit repos.
        blockedUntil.set(provider.name, Date.now() + 15000);
      }
      throw e;
    }
  }

  // Exécute une tâche : réserve le fournisseur préféré (dans l'ordre de
  // préférence, capacité respectée) puis jusqu'à 2 replis préférentiels.
  // Toutes les erreurs rencontrées sont accumulées pour le diagnostic meta.
  async function executeTask(task, preferred) {
    const tried = [];
    const errs = [];
    let value = null;
    const prefNames = TASK_PROVIDER_PREF[task.name] || providers.map((p) => p.name);
    const order = [preferred.name, ...prefNames.filter((n) => n !== preferred.name)];

    const first = await reserveFromPref(order, tried);
    if (!first) {
      return { value: null, providerName: preferred.name, err: new Error('aucun fournisseur disponible avant deadline') };
    }
    tried.push(first.name);

    try { value = await callMarked(first, task); }
    catch (e) { errs.push(`${first.name}: ${e?.message || e}`); }
    finally { release(first); }

    for (let attempt = 0; attempt < 2 && !value; attempt++) {
      if (deadline && Date.now() > deadline - 8000) {
        console.warn(`[FAN-OUT] Tâche "${task.name}" : deadline proche, plus de repli`);
        break;
      }
      const alt = await reserveFromPref(order, tried);
      if (!alt) { console.warn(`[FAN-OUT] Tâche "${task.name}" : aucun fournisseur utilisable avant deadline`); break; }
      tried.push(alt.name);
      try {
        value = await callMarked(alt, task);
        if (value) console.log(`[FAN-OUT] Repli OK : "${task.name}" via ${alt.name}`);
      } catch (e2) { errs.push(`${alt.name}: ${e2?.message || e2}`); }
      finally { release(alt); }
    }

    // 2e chance pour l'explication : le JSON des longues proses est non
    // déterministe — un même fournisseur peut réussir au 2e essai.
    // Jusqu'à 2 retentations (dernier fournisseur en échec JSON d'abord,
    // sinon Mistral), tant que le deadline le permet.
    if (!value && task.name === 'explanation') {
      for (let retry = 0; retry < 2 && !value; retry++) {
        if (deadline && Date.now() > deadline - 25000) break;
        let retryName = null;
        // D'abord le dernier fournisseur en échec transitoire (demande/abort)
        for (let i = errs.length - 1; i >= 0; i--) {
          if (/high demand|aborted|429/i.test(errs[i])) { retryName = errs[i].split(':')[0]; break; }
        }
        // Sinon le dernier en échec JSON (non déterministe)
        if (!retryName) {
          for (let i = errs.length - 1; i >= 0; i--) {
            if (errs[i].includes('JSON invalide')) { retryName = errs[i].split(':')[0]; break; }
          }
        }
        if (!retryName) retryName = 'Mistral';
        const rp = providers.find((p) => p.name === retryName);
        if (!rp) break;
        console.warn(`[FAN-OUT] 2e chance : "${task.name}" retenté sur ${rp.name}`);
        busy.set(rp.name, (busy.get(rp.name) || 0) + 1);
        try {
          value = await callMarked(rp, task);
          if (value) console.log(`[FAN-OUT] 2e chance réussie : "${task.name}" via ${rp.name}`);
          else errs.push(`${rp.name}: 2e essai vide`);
        } catch (e3) { errs.push(`${rp.name} (2e essai): ${e3?.message || e3}`); }
        finally { release(rp); }
      }
    }

    return { value, providerName: first.name, err: errs.length ? new Error(errs.join(' | ')) : null };
  }

  await Promise.all(queues.map((queue) => (async () => {
    for (const { task, index } of queue.tasks) {
      const { value, providerName, err } = await executeTask(task, queue.provider);
      if (!value) {
        console.warn(`[FAN-OUT] Tâche "${task.name}" échouée — raison: ${err?.message || 'unknown'}`);
      }
      results[index] = value
        ? { status: 'fulfilled', value, task, provider: providerName }
        : { status: 'rejected', error: err, task, provider: 'none' };
    }
  })()));

  results.forEach((r) => {
    if (!r) return;
    if (r.status === 'fulfilled') console.log(`[FAN-OUT] OK ${r.task.name} (via ${r.provider})`);
    else console.error(`[FAN-OUT] FAIL ${r.task.name} - raison: ${r.error?.message || 'unknown'}`);
  });

  return results;
}

function mergeAnalysis(results, profile) {
  const merged = {
    profile,
    sectionTitle: null,
    explanation: null,
    structure: null,
    questions: [],
    qcm: [],
    extracted: null
  };

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const data = r.value;
    const taskName = r.task.name;

    switch (taskName) {
      case 'extraction':
        merged.sectionTitle = data.sectionTitle || merged.sectionTitle;
        merged.extracted = data;
        break;
      case 'explanation':
        merged.explanation = data;
        merged.sectionTitle = data.sectionTitle || merged.sectionTitle;
        break;
      case 'structure':
        merged.structure = data;
        break;
      case 'questions_a':
      case 'questions_b':
        if (Array.isArray(data.questions)) merged.questions.push(...data.questions);
        else if (data.questions && typeof data.questions === 'object') merged.questions.push(data.questions);
        break;
      case 'qcm':
        if (Array.isArray(data.qcm)) merged.qcm.push(...data.qcm);
        else if (data.qcm && typeof data.qcm === 'object' && data.qcm.question) merged.qcm.push(data.qcm);
        break;
    }
  }

  return merged;
}

// ────────────────────────────────────────────────────────────────
// NORMALISATION POST-GÉNÉRATION (v8.6)
// Garantit que la page ne reçoit QUE des questions/QCM exploitables.
// ────────────────────────────────────────────────────────────────
function normalizeAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') return analysis;

  // Banque de questions : filtrer + renuméroter + borner
  if (Array.isArray(analysis.questions)) {
    analysis.questions = analysis.questions
      .filter((q) => q && typeof q.question === 'string' && q.question.trim().length > 0 &&
                     typeof q.answer === 'string' && q.answer.trim().length > 0)
      .map((q, i) => ({
        id: `q${i + 1}`,
        level: Math.min(3, Math.max(1, Number(q.level) || (i % 2 === 0 ? 1 : 2))),
        type: (typeof q.type === 'string' && q.type.trim()) ? q.type.trim() : (i % 2 === 0 ? 'definition' : 'application'),
        question: q.question.trim(),
        answer: q.answer.trim(),
        mustHave: Array.isArray(q.mustHave)
          ? q.mustHave.filter((m) => typeof m === 'string' && m.trim()).slice(0, 6)
          : [],
        importance: Math.min(3, Math.max(1, Number(q.importance) || 1))
      }));
  }

  // QCM : garder uniquement les entrées cohérentes, normaliser les lettres
  if (Array.isArray(analysis.qcm)) {
    analysis.qcm = analysis.qcm
      .map((q) => {
        if (!q || typeof q.question !== 'string' || !q.question.trim() || !Array.isArray(q.options)) return null;
        const options = q.options
          .filter((o) => o && typeof o.text === 'string' && o.text.trim())
          .slice(0, 5)
          .map((o, i) => ({ id: String.fromCharCode(65 + i), text: String(o.text).trim() }));
        if (options.length < 2) return null;
        let correct = String(q.correct || 'A').trim().toUpperCase().slice(0, 1);
        if (!options.some((o) => o.id === correct)) correct = 'A';
        return {
          question: q.question.trim(),
          options,
          correct,
          explanation: (typeof q.explanation === 'string' && q.explanation.trim()) ? q.explanation.trim() : ''
        };
      })
      .filter(Boolean);
  }

  return analysis;
}

// ────────────────────────────────────────────────────────────────
// RÈGLES COMMUNES
// ────────────────────────────────────────────────────────────────
const LATEX_RULES = `
RÈGLE LATEX — OBLIGATOIRE :
- Toute formule mathématique DOIT être entre $...$ (inline) ou $$...$$ (display).
- INTERDIT : LaTeX brut sans $ (ex : "v = \\sqrt{x}" doit devenir "$v = \\sqrt{x}$").
- INTERDIT : symboles Unicode mathématiques bruts (π, √, ², ≤, ≥, ∞, →, ×, ·, ≠, ∈, ∑, ∫, Δ).
- Ajoute TOUJOURS un espace après une commande LaTeX sans argument (ex : "\\cdotp mol", pas "\\cdotpmol").
- Utilise \\cdot ou \\cdotp (avec espace) pour le point médian : "g \\cdot mol^{-1}".
`.trim();

const PERIMETER_RULES = `
RÈGLE DE PÉRIMÈTRE STRICT :
- Tu travailles UNIQUEMENT sur la section fournie par l'élève.
- INTERDICTION de mentionner ou d'utiliser une connaissance externe au texte fourni.
`.trim();

const JSON_STRICT_RULES = `
RÈGLE JSON STRICTE :
- Réponds UNIQUEMENT avec un objet JSON valide.
- Pas de texte avant ou après le JSON.
- Pas de markdown (\`\`\`).
- Échappe correctement les guillemets doubles dans les chaînes (\\").
- Utilise des apostrophes droites (') et non typographiques.
- INTERDIT les retours à la ligne à l'intérieur d'une valeur : écris chaque valeur sur UNE seule ligne, sépare les idées par des points.
- Respecte EXACTEMENT les quantités demandées dans la tâche (nombre de parties, de questions, de QCM).
- Si la réponse risque d'être longue, reste concis sur CHAQUE élément plutôt que de réduire le nombre d'éléments.
`.trim();

// ────────────────────────────────────────────────────────────────
// PROMPTS PAR PROFIL
// ────────────────────────────────────────────────────────────────
function buildScientificPrompts({ subjectLabel, rawInput }) {
  const baseContext = `Matière : ${subjectLabel}
═══════════════════════════════════════════════════════════════
CONTENU DE LA SECTION FOURNIE PAR L'ÉLÈVE
═══════════════════════════════════════════════════════════════
${rawInput}
═══════════════════════════════════════════════════════════════`.trim();

  return [
    {
      name: 'explanation',
      maxTokens: 3200,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide, sans commentaire.',
      userPrompt: `Tu es professeur expert du BAC, pédagogue et passionné. Explique cette section comme à un élève qui découvre, devant ta classe.

${baseContext}

${PERIMETER_RULES}
${LATEX_RULES}

RÈGLES PÉDAGOGIQUES — STYLE PROF :
- Commence par l'essentiel, puis détaille étape par étape, sans sauter de raisonnement.
- Utilise au moins une ANALOGIE concrète de la vie quotidienne quand c'est possible.
- Chaque idée doit être EXPLIQUÉE en français simple. Aucun jargon sans explication.
- Phrases complètes et rédigées, jamais de listes télégraphiques.
- Couvre TOUT le contenu de la section (2 à 5 parties selon sa richesse).
- Chaque partie : keyTerms avec 2 à 4 termes clés expliqués simplement.

Format JSON :
{
  "sectionTitle": "...",
  "understanding": "Ce que tu dois comprendre en 2-3 phrases.",
  "parts": [
    {
      "partTitle": "Partie 1",
      "mainIdea": "Idée principale",
      "simpleExplanation": "Explication en français simple (3-6 phrases).",
      "keyTerms": [{"term": "...", "meaning": "..."}],
      "relations": ["relation 1"],
      "example": "Exemple chiffré si présent",
      "toRemember": "Ce qu'il faut retenir"
    }
  ]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'structure',
      maxTokens: 3500,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Extrait la structure scientifique de cette section.

${baseContext}

${PERIMETER_RULES}
${LATEX_RULES}

Ne mets QUE ce qui est présent dans la section. Si pas de formule → tableau vide.

Format JSON :
{
  "formulas": [{"latex": "$z = a + bi$", "description": "...", "variables": [{"symbol": "a", "meaning": "..."}], "condition": "..."}],
  "method": {"title": "Méthode", "steps": ["Étape 1"]},
  "examples": [{"enonce": "...", "steps": ["..."], "result": "$...$"}],
  "traps": [{"trap": "...", "solution": "..."}]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_a',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions de NOTIONS DE BASE sur cette section (définitions, concepts, faits essentiels).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- mustHave : 2 à 3 éléments indispensables pour une réponse complète.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_b',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions AVANCÉES sur cette section (application, analyse, raisonnement, explication d'exemples).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- Types variés : application, analyse, raisonnement, calcul si la matière s'y prête.
- mustHave : 2 à 3 éléments indispensables.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    }
  ];
}

function buildSvtPrompts({ subjectLabel, rawInput }) {
  const baseContext = `Matière : ${subjectLabel}
═══════════════════════════════════════════════════════════════
CONTENU DE LA SECTION FOURNIE PAR L'ÉLÈVE
═══════════════════════════════════════════════════════════════
${rawInput}
═══════════════════════════════════════════════════════════════`.trim();

  return [
    {
      name: 'explanation',
      maxTokens: 3200,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide, sans commentaire.',
      userPrompt: `Tu es professeur de SVT, pédagogue et passionné. Explique cette section comme à un élève qui découvre, devant ta classe.

${baseContext}

${PERIMETER_RULES}

RÈGLES SVT :
- Explication EN FRANÇAIS simple, phrases complètes et rédigées.
- Décris chaque MÉCANISME étape par étape (aucune étape sous-entendue).
- Explique les RELATIONS (organe A → organe B) en disant POURQUOI.
- Utilise des termes biologiques précis MAIS explique-les.
- Utilise au moins une analogie concrète quand c'est possible.
- Couvre TOUT le contenu de la section (2 à 5 parties).

Format JSON :
{
  "sectionTitle": "...",
  "understanding": "...",
  "parts": [
    {
      "partTitle": "...",
      "mainIdea": "...",
      "simpleExplanation": "...",
      "terms": [{"term": "...", "meaning": "..."}],
      "mechanism": {"description": "...", "steps": ["Étape 1"]},
      "relations": ["relation 1"],
      "toRemember": "..."
    }
  ]
}

CONTRAINTES :
- Maximum 5 parties (parts).
- Chaque simpleExplanation : 3 à 6 phrases.

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'structure',
      maxTokens: 3000,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Structure cette section de SVT.

${baseContext}

${PERIMETER_RULES}

PAS de formules.

Format JSON :
{
  "mechanisms": [{"name": "...", "steps": ["..."], "relations": ["..."], "consequences": ["..."]}],
  "definitions": [{"term": "...", "definition": "..."}],
  "classifications": [{"category": "...", "items": ["..."]}]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_a',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions de NOTIONS DE BASE sur cette section (définitions, concepts, faits essentiels).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- mustHave : 2 à 3 éléments indispensables pour une réponse complète.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_b',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions AVANCÉES sur cette section (application, analyse, raisonnement, explication d'exemples).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- Types variés : application, analyse, raisonnement, calcul si la matière s'y prête.
- mustHave : 2 à 3 éléments indispensables.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    }
  ];
}

function buildPhilosophyPrompts({ subjectLabel, rawInput }) {
  const baseContext = `Matière : ${subjectLabel}
═══════════════════════════════════════════════════════════════
CONTENU DE LA SECTION FOURNIE PAR L'ÉLÈVE
═══════════════════════════════════════════════════════════════
${rawInput}
═══════════════════════════════════════════════════════════════`.trim();

  return [
    {
      name: 'explanation',
      maxTokens: 3200,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide, sans commentaire.',
      userPrompt: `Tu es professeur de philosophie. Explique cette section COMME SI L'ÉLÈVE N'Y CONNAISSAIT RIEN.

${baseContext}

${PERIMETER_RULES}

RÈGLES PHILO :
- VULGARISE chaque concept philosophique.
- Décompose chaque argument.
- Donne des exemples du quotidien.

Format JSON :
{
  "sectionTitle": "...",
  "understanding": "...",
  "parts": [
    {
      "partTitle": "...",
      "mainIdea": "...",
      "simpleExplanation": "Explication longue (5-10 phrases).",
      "keyTerms": [{"term": "...", "meaning": "..."}],
      "arguments": ["Argument 1"],
      "everydayExamples": ["Exemple 1"],
      "toRemember": "..."
    }
  ]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'structure',
      maxTokens: 3000,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Structure cette section de philosophie.

${baseContext}

${PERIMETER_RULES}

Format JSON :
{
  "theses": [{"thesis": "...", "arguments": ["..."]}],
  "vocabulary": [{"term": "...", "meaning": "..."}],
  "plans": [{"title": "Plan", "parties": ["I. ...", "II. ..."]}]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_a',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions de NOTIONS DE BASE sur cette section (définitions, concepts, faits essentiels).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- mustHave : 2 à 3 éléments indispensables pour une réponse complète.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_b',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions AVANCÉES sur cette section (application, analyse, raisonnement, explication d'exemples).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- Types variés : application, analyse, raisonnement, calcul si la matière s'y prête.
- mustHave : 2 à 3 éléments indispensables.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    }
  ];
}

function buildHistoryPrompts({ subjectLabel, rawInput }) {
  const baseContext = `Matière : ${subjectLabel}
═══════════════════════════════════════════════════════════════
CONTENU DE LA SECTION FOURNIE PAR L'ÉLÈVE
═══════════════════════════════════════════════════════════════
${rawInput}
═══════════════════════════════════════════════════════════════`.trim();

  return [
    {
      name: 'explanation',
      maxTokens: 3200,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Tu es professeur d'histoire-géographie. Présente cette section CLAIREMENT, comme devant ta classe.

${baseContext}

${PERIMETER_RULES}

RÈGLES :
- "understanding" : récit clair et structuré de 6 à 10 phrases (dates, acteurs, enjeux expliqués simplement).
- "context" : situation avant l'événement / le phénomène, en 2 à 4 phrases.
- "keyFacts" : 6 à 10 faits essentiels à retenir, chacun une phrase complète.

Format JSON :
{
  "sectionTitle": "...",
  "understanding": "Résumé en 5-8 phrases.",
  "context": "...",
  "keyFacts": ["fait 1"]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'structure',
      maxTokens: 2500,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Structure cette section d'histoire-géo.

${baseContext}

${PERIMETER_RULES}

Format JSON :
{
  "timeline": [{"date": "...", "event": "..."}],
  "causesConsequences": [{"cause": "...", "consequence": "..."}],
  "keyFigures": [{"name": "...", "role": "..."}],
  "vocabulary": [{"term": "...", "meaning": "..."}]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_a',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions de NOTIONS DE BASE sur cette section (définitions, concepts, faits essentiels).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- mustHave : 2 à 3 éléments indispensables pour une réponse complète.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_b',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions AVANCÉES sur cette section (application, analyse, raisonnement, explication d'exemples).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- Types variés : application, analyse, raisonnement, calcul si la matière s'y prête.
- mustHave : 2 à 3 éléments indispensables.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    }
  ];
}

function buildFrenchPrompts({ subjectLabel, rawInput }) {
  const baseContext = `Matière : ${subjectLabel}
═══════════════════════════════════════════════════════════════
CONTENU DE LA SECTION FOURNIE PAR L'ÉLÈVE
═══════════════════════════════════════════════════════════════
${rawInput}
═══════════════════════════════════════════════════════════════`.trim();

  return [
    {
      name: 'explanation',
      maxTokens: 3200,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Tu es professeur de français. Explique cette section clairement.

${baseContext}

${PERIMETER_RULES}

Format JSON :
{
  "sectionTitle": "...",
  "understanding": "...",
  "parts": [
    {
      "partTitle": "...",
      "mainIdea": "...",
      "simpleExplanation": "...",
      "keyTerms": [{"term": "...", "meaning": "..."}],
      "toRemember": "..."
    }
  ]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'structure',
      maxTokens: 2500,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Structure cette section de français.

${baseContext}

${PERIMETER_RULES}

Format JSON :
{
  "literaryDevices": [{"name": "...", "definition": "...", "example": "..."}],
  "vocabulary": [{"term": "...", "meaning": "..."}],
  "texts": [{"title": "...", "author": "...", "analysis": "..."}]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_a',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions de NOTIONS DE BASE sur cette section (définitions, concepts, faits essentiels).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- mustHave : 2 à 3 éléments indispensables pour une réponse complète.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_b',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions AVANCÉES sur cette section (application, analyse, raisonnement, explication d'exemples).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- Types variés : application, analyse, raisonnement, calcul si la matière s'y prête.
- mustHave : 2 à 3 éléments indispensables.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    }
  ];
}

function buildLanguagePrompts({ subjectLabel, rawInput }) {
  const baseContext = `Matière : ${subjectLabel}
═══════════════════════════════════════════════════════════════
CONTENU DE LA SECTION FOURNIE PAR L'ÉLÈVE
═══════════════════════════════════════════════════════════════
${rawInput}
═══════════════════════════════════════════════════════════════`.trim();

  return [
    {
      name: 'explanation',
      maxTokens: 3200,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Tu es professeur d'anglais pour des FRANCOPHONES DÉBUTANTS.

${baseContext}

${PERIMETER_RULES}

RÈGLES LANGUE :
- EXPLICATIONS TOUJOURS EN FRANÇAIS.
- EXEMPLES EN ANGLAIS avec TRADUCTION SYSTÉMATIQUE.

Format JSON :
{
  "sectionTitle": "...",
  "understanding": "...",
  "parts": [
    {
      "partTitle": "...",
      "mainIdea": "...",
      "simpleExplanation": "Explication EN FRANÇAIS (5-10 phrases).",
      "keyTerms": [{"english": "word", "french": "traduction", "example": "example"}],
      "examples": [{"english": "English sentence.", "french": "Traduction."}],
      "commonMistakes": [{"mistake": "...", "correction": "..."}],
      "toRemember": "..."
    }
  ]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'structure',
      maxTokens: 3000,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Structure cette section d'anglais.

${baseContext}

${PERIMETER_RULES}

Format JSON :
{
  "vocabulary": [{"english": "...", "french": "...", "phonetic": "..."}],
  "grammar": [{"rule": "...", "explanation_fr": "...", "examples": [{"english": "...", "french": "..."}]}],
  "phrases": [{"english": "...", "french": "..."}]
}

${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_a',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions de NOTIONS DE BASE sur cette section (définitions, concepts, faits essentiels).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- mustHave : 2 à 3 éléments indispensables pour une réponse complète.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    },
    {
      name: 'questions_b',
      maxTokens: 2400,
      systemPrompt: 'Tu produis EXCLUSIVEMENT du JSON valide.',
      userPrompt: `Génère 5 à 13 questions AVANCÉES sur cette section (application, analyse, raisonnement, explication d'exemples).

$${baseContext}

$${PERIMETER_RULES}

RÈGLES :
- Entre 5 et 13 questions, réponses rédigées (1 à 2 phrases), jamais un mot isolé.
- Types variés : application, analyse, raisonnement, calcul si la matière s'y prête.
- mustHave : 2 à 3 éléments indispensables.

Format JSON :
{
  "questions": [{"id": "q1", "question": "...", "answer": "...", "mustHave": ["..."]}]
}

$${JSON_STRICT_RULES}

Réponds UNIQUEMENT avec le JSON.`
    }
  ];
}

function getPromptsForProfile(profile, context) {
  let tasks;
  switch (profile) {
    case 'scientific': tasks = buildScientificPrompts(context); break;
    case 'svt':        tasks = buildSvtPrompts(context); break;
    case 'philosophy': tasks = buildPhilosophyPrompts(context); break;
    case 'history':    tasks = buildHistoryPrompts(context); break;
    case 'french':     tasks = buildFrenchPrompts(context); break;
    case 'language':   tasks = buildLanguagePrompts(context); break;
    default:           tasks = buildScientificPrompts(context);
  }
  // Files séquentielles : les tâches LÉGÈRES d'abord (questions ~20 s chacune)
  // pour que chaque tâche ait du budget devant elle. (QCM retiré v4.14)
  const order = { questions_a: 1, questions_b: 2, structure: 3, explanation: 4 };
  return tasks.slice().sort((a, b) => (order[a.name] ?? 9) - (order[b.name] ?? 9));
}

function buildFallbackAnalysis({ rawInput, profile }) {
  return {
    profile,
    sectionTitle: 'Section',
    explanation: {
      sectionTitle: 'Section',
      understanding: 'Analyse automatique indisponible. Contenu brut disponible ci-dessous.',
      parts: [{
        partTitle: 'Contenu',
        mainIdea: 'Contenu fourni',
        simpleExplanation: rawInput.slice(0, 500),
        keyTerms: [],
        toRemember: 'Réessayer plus tard.'
      }]
    },
    structure: null,
    questions: [],
    qcm: [],
    fallback: true
  };
}

// ────────────────────────────────────────────────────────────────
// QUOTAS
// ────────────────────────────────────────────────────────────────
async function reserveSectionQuota(uid) {
  const { db, FieldValue } = getAdminServices();
  const userRef = db.collection('users').doc(uid);
  const period = monthKey();
  const quotaRef = userRef.collection('notebookQuota').doc(`sections-${period}`);

  return db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error('profile_missing');
    if (isPremiumUser(userSnap.data())) {
      return { allowed: true, premium: true, used: 0, limit: Infinity, reserved: false };
    }

    const quotaSnap = await transaction.get(quotaRef);
    const used = Number(quotaSnap.data()?.count || 0);
    if (used >= FREE_SECTION_LIMIT) {
      return { allowed: false, used, limit: FREE_SECTION_LIMIT, premium: false, reserved: false };
    }

    transaction.set(quotaRef, {
      count: used + 1,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { allowed: true, used: used + 1, limit: FREE_SECTION_LIMIT, premium: false, reserved: true };
  });
}

// ✅ CORRECTION : releaseSectionQuota protégé contre les erreurs Firebase Admin
async function releaseSectionQuota(uid) {
  try {
    const { db, FieldValue } = getAdminServices();
    const period = monthKey();
    const quotaRef = db.collection('users').doc(uid).collection('notebookQuota').doc(`sections-${period}`);

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(quotaRef);
      const used = Math.max(0, Number(snap.data()?.count || 0) - 1);
      transaction.set(quotaRef, {
        count: used,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
  } catch (err) {
    console.warn('[PROGRESS] releaseSectionQuota failed:', err.message);
  }
}

async function markDailyActivity(uid, inc = {}) {
  const { db, FieldValue } = getAdminServices();
  const dateKey = todayKey();
  const ref = db.collection('users').doc(uid).collection('dailyActivity').doc(dateKey);
  await ref.set({
    date: dateKey,
    sectionsCreated: FieldValue.increment(inc.sectionsCreated || 0),
    lastAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function trackStudyTime(uid, body) {
  const minutes = Math.min(120, Math.max(1, Math.round(Number(body.minutes) || 0)));
  if (minutes <= 0) return { success: true, skipped: true };

  const { db, FieldValue } = getAdminServices();
  const today = todayKey();
  const ref = db.collection('users').doc(uid).collection('dailyActivity').doc(today);

  await ref.set({
    date: today,
    studyMinutes: FieldValue.increment(minutes),
    lastAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true, addedMinutes: minutes };
}

async function computeStudyTime(uid) {
  const { db } = getAdminServices();
  let snap;
  try {
    snap = await db.collection('users').doc(uid).collection('dailyActivity')
      .orderBy('date', 'desc').limit(365).get();
  } catch (e) {
    // ✅ CORRECTION : log visible au lieu de silencieux
    console.error('[PROGRESS] computeStudyTime failed:', e.message);
    return {
      totalMinutes: 0,
      totalHours: 0,
      todayMinutes: 0,
      weekMinutes: 0,
      formatted: { total: '0 min', week: '0 min', today: '0 min' }
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoKey = weekAgo.toISOString().slice(0, 10);

  let totalMinutes = 0;
  let todayMinutes = 0;
  let weekMinutes = 0;

  snap.docs.forEach((d) => {
    const data = d.data();
    const minutes = Number(data.studyMinutes || 0);
    totalMinutes += minutes;
    if (data.date === today) todayMinutes += minutes;
    if (data.date >= weekAgoKey) weekMinutes += minutes;
  });

  return {
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    todayMinutes,
    weekMinutes,
    formatted: {
      total: formatMinutes(totalMinutes),
      week: formatMinutes(weekMinutes),
      today: formatMinutes(todayMinutes)
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════
async function getDashboard(uid) {
  const { db } = getAdminServices();

  const chaptersPromises = ALLOWED_SUBJECTS_ARRAY.map((subjectKey) =>
    db
      .collection('users').doc(uid)
      .collection('notebooks').doc(subjectKey)
      .collection('chapters')
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get()
      .catch(() => ({ docs: [] }))
  );

  const streakPromise = computeStreak(uid);
  const studyTimePromise = computeStudyTime(uid);

  const [chaptersResults, streak, studyTime] = await Promise.all([
    Promise.all(chaptersPromises),
    streakPromise,
    studyTimePromise
  ]);

  const subjects = [];
  let totalChapters = 0;
  let totalSections = 0;

  ALLOWED_SUBJECTS_ARRAY.forEach((subjectKey, index) => {
    const chaptersSnap = chaptersResults[index];
    const info = SUBJECT_INFO[subjectKey];

    if (!chaptersSnap.docs || chaptersSnap.docs.length === 0) return;

    const chapters = chaptersSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || 'Chapitre',
        sectionsCount: data.sectionsCount || 0,
        last: formatRelativeDate(data.updatedAt || data.createdAt)
      };
    });

    const totalSubjectSections = chapters.reduce((s, c) => s + c.sectionsCount, 0);
    totalChapters += chapters.length;
    totalSections += totalSubjectSections;

    subjects.push({
      key: subjectKey,
      label: info.label,
      chaptersCount: chapters.length,
      sectionsCount: totalSubjectSections,
      last: chapters[0]?.last || ''
    });
  });

  subjects.sort((a, b) => b.sectionsCount - a.sectionsCount);

  let recentActivity = [];
  if (subjects.length > 0) {
    const topSubject = subjects[0];
    try {
      const lastChaptersSnap = await db
        .collection('users').doc(uid)
        .collection('notebooks').doc(topSubject.key)
        .collection('chapters')
        .orderBy('updatedAt', 'desc')
        .limit(3)
        .get();

      recentActivity = lastChaptersSnap.docs.map((d) => {
        const data = d.data();
        return {
          subject: topSubject.key,
          subjectLabel: topSubject.label,
          chapterId: d.id,
          chapterTitle: data.title || 'Chapitre',
          sectionsCount: data.sectionsCount || 0,
          time: formatRelativeDate(data.updatedAt || data.createdAt)
        };
      });
    } catch (e) {
      recentActivity = [];
    }
  }

  return {
    success: true,
    summary: { subjectsCount: subjects.length, totalChapters, totalSections },
    streak,
    studyTime,
    subjects,
    recentActivity
  };
}

async function computeStreak(uid) {
  const { db } = getAdminServices();
  let snap;
  try {
    snap = await db.collection('users').doc(uid).collection('dailyActivity')
      .orderBy('date', 'desc').limit(90).get();
  } catch (e) {
    // ✅ CORRECTION : log visible
    console.error('[PROGRESS] computeStreak failed:', e.message);
    return { current: 0, best: 0 };
  }

  if (snap.docs.length === 0) return { current: 0, best: 0 };

  const activeDates = new Set(snap.docs.map((d) => d.data().date).filter(Boolean));
  let current = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activeDates.has(key)) current++;
    else break;
  }

  const sorted = Array.from(activeDates).sort();
  let best = 0, run = 0, prev = null;
  sorted.forEach((dateStr) => {
    if (prev) {
      const diff = Math.round((new Date(dateStr) - new Date(prev)) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = dateStr;
  });

  return { current, best };
}

async function listChapters(uid, body) {
  const { subject } = body;
  if (!ALLOWED_SUBJECTS.has(subject)) throw { status: 400, message: 'Matière invalide.' };

  const { db } = getAdminServices();
  const snap = await db
    .collection('users').doc(uid)
    .collection('notebooks').doc(subject)
    .collection('chapters')
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get();

  const chapters = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title || 'Chapitre',
      sectionsCount: data.sectionsCount || 0,
      createdAt: toISO(data.createdAt),
      updatedAt: toISO(data.updatedAt),
      last: formatRelativeDate(data.updatedAt || data.createdAt)
    };
  });

  return { success: true, chapters };
}

async function createChapter(uid, body) {
  const { subject, title } = body;
  if (!ALLOWED_SUBJECTS.has(subject)) throw { status: 400, message: 'Matière invalide.' };
  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    throw { status: 400, message: 'Titre trop court.' };
  }

  const { db, FieldValue } = getAdminServices();
  const cleanTitle = title.trim().slice(0, 100);

  const ref = db
    .collection('users').doc(uid)
    .collection('notebooks').doc(subject)
    .collection('chapters').doc();

  await ref.set({
    title: cleanTitle,
    sectionsCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return { success: true, chapter: { id: ref.id, title: cleanTitle, sectionsCount: 0, last: 'à l\'instant' } };
}

async function getChapter(uid, body) {
  const { subject, chapterId } = body;
  if (!ALLOWED_SUBJECTS.has(subject)) throw { status: 400, message: 'Matière invalide.' };
  if (!chapterId) throw { status: 400, message: 'chapterId requis.' };

  const { db } = getAdminServices();
  const chapterRef = db
    .collection('users').doc(uid)
    .collection('notebooks').doc(subject)
    .collection('chapters').doc(chapterId);

  const chapterSnap = await chapterRef.get();
  if (!chapterSnap.exists) throw { status: 404, message: 'Chapitre introuvable.' };

  const data = chapterSnap.data();
  const sectionsSnap = await chapterRef.collection('sections').orderBy('createdAt', 'asc').get();

  const sections = sectionsSnap.docs.map((d) => {
    const s = d.data();
    const analysis = s.analysis || {};
    const questionsCount = Array.isArray(analysis.questions) ? analysis.questions.length : 0;
    const qcmCount = Array.isArray(analysis.qcm) ? analysis.qcm.length : 0;

    return {
      id: d.id,
      title: s.title || 'Section',
      questionsCount,
      qcmCount,
      time: formatRelativeDate(s.createdAt),
      status: 'done'
    };
  });

  return {
    success: true,
    chapter: {
      id: chapterId,
      title: data.title || 'Chapitre',
      subject,
      sectionsCount: sections.length,
      createdAt: toISO(data.createdAt),
      updatedAt: toISO(data.updatedAt)
    },
    sections
  };
}

async function createSection(uid, body) {
  const { subject, chapterId, rawInput } = body;

  if (!ALLOWED_SUBJECTS.has(subject)) throw { status: 400, message: 'Matière invalide.' };
  if (!chapterId) throw { status: 400, message: 'chapterId requis.' };
  if (!rawInput || typeof rawInput !== 'string') throw { status: 400, message: 'Contenu manquant.' };

  const trimmed = rawInput.trim();
  if (trimmed.length < MIN_CONTENT_LENGTH) {
    throw { status: 400, message: `Contenu trop court (min ${MIN_CONTENT_LENGTH} caractères).` };
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    throw { status: 400, message: `Contenu trop long (max ${MAX_CONTENT_LENGTH}).` };
  }
  if (!isMeaningfulContent(trimmed)) {
    throw { status: 400, message: 'Contenu trop court ou sans texte exploitable.' };
  }

  const quota = await reserveSectionQuota(uid);
  if (!quota.allowed) {
    throw {
      status: 429,
      message: `Limite gratuite atteinte (${quota.limit} sections/mois). Passe à Premium.`,
      code: 'FREE_SECTION_LIMIT'
    };
  }

  const { db, FieldValue } = getAdminServices();

  const chapterRef = db
    .collection('users').doc(uid)
    .collection('notebooks').doc(subject)
    .collection('chapters').doc(chapterId);

  const chapterSnap = await chapterRef.get();
  if (!chapterSnap.exists) {
    if (quota.reserved) await releaseSectionQuota(uid);
    throw { status: 404, message: 'Chapitre introuvable.' };
  }

  const info = SUBJECT_INFO[subject];
  const subjectLabel = info.label;
  const profile = info.profile;

  const normalizedInput = normalizeMathInput(trimmed);

  const context = { subjectLabel, rawInput: normalizedInput };
  const tasks = getPromptsForProfile(profile, context);
  const providers = getProviders();

  if (!providers.length) {
    if (quota.reserved) await releaseSectionQuota(uid);
    throw { status: 503, message: 'Aucun fournisseur IA disponible.' };
  }

  console.log(`[FAN-OUT] ${tasks.length} tâches, ${providers.length} fournisseurs pour profil "${profile}"`);

  let analysis;
  const t0 = Date.now();
  const meta = { elapsedMs: 0, counts: {}, providers: {}, failures: {} };
  try {
    const deadline = Date.now() + GLOBAL_AI_TIME_BUDGET_MS;
    const results = await runParallelTasks(tasks, providers, deadline);

    // Diagnostic renvoyé au client (meta) : fournisseur par tâche + échecs
    results.forEach((r) => {
      if (!r) return;
      if (r.status === 'fulfilled') meta.providers[r.task.name] = r.provider;
      else meta.failures[r.task.name] = String(r.error?.message || 'échec').slice(0, 900);
    });

    analysis = mergeAnalysis(results, profile);

    analysis = deepClean(analysis);
    analysis = normalizeAnalysis(analysis);

    if (!analysis.explanation || typeof analysis.explanation !== 'object') {
      console.warn('[FAN-OUT] explanation manquant -> fallback minimal');
      analysis.explanation = {
        sectionTitle: analysis.sectionTitle || 'Section',
        understanding: 'L\'explication pédagogique n\'a pas pu être générée pour cette section. Les questions restent disponibles ci-dessous.',
        parts: []
      };
    }

    const hasContent = (Array.isArray(analysis.explanation.parts) && analysis.explanation.parts.length > 0) ||
                       (Array.isArray(analysis.questions) && analysis.questions.length > 0);
    if (!hasContent) {
      console.warn('[FAN-OUT] Tout a échoué -> fallback complet');
      analysis = buildFallbackAnalysis({ rawInput: normalizedInput, profile });
    }
  } catch (err) {
    if (quota.reserved) await releaseSectionQuota(uid);
    throw err;
  }

  const sectionRef = chapterRef.collection('sections').doc();
  const sectionId = sectionRef.id;

  await sectionRef.set({
    title: analysis.sectionTitle || analysis.explanation?.sectionTitle || 'Section',
    rawInput: trimmed,
    profile,
    analysis,
    userNotes: '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await chapterRef.set({
    sectionsCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await markDailyActivity(uid, { sectionsCreated: 1 });

  meta.elapsedMs = Date.now() - t0;
  meta.counts = {
    parts: (Array.isArray(analysis.explanation?.parts) ? analysis.explanation.parts.length : 0),
    questions: (Array.isArray(analysis.questions) ? analysis.questions.length : 0)
  };

  return {
    success: true,
    sectionId,
    meta,
    section: {
      id: sectionId,
      title: analysis.sectionTitle || 'Section',
      rawInput: trimmed,
      profile,
      analysis,
      userNotes: ''
    }
  };
}

async function getSection(uid, body) {
  const { subject, chapterId, sectionId } = body;
  if (!ALLOWED_SUBJECTS.has(subject)) throw { status: 400, message: 'Matière invalide.' };
  if (!chapterId || !sectionId) throw { status: 400, message: 'IDs manquants.' };

  const { db } = getAdminServices();
  const ref = db
    .collection('users').doc(uid)
    .collection('notebooks').doc(subject)
    .collection('chapters').doc(chapterId)
    .collection('sections').doc(sectionId);

  const snap = await ref.get();
  if (!snap.exists) throw { status: 404, message: 'Section introuvable.' };

  const s = snap.data();
  return {
    success: true,
    section: {
      id: sectionId,
      title: s.title || 'Section',
      subject,
      chapterId,
      rawInput: s.rawInput || '',
      profile: s.profile || 'scientific',
      analysis: s.analysis || {},
      userNotes: s.userNotes || '',
      createdAt: toISO(s.createdAt),
      time: formatRelativeDate(s.createdAt)
    }
  };
}

async function updateNotes(uid, body) {
  const { subject, chapterId, sectionId, userNotes } = body;
  if (!ALLOWED_SUBJECTS.has(subject)) throw { status: 400, message: 'Matière invalide.' };
  if (!chapterId || !sectionId) throw { status: 400, message: 'IDs manquants.' };
  if (typeof userNotes !== 'string') throw { status: 400, message: 'userNotes invalide.' };

  const { db, FieldValue } = getAdminServices();
  const ref = db
    .collection('users').doc(uid)
    .collection('notebooks').doc(subject)
    .collection('chapters').doc(chapterId)
    .collection('sections').doc(sectionId);

  await ref.set({
    userNotes: userNotes.slice(0, 8000),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true };
}

async function deleteSection(uid, body) {
  const { subject, chapterId, sectionId } = body;
  if (!ALLOWED_SUBJECTS.has(subject)) throw { status: 400, message: 'Matière invalide.' };
  if (!chapterId || !sectionId) throw { status: 400, message: 'IDs manquants.' };

  const { db, FieldValue } = getAdminServices();
  const chapterRef = db
    .collection('users').doc(uid)
    .collection('notebooks').doc(subject)
    .collection('chapters').doc(chapterId);

  const sectionRef = chapterRef.collection('sections').doc(sectionId);
  const snap = await sectionRef.get();
  if (!snap.exists) throw { status: 404, message: 'Section introuvable.' };

  await sectionRef.delete();
  await chapterRef.set({
    sectionsCount: FieldValue.increment(-1),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true };
}

async function deleteChapter(uid, body) {
  const { subject, chapterId } = body;
  if (!ALLOWED_SUBJECTS.has(subject)) throw { status: 400, message: 'Matière invalide.' };
  if (!chapterId) throw { status: 400, message: 'chapterId requis.' };

  const { db } = getAdminServices();
  const chapterRef = db
    .collection('users').doc(uid)
    .collection('notebooks').doc(subject)
    .collection('chapters').doc(chapterId);

  const snap = await chapterRef.get();
  if (!snap.exists) throw { status: 404, message: 'Chapitre introuvable.' };

  const sectionsSnap = await chapterRef.collection('sections').get();
  const batch = db.batch();
  sectionsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(chapterRef);
  await batch.commit();

  return { success: true };
}

async function getFullLesson(uid, body) {
  const { subject, chapterId } = body;
  if (!ALLOWED_SUBJECTS.has(subject)) throw { status: 400, message: 'Matière invalide.' };
  if (!chapterId) throw { status: 400, message: 'chapterId requis.' };

  const { db } = getAdminServices();
  const chapterRef = db
    .collection('users').doc(uid)
    .collection('notebooks').doc(subject)
    .collection('chapters').doc(chapterId);

  const chapterSnap = await chapterRef.get();
  if (!chapterSnap.exists) throw { status: 404, message: 'Chapitre introuvable.' };

  const sectionsSnap = await chapterRef.collection('sections').orderBy('createdAt', 'asc').get();

  const sections = sectionsSnap.docs.map((d) => {
    const s = d.data();
    return {
      id: d.id,
      title: s.title || 'Section',
      profile: s.profile || 'scientific',
      analysis: s.analysis || {},
      userNotes: s.userNotes || ''
    };
  });

  return {
    success: true,
    chapter: { id: chapterId, title: chapterSnap.data().title || 'Chapitre', subject },
    sections
  };
}

// ═══════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════
module.exports = async function handler(request, response) {
  applyCors(request, response);

  if (request.method === 'OPTIONS') return response.status(204).end();

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return jsonError(response, 405, 'Méthode non autorisée.');
  }

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const action = body.action || '';

  // ✅ Rate limit adaptatif selon l'action (bucket isolé par action — v4.13)
  if (rateLimited(clientIp(request), action)) {
    return jsonError(response, 429, 'Service momentanément saturé. Réessaie dans quelques secondes.');
  }

  let user;
  try { user = await verifyFirebaseToken(request); }
  catch (e) {
    console.error('Auth error:', e.message);
    return jsonError(response, 503, 'Service temporairement indisponible.');
  }

  if (!user) return jsonError(response, 401, 'Connexion requise.', 'AUTH_REQUIRED');

  const uid = user.uid;

  console.log(`[PROGRESS v8.6] ${action} | uid=${uid.slice(0, 8)}`);

  try {
    switch (action) {
      case 'getDashboard':     return response.status(200).json(await getDashboard(uid));
      case 'listChapters':     return response.status(200).json(await listChapters(uid, body));
      case 'createChapter':    return response.status(200).json(await createChapter(uid, body));
      case 'getChapter':       return response.status(200).json(await getChapter(uid, body));
      case 'createSection':    return response.status(200).json(await createSection(uid, body));
      case 'getSection':       return response.status(200).json(await getSection(uid, body));
      case 'updateNotes':      return response.status(200).json(await updateNotes(uid, body));
      case 'deleteSection':    return response.status(200).json(await deleteSection(uid, body));
      case 'deleteChapter':    return response.status(200).json(await deleteChapter(uid, body));
      case 'getFullLesson':    return response.status(200).json(await getFullLesson(uid, body));
      case 'trackStudyTime':   return response.status(200).json(await trackStudyTime(uid, body));
      default:
        return jsonError(response, 400, `Action inconnue : "${action}"`);
    }
  } catch (error) {
    console.error(`[PROGRESS v8.6] "${action}" failed:`, error.message);
    if (error.status) return jsonError(response, error.status, error.message, error.code);
    return jsonError(response, 500, error.message || 'Erreur serveur.');
  }
};

// CONFIG VERCEL - assignee APRES module.exports (sinon ecrasee par
// l'assignation ci-dessus, jamais lue au build -> le budget IA 48 s
// serait tue par le timeout par defaut des functions Vercel)
module.exports.config = { maxDuration: 90 };
