/*
 * MyTube SEO — évaluation des mots-clés (volume, concurrence, optimisation, score global)
 * à partir de l'autocomplétion YouTube et des résultats de recherche.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  const log10 = (x) => Math.log10(Math.max(0, x) + 1);

  /** Préfixes à sonder dans l'autocomplétion pour estimer la popularité d'une requête. */
  function probePrefixes(keyword) {
    const k = String(keyword || '').trim();
    const out = [];
    for (const r of [0.3, 0.5, 0.75]) {
      const len = Math.max(2, Math.round(k.length * r));
      const p = k.slice(0, len);
      if (len < k.length && !out.includes(p)) out.push(p);
    }
    if (!out.includes(k)) out.push(k);
    return out;
  }

  /**
   * probes: [{prefix, suggestions: [..]}] (dans l'ordre de probePrefixes)
   * Renvoie le préfixe le plus court où le mot-clé apparaît et sa position.
   */
  function autocompleteSignal(keyword, probes) {
    const n = MT.text.normalize(keyword);
    let found = null;
    for (const p of probes) {
      const idx = (p.suggestions || []).findIndex((s) => MT.text.normalize(s) === n);
      if (idx >= 0) {
        found = { prefix: p.prefix, ratio: p.prefix.length / Math.max(1, keyword.length), position: idx };
        break;
      }
    }
    const full = probes.find((p) => p.prefix.trim() === String(keyword).trim());
    const breadth = full ? (full.suggestions || []).filter((s) => MT.text.normalize(s) !== n).length : 0;
    let score = 5;
    if (found) score = found.ratio < 1 ? 35 + (1 - found.ratio) * 90 - found.position * 2 : 25 - found.position;
    return { found, breadth, score: MT.clamp(score) };
  }

  /**
   * Score d'un mot-clé.
   * search: {estimatedResults, videos: [{title, views, ageSec, verified, channelId, isShort, description}]}
   * probes: résultats d'autocomplétion (voir autocompleteSignal)
   * myChannel (optionnel): {avgViews}
   */
  function scoreKeyword({ keyword, search, probes = [], myChannel }) {
    const tx = MT.text;
    const videos = (search && search.videos ? search.videos : []).filter((v) => !v.inShelf);
    const top10 = videos.slice(0, 10);
    const top20 = videos.slice(0, 20);
    const ac = autocompleteSignal(keyword, probes);

    const vpd = top10.filter((v) => v.views != null && v.ageSec != null).map((v) => v.views / Math.max(1, v.ageSec / 86400));
    const avgVpd = MT.mean(vpd) || 0;
    const viewsScore = MT.clamp((log10(avgVpd) / 5) * 100);
    const breadthScore = Math.min(10, ac.breadth) * 10;
    const volume = Math.round(MT.clamp(0.5 * ac.score + 0.35 * viewsScore + 0.15 * breadthScore));

    const medianViews = MT.median(top10.map((v) => v.views)) || 0;
    const topViewsScore = MT.clamp((log10(medianViews) / 7) * 100);
    const titleMatches = top20.filter((v) => tx.containsPhrase(v.title, keyword)).length;
    const titleMatchPct = top20.length ? titleMatches / top20.length : 0;
    const descMatchPct = top20.length ? top20.filter((v) => v.description && tx.containsPhrase(v.description, keyword)).length / top20.length : 0;
    const est = search && search.estimatedResults ? search.estimatedResults : 0;
    const estScore = MT.clamp(((log10(est) - 3) / 5) * 100);
    const verifiedPct = top10.length ? top10.filter((v) => v.verified).length / top10.length : 0;
    const recent = top20.filter((v) => v.ageSec != null && v.ageSec <= 30 * 86400).length;
    const recentPct = top20.length ? recent / top20.length : 0;
    const competition = Math.round(MT.clamp(0.35 * topViewsScore + 0.25 * titleMatchPct * 100 + 0.15 * estScore + 0.15 * verifiedPct * 100 + 0.1 * recentPct * 100));
    const optimization = Math.round(MT.clamp(titleMatchPct * 70 + descMatchPct * 30));
    const overall = Math.round(MT.clamp(volume * 0.6 + (100 - competition) * 0.4));

    let weighted = null;
    if (myChannel && myChannel.avgViews) {
      const accessibility = MT.clamp(50 + (log10(myChannel.avgViews) - log10(medianViews)) * 25);
      weighted = Math.round(MT.clamp(volume * 0.5 + accessibility * 0.5));
    }

    const ages = top20.map((v) => v.ageSec).filter((a) => a != null);
    return {
      keyword,
      volume,
      competition,
      optimization,
      overall,
      weighted,
      autocomplete: ac,
      metrics: {
        estimatedResults: est,
        medianViews,
        avgViewsPerDay: avgVpd,
        titleMatchPct,
        descMatchPct,
        verifiedPct,
        recentPct,
        avgAgeDays: ages.length ? MT.mean(ages) / 86400 : null,
        uniqueChannels: new Set(top20.map((v) => v.channelId || v.channelName)).size,
        shortsPct: top20.length ? top20.filter((v) => v.isShort).length / top20.length : 0,
        analyzed: top20.length,
      },
    };
  }

  function label(score, inverse = false) {
    const s = inverse ? 100 - score : score;
    if (s >= 80) return { label: inverse ? 'Très faible' : 'Excellent', tone: 'great' };
    if (s >= 60) return { label: inverse ? 'Faible' : 'Bon', tone: 'good' };
    if (s >= 40) return { label: inverse ? 'Moyenne' : 'Moyen', tone: 'fair' };
    if (s >= 20) return { label: inverse ? 'Forte' : 'Faible', tone: 'poor' };
    return { label: inverse ? 'Très forte' : 'Très faible', tone: 'bad' };
  }

  const QUESTION_PREFIXES = {
    fr: ['comment', 'pourquoi', 'quel', 'quelle', 'meilleur', 'tuto', 'astuce', 'avis'],
    en: ['how to', 'why', 'what is', 'best', 'tutorial'],
    es: ['como', 'por que', 'mejor', 'tutorial'],
    de: ['wie', 'warum', 'beste', 'tutorial'],
  };

  /** Requêtes d'expansion pour trouver la longue traîne (a-z + questions). */
  function expansionQueries(keyword, lang = 'fr') {
    const k = String(keyword || '').trim();
    if (!k) return [];
    const q = [k];
    for (const l of 'abcdefghijklmnopqrstuvwxyz') q.push(`${k} ${l}`);
    for (const p of QUESTION_PREFIXES[lang] || QUESTION_PREFIXES.en) q.push(`${p} ${k}`);
    return q;
  }

  /** Fusionne les suggestions de plusieurs requêtes en mots-clés classés par pertinence. */
  function mergeSuggestions(keyword, results) {
    const map = new Map();
    const base = MT.text.normalize(keyword);
    for (const { suggestions } of results) {
      (suggestions || []).forEach((s, i) => {
        const n = MT.text.normalize(s);
        if (!n || n === base) return;
        const cur = map.get(n) || { keyword: s, hits: 0, bestPosition: 99, score: 0 };
        cur.hits++;
        cur.bestPosition = Math.min(cur.bestPosition, i);
        cur.score += 10 - Math.min(9, i);
        map.set(n, cur);
      });
    }
    return [...map.values()]
      .map((x) => ({ ...x, words: x.keyword.split(/\s+/).length, containsSeed: MT.text.containsPhrase(x.keyword, keyword) }))
      .sort((a, b) => b.score - a.score);
  }

  /** Classement des tags les plus utilisés par un ensemble de vidéos. */
  function tagFrequency(videos) {
    const counts = new Map();
    for (const v of videos) {
      const seen = new Set();
      for (const t of v.tags || []) {
        const n = MT.text.normalize(t);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        const cur = counts.get(n) || { tag: t, count: 0, videos: [] };
        cur.count++;
        cur.videos.push(v.videoId);
        counts.set(n, cur);
      }
    }
    const total = videos.length || 1;
    return [...counts.values()].map((x) => ({ ...x, pct: x.count / total })).sort((a, b) => b.count - a.count);
  }

  MT.keyword = { probePrefixes, autocompleteSignal, scoreKeyword, label, expansionQueries, mergeSuggestions, tagFrequency };

  if (typeof module === 'object' && module.exports) module.exports = MT.keyword;
})(typeof globalThis !== 'undefined' ? globalThis : this);
