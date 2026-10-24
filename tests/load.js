// Charge les bibliothèques de l'extension dans le contexte global de Node pour les tests.
const path = require('path');

const LIB = path.join(__dirname, '..', 'extension', 'lib');
for (const f of ['core.js', 'text.js', 'seo.js', 'keyword.js', 'youtube.js', 'ytapi.js']) {
  require(path.join(LIB, f));
}

module.exports = globalThis.MT;
