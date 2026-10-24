/*
 * MyTube SEO — assistant IA facultatif (API Claude, clé fournie par l'utilisateur).
 * Appel HTTP direct à l'API Messages : l'extension n'a pas d'étape de compilation,
 * le SDK officiel ne peut donc pas être embarqué sans bundler.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  const ENDPOINT = 'https://api.anthropic.com/v1/messages';
  const API_VERSION = '2026-10-21';
  const MODELS = [
    { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (recommandé)' },
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
    { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (rapide, économique)' },
  ];
  // Modèles acceptant le repli automatique côté serveur en cas de refus des classifieurs
  const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-opus-5', 'claude-fable-5-1']);

  const SYSTEM =
    'Tu es un expert du référencement YouTube (SEO), du copywriting et de la stratégie de contenu. ' +
    'Tu proposes des titres accrocheurs mais honnêtes (pas de « piège à clics » trompeur), des descriptions structurées, ' +
    'des tags pertinents et des idées concrètes. Tu respectes les limites de YouTube : titre ≤ 100 caractères, ' +
    'description ≤ 5000 caractères, tags ≤ 500 caractères au total.';

  async function available() {
    const s = await MT.store.getSettings();
    return !!(s.claudeApiKey || '').trim();
  }

  /** Appel générique. schema (facultatif) : schéma JSON de la réponse (sorties structurées). */
  async function complete({ prompt, system = SYSTEM, schema, maxTokens = 16000, replyInUserLanguage = true }) {
    const s = await MT.store.getSettings();
    const key = (s.claudeApiKey || '').trim();
    if (!key) throw new Error('Ajoutez votre clé API Claude dans les paramètres pour utiliser l’assistant IA.');
    const model = s.claudeModel || 'claude-opus-5-5';
    const lang = s.language === 'fr' || !s.language ? 'français' : s.language;
    const body = {
      model,
      max_tokens: maxTokens,
      system: replyInUserLanguage ? `${system}\nRéponds en ${lang}.` : system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort: s.claudeEffort || 'medium' },
    };
    if (schema) body.output_config.format = { type: 'json_schema', schema };
    const headers = {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (FALLBACK_MODELS.has(model)) {
      body.fallbacks = 'default';
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    }
    let res;
    try {
      res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'omit' });
    } catch (e) {
      throw new Error('Impossible de joindre l’API Claude.');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json.error && json.error.message ? json.error.message : res.statusText;
      if (res.status === 401) throw new Error('Clé API Claude invalide.');
      if (res.status === 429) throw new Error('Limite de requêtes Claude atteinte, réessayez dans un instant.');
      throw new Error(`Erreur API Claude (${res.status}) : ${msg}`);
    }
    if (json.stop_reason === 'refusal') throw new Error('Claude a refusé de traiter cette demande.');
    const text = (json.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (!schema) return text;
    if (json.stop_reason === 'max_tokens') throw new Error('Réponse de Claude tronquée : réessayez.');
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Réponse de Claude illisible : réessayez.');
    }
  }

  const strList = (key) => ({
    type: 'object',
    properties: { [key]: { type: 'array', items: { type: 'string' } } },
    required: [key],
    additionalProperties: false,
  });

  async function titles({ topic, keyword, current, count = 10 }) {
    const r = await complete({
      prompt:
        `Propose ${count} titres YouTube optimisés pour le référencement.\n` +
        `Sujet : ${topic || '(non précisé)'}\nMot-clé principal : ${keyword || '(non précisé)'}\n` +
        (current ? `Titre actuel : ${current}\n` : '') +
        'Chaque titre doit contenir le mot-clé (idéalement au début), faire 40 à 70 caractères et utiliser un angle différent ' +
        '(curiosité, bénéfice, liste, tutoriel, comparaison, urgence…).',
      schema: {
        type: 'object',
        properties: {
          titles: {
            type: 'array',
            items: { type: 'object', properties: { title: { type: 'string' }, angle: { type: 'string' } }, required: ['title', 'angle'], additionalProperties: false },
          },
        },
        required: ['titles'],
        additionalProperties: false,
      },
    });
    return r.titles;
  }

  async function description({ title, keyword, notes, links }) {
    const r = await complete({
      prompt:
        `Rédige une description YouTube complète et optimisée.\nTitre : ${title || ''}\nMot-clé principal : ${keyword || ''}\n` +
        (notes ? `Points à couvrir / notes : ${notes}\n` : '') +
        (links ? `Liens à inclure : ${links}\n` : '') +
        'Structure : 2 premières lignes accrocheuses contenant le mot-clé, paragraphe détaillé (250+ mots), ' +
        'chapitres d’exemple (00:00 …) à adapter, appel à l’action (abonnement), 3 hashtags à la fin.',
      schema: { type: 'object', properties: { description: { type: 'string' } }, required: ['description'], additionalProperties: false },
    });
    return r.description;
  }

  async function tags({ title, keyword, description: desc }) {
    const r = await complete({
      prompt:
        `Propose 20 à 30 tags YouTube pour cette vidéo.\nTitre : ${title || ''}\nMot-clé principal : ${keyword || ''}\n` +
        (desc ? `Description : ${String(desc).slice(0, 1500)}\n` : '') +
        'Le premier tag est le mot-clé exact. Mélange tags larges, expressions et longue traîne ; pas de doublons, pas de #.',
      schema: strList('tags'),
    });
    return r.tags;
  }

  async function ideas({ niche, count = 10, existing = [] }) {
    const r = await complete({
      prompt:
        `Propose ${count} idées de vidéos YouTube pour la niche : ${niche}.\n` +
        (existing.length ? `Idées/vidéos déjà faites (à éviter) : ${existing.slice(0, 30).join(' | ')}\n` : '') +
        'Pour chaque idée : un titre de travail, le mot-clé principal à cibler, l’angle et le format (tuto, liste, test, Short…).',
      schema: {
        type: 'object',
        properties: {
          ideas: {
            type: 'array',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, keyword: { type: 'string' }, angle: { type: 'string' }, format: { type: 'string' } },
              required: ['title', 'keyword', 'angle', 'format'],
              additionalProperties: false,
            },
          },
        },
        required: ['ideas'],
        additionalProperties: false,
      },
    });
    return r.ideas;
  }

  async function replies({ comment, videoTitle, tone = 'chaleureux' }) {
    const r = await complete({
      prompt: `Propose 3 réponses courtes (ton ${tone}) au commentaire suivant${videoTitle ? ` laissé sous la vidéo « ${videoTitle} »` : ''} :\n« ${comment} »`,
      schema: strList('replies'),
      maxTokens: 4000,
    });
    return r.replies;
  }

  async function thumbnailTexts({ title, keyword }) {
    const r = await complete({
      prompt: `Propose 8 textes très courts (2 à 4 mots, percutants) à écrire sur la miniature de la vidéo « ${title || keyword} ». Ils doivent compléter le titre, pas le répéter.`,
      schema: strList('texts'),
      maxTokens: 4000,
    });
    return r.texts;
  }

  async function translate(text, target) {
    const lang = (MT.translate && MT.translate.LANGUAGES.find((l) => l.code === target)) || { name: target };
    const r = await complete({
      system: 'Tu es un traducteur professionnel spécialisé dans les métadonnées YouTube. Conserve la mise en forme, les liens, les horodatages et les hashtags.',
      prompt: `Traduis le texte suivant en ${lang.name} (${target}). Réponds uniquement avec la traduction.\n\n${text}`,
      schema: { type: 'object', properties: { translation: { type: 'string' } }, required: ['translation'], additionalProperties: false },
      replyInUserLanguage: false,
    });
    return r.translation;
  }

  MT.ai = { MODELS, available, complete, titles, description, tags, ideas, replies, thumbnailTexts, translate };
})(typeof globalThis !== 'undefined' ? globalThis : this);
