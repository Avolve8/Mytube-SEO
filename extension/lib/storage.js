/*
 * MyTube SEO — stockage local (browser.storage.local) : paramètres et collections.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  const DEFAULT_SETTINGS = {
    region: 'FR',
    language: 'fr',
    apiKey: '',
    oauthClientId: '',
    claudeApiKey: '',
    claudeModel: 'claude-opus-5-5',
    claudeEffort: 'medium',
    myChannelId: '',
    myChannelTitle: '',
    panels: {
      watch: true,
      search: true,
      searchBadges: true,
      channel: true,
      studio: true,
      comments: true,
      shortcuts: true,
    },
    rankFrequencyHours: 24,
    competitorFrequencyHours: 24,
    alertFrequencyHours: 6,
    notifications: true,
    rpmMin: 0.5,
    rpmMax: 4,
    currency: 'EUR',
    translateEngine: 'google',
    theme: 'auto',
  };

  const DEFAULT_CHECKLIST = [
    'Mot-clé principal placé au début du titre',
    'Titre entre 40 et 70 caractères, sans majuscules abusives',
    'Mot-clé principal dans les 2 premières lignes de la description',
    'Description de 250 mots minimum avec liens utiles',
    'Chapitres (00:00 …) ajoutés dans la description',
    '1 à 3 hashtags pertinents',
    'Tags : mot-clé principal en premier, 300 à 500 caractères au total',
    'Miniature personnalisée lisible en petit format',
    'Écran de fin et fiches ajoutés',
    'Sous-titres vérifiés / ajoutés',
    'Vidéo ajoutée à une playlist',
    'Catégorie, langue et public (« conçu pour les enfants ») définis',
    'Commentaire épinglé avec un appel à l’action',
    'Partagée sur les réseaux sociaux',
  ].map((text, i) => ({ id: 'c' + i, text }));

  const DEFAULT_CANNED = [
    { id: 'r1', name: 'Merci !', text: 'Merci beaucoup pour ton commentaire {auteur} 🙏 Ça me fait super plaisir !' },
    { id: 'r2', name: 'Abonnement', text: 'Merci {auteur} ! Si la vidéo t’a plu, pense à t’abonner pour ne pas rater les prochaines 🔔' },
    { id: 'r3', name: 'Question reçue', text: 'Bonne question {auteur} ! Je prépare une vidéo sur le sujet, reste connecté(e) 😉' },
  ];

  const DEFAULT_PROFILES = [
    {
      id: 'p1',
      name: 'Profil par défaut',
      title: '',
      description:
        '{resume}\n\n⏱️ Chapitres :\n00:00 Introduction\n\n🔔 Abonne-toi pour ne rien rater : {lien_chaine}\n\n📲 Suis-moi :\nInstagram : \nTikTok : \n\n#{hashtag1} #{hashtag2}',
      tags: [],
    },
  ];

  const COLLECTION_DEFAULTS = {
    tagLists: [],
    canned: DEFAULT_CANNED,
    profiles: DEFAULT_PROFILES,
    ideas: [],
    checklist: DEFAULT_CHECKLIST,
    checklistState: {},
    rankTracking: [],
    competitors: [],
    alerts: [],
    abTests: [],
    scheduled: [],
    keywordHistory: [],
    mySnapshots: [],
    shareTracker: [],
    jobLog: [],
  };

  function storage() {
    return browser.storage.local;
  }

  function clone(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  async function get(key, fallback) {
    const res = await storage().get(key);
    if (res[key] !== undefined) return res[key];
    if (fallback !== undefined) return clone(fallback);
    return clone(COLLECTION_DEFAULTS[key]);
  }

  async function set(key, value) {
    await storage().set({ [key]: value });
    return value;
  }

  async function getSettings() {
    const saved = (await storage().get('settings')).settings || {};
    return { ...clone(DEFAULT_SETTINGS), ...saved, panels: { ...DEFAULT_SETTINGS.panels, ...(saved.panels || {}) } };
  }

  async function setSettings(patch) {
    const current = await getSettings();
    const next = { ...current, ...patch, panels: { ...current.panels, ...(patch.panels || {}) } };
    await set('settings', next);
    return next;
  }

  async function list(key) {
    const v = await get(key);
    return Array.isArray(v) ? v : [];
  }

  /** Ajoute ou met à jour un élément (par id) dans une collection. */
  async function upsert(key, item) {
    const items = await list(key);
    if (!item.id) item.id = MT.uid();
    const i = items.findIndex((x) => x.id === item.id);
    if (i >= 0) items[i] = { ...items[i], ...item };
    else items.push(item);
    await set(key, items);
    return item;
  }

  async function remove(key, id) {
    const items = await list(key);
    await set(
      key,
      items.filter((x) => x.id !== id)
    );
  }

  /** Mise à jour atomique (lecture-modification-écriture) d'une collection. */
  async function update(key, fn) {
    const value = await get(key);
    const next = await fn(value);
    await set(key, next === undefined ? value : next);
    return next === undefined ? value : next;
  }

  function onChange(keys, cb) {
    const wanted = new Set(Array.isArray(keys) ? keys : [keys]);
    const listener = (changes, area) => {
      if (area !== 'local') return;
      for (const k of Object.keys(changes)) if (wanted.has(k)) cb(k, changes[k].newValue);
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }

  const EXPORT_EXCLUDE = new Set(['oauth', 'pendingFrame']);

  async function exportAll() {
    const all = await storage().get(null);
    for (const k of EXPORT_EXCLUDE) delete all[k];
    return { app: 'mytube-seo', version: 1, exportedAt: new Date().toISOString(), data: all };
  }

  async function importAll(payload) {
    if (!payload || payload.app !== 'mytube-seo' || typeof payload.data !== 'object') throw new Error('Fichier de sauvegarde invalide');
    const data = { ...payload.data };
    for (const k of EXPORT_EXCLUDE) delete data[k];
    await storage().set(data);
  }

  async function addJobLog(entry) {
    await update('jobLog', (log) => {
      log = Array.isArray(log) ? log : [];
      log.unshift({ t: Date.now(), ...entry });
      return log.slice(0, 200);
    });
  }

  MT.store = {
    DEFAULT_SETTINGS,
    DEFAULT_CHECKLIST,
    get,
    set,
    getSettings,
    setSettings,
    list,
    upsert,
    remove,
    update,
    onChange,
    exportAll,
    importAll,
    addJobLog,
  };

  if (typeof module === 'object' && module.exports) module.exports = MT.store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
