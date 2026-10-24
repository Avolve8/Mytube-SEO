/*
 * MyTube SEO — traduction (titres, descriptions, tags).
 * Moteur « google » : point d'accès public de Google Traduction (non officiel, gratuit).
 * Moteur « claude » : via l'API Claude (clé requise).
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  // code: code Google Traduction ; yt: code de langue YouTube (localisations)
  const LANGUAGES = [
    { code: 'en', yt: 'en', name: 'Anglais' },
    { code: 'es', yt: 'es', name: 'Espagnol' },
    { code: 'de', yt: 'de', name: 'Allemand' },
    { code: 'it', yt: 'it', name: 'Italien' },
    { code: 'pt', yt: 'pt', name: 'Portugais' },
    { code: 'nl', yt: 'nl', name: 'Néerlandais' },
    { code: 'pl', yt: 'pl', name: 'Polonais' },
    { code: 'ru', yt: 'ru', name: 'Russe' },
    { code: 'uk', yt: 'uk', name: 'Ukrainien' },
    { code: 'tr', yt: 'tr', name: 'Turc' },
    { code: 'ar', yt: 'ar', name: 'Arabe' },
    { code: 'hi', yt: 'hi', name: 'Hindi' },
    { code: 'id', yt: 'id', name: 'Indonésien' },
    { code: 'ja', yt: 'ja', name: 'Japonais' },
    { code: 'ko', yt: 'ko', name: 'Coréen' },
    { code: 'zh-CN', yt: 'zh-Hans', name: 'Chinois (simplifié)' },
    { code: 'sv', yt: 'sv', name: 'Suédois' },
    { code: 'ro', yt: 'ro', name: 'Roumain' },
    { code: 'fr', yt: 'fr', name: 'Français' },
  ];

  function chunks(text, max = 4000) {
    const out = [];
    let cur = '';
    for (const para of String(text).split('\n')) {
      if ((cur + '\n' + para).length > max && cur) {
        out.push(cur);
        cur = para;
      } else cur = cur ? cur + '\n' + para : para;
    }
    if (cur || !out.length) out.push(cur);
    return out;
  }

  async function google(text, target, source = 'auto') {
    if (!String(text || '').trim()) return '';
    const parts = [];
    for (const piece of chunks(text)) {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}`;
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: 'q=' + encodeURIComponent(piece),
      });
      if (!res.ok) throw new Error(`Traduction indisponible (${res.status}).`);
      const json = await res.json();
      parts.push((json[0] || []).map((seg) => seg[0]).join(''));
    }
    return parts.join('\n');
  }

  async function translate(text, target, { engine, source = 'auto' } = {}) {
    if (!engine) engine = (await MT.store.getSettings()).translateEngine || 'google';
    if (engine === 'claude' && MT.ai) return MT.ai.translate(text, target);
    return google(text, target, source);
  }

  /** Traduit une liste de tags en une seule requête. */
  async function translateTags(tags, target, opts) {
    if (!tags.length) return [];
    const out = await translate(tags.join('\n'), target, opts);
    return out
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  MT.translate = { LANGUAGES, translate, translateTags, google };
})(typeof globalThis !== 'undefined' ? globalThis : this);
