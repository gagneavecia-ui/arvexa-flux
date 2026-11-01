// ================================================================
// BUILD CACHE MANIFEST — ARVEXA School
// Usage : node build-cache-manifest.js
// ================================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const COURS_DIR = path.join(ROOT, 'cours');
const OUTPUT = path.join(ROOT, 'cache-manifest.json');

const MATIERES = ['mathematiques', 'physique', 'chimie', 'svt'];

function scanDirectory(dir, basePath = '') {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath, relPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.html', '.json'].includes(ext)) {
        files.push(relPath);
      }
    }
  }

  return files;
}

function buildManifest() {
  const manifest = {
    version: '1.0.0',
    generated: new Date().toISOString().slice(0, 10),
    matieres: {}
  };

  let totalFiles = 0;

  for (const matiere of MATIERES) {
    const matiereDir = path.join(COURS_DIR, matiere);
    const files = scanDirectory(matiereDir, `cours/${matiere}`);

    // Compter les chapitres (fichiers *_cours.json)
    const chapitres = files.filter((f) => f.endsWith('_cours.json')).length;

    manifest.matieres[matiere] = {
      chapitres,
      files
    };

    totalFiles += files.length;
    console.log(`✅ ${matiere} : ${files.length} fichiers (${chapitres} chapitres)`);
  }

  manifest.totalFiles = totalFiles;

  fs.writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n📦 cache-manifest.json généré : ${totalFiles} fichiers au total`);
}

buildManifest();
