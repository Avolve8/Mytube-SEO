/*
 * MyTube SEO — opérations de recherche de haut niveau partagées entre l'arrière-plan et le tableau de bord :
 * analyse de mot-clé, tags des concurrents, longue traîne, suivi de classement, instantanés de chaînes,
 * application des variantes de tests A/B et des mises à jour programmées.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  /* ------------------------------------------------------- mots-clés */

  async function myChannelContext() {
    const s = await MT.store.getSettings();
    if (!s.myChannelId) return null;
    const cachedCtx = await MT.store.get('myChannelCache', null);
    if (cachedCtx && cachedCtx.channelId === s.myChannelId && Date.now() - cachedCtx.t < 24 * 3600 * 1000) return cachedCtx;
    try {
      const ch = await MT.yt.getChannel(s.myChannelId, { videoLimit: 15 });
      const ctx = { channelId: ch.channelId, title: ch.title, avatar: ch.avatar, subscribers: ch.subscribers, avgViews: ch.stats.medianViews, t: Date.now() };
      await MT.store.set('myChannelCache', ctx);
      return ctx;
    } catch (e) {
      return cachedCtx || null;
    }
  }

  async function probe(keyword) {
    return Promise.all(MT.keyword.probePrefixes(keyword).map(async (prefix) => ({ prefix, suggestions: await MT.yt.suggest(prefix).catch(() => []) })));
  }

  /** Analyse complète d'un mot-clé (scores + résultats + suggestions). */
  async function analyzeKeyword(keyword, { withMyChannel = true } = {}) {
    keyword = String(keyword || '').trim();
    if (!keyword) throw new Error('Saisissez un mot-clé.');
    const [search, probes, myChannel] = await Promise.all([MT.yt.search(keyword, { limit: 20 }), probe(keyword), withMyChannel ? myChannelContext() : null]);
    const score = MT.keyword.scoreKeyword({ keyword, search, probes, myChannel });
    const full = probes[probes.length - 1];
    const result = {
      keyword,
      t: Date.now(),
      score,
      estimatedResults: search.estimatedResults,
      correctedQuery: search.correctedQuery,
      videos: search.videos.slice(0, 40),
      related: [...new Set([...(full ? full.suggestions : []), ...search.related])].filter((s) => MT.text.normalize(s) !== MT.text.normalize(keyword)),
      myChannel,
    };
    await MT.store.update('keywordHistory', (list) => {
      list = (Array.isArray(list) ? list : []).filter((k) => MT.text.normalize(k.keyword) !== MT.text.normalize(keyword));
      list.unshift({ keyword, t: result.t, overall: score.overall, volume: score.volume, competition: score.competition });
      return list.slice(0, 100);
    });
    return result;
  }

  /** Score rapide (sans historique) pour une liste de mots-clés. */
  async function quickScore(keyword) {
    const [search, probes] = await Promise.all([MT.yt.search(keyword, { limit: 20 }), probe(keyword)]);
    return MT.keyword.scoreKeyword({ keyword, search, probes });
  }

  /** Tags les plus utilisés par les vidéos les mieux classées. */
  async function topTags(videos, { limit = 15, onProgress } = {}) {
    const list = videos.filter((v) => !v.inShelf).slice(0, limit);
    const res = await MT.pool(list, 4, async (v) => ({ videoId: v.videoId, title: v.title, tags: await MT.yt.getVideoTags(v.videoId) }), onProgress);
    const ok = res.filter((r) => r && !r.error);
    return {
      analyzed: ok.length,
      tags: MT.keyword.tagFrequency(ok),
      perVideo: ok,
      avgTagCount: MT.mean(ok.map((r) => r.tags.length)) || 0,
      withoutTags: ok.filter((r) => !r.tags.length).length,
    };
  }

  /** Mots-clés de longue traîne via l'autocomplétion (a-z + questions). */
  async function longTail(keyword, { onProgress } = {}) {
    const s = await MT.store.getSettings();
    const queries = MT.keyword.expansionQueries(keyword, s.language || 'fr');
    const results = await MT.pool(queries, 6, async (q) => ({ query: q, suggestions: await MT.yt.suggest(q).catch(() => []) }), onProgress);
    return MT.keyword.mergeSuggestions(
      keyword,
      results.filter((r) => r && !r.error)
    );
  }

  /* ---------------------------------------------- suivi de classement */

  async function recordRank(itemId, result) {
    let changed = null;
    await MT.store.update('rankTracking', (items) => {
      const item = (items || []).find((i) => i.id === itemId);
      if (!item) return items;
      const prev = item.history && item.history.length ? item.history[item.history.length - 1].rank : undefined;
      item.history = [...(item.history || []), { t: Date.now(), rank: result.rank, checked: result.checked }].slice(-365);
      item.lastChecked = Date.now();
      item.lastRank = result.rank;
      item.bestRank = result.rank != null && (item.bestRank == null || result.rank < item.bestRank) ? result.rank : item.bestRank;
      item.top = result.top || item.top;
      item.error = null;
      changed = { item, prev, rank: result.rank };
      return items;
    });
    return changed;
  }

  async function checkRank(itemId) {
    const items = await MT.store.list('rankTracking');
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error('Suivi introuvable');
    try {
      const r = await MT.yt.rankOf(item.videoId, item.keyword, { maxResults: item.depth || 100 });
      return await recordRank(itemId, r);
    } catch (e) {
      await MT.store.update('rankTracking', (list) => {
        const it = list.find((i) => i.id === itemId);
        if (it) {
          it.error = e.message;
          it.lastChecked = Date.now();
        }
        return list;
      });
      throw e;
    }
  }

  async function trackRank({ videoId, keyword, title, depth = 100 }) {
    keyword = String(keyword || '').trim();
    if (!videoId || !keyword) throw new Error('Vidéo et mot-clé requis');
    const items = await MT.store.list('rankTracking');
    const existing = items.find((i) => i.videoId === videoId && MT.text.normalize(i.keyword) === MT.text.normalize(keyword));
    if (existing) return existing;
    const item = { id: MT.uid(), videoId, keyword, title: title || videoId, depth, createdAt: Date.now(), history: [] };
    await MT.store.upsert('rankTracking', item);
    return item;
  }

  /* ---------------------------------------------- concurrents & chaîne */

  function snapshotOf(ch) {
    return {
      t: Date.now(),
      subscribers: ch.subscribers,
      views: ch.totalViews,
      videos: ch.videoCount,
      avgViews: ch.stats ? ch.stats.medianViews : null,
      uploadsPerWeek: ch.stats ? ch.stats.uploadsPerWeek : null,
    };
  }

  async function addCompetitor(input) {
    const ch = await MT.yt.getChannel(input, { videoLimit: 20 });
    const list = await MT.store.list('competitors');
    if (list.some((c) => c.channelId === ch.channelId)) return list.find((c) => c.channelId === ch.channelId);
    const item = {
      id: ch.channelId,
      channelId: ch.channelId,
      title: ch.title,
      avatar: ch.avatar,
      handle: ch.handle,
      addedAt: Date.now(),
      lastChecked: Date.now(),
      history: [snapshotOf(ch)],
    };
    await MT.store.upsert('competitors', item);
    return item;
  }

  async function snapshotCompetitor(id) {
    const ch = await MT.yt.getChannel(id, { videoLimit: 20 });
    await MT.store.update('competitors', (list) => {
      const c = list.find((x) => x.id === id);
      if (c) {
        c.title = ch.title;
        c.avatar = ch.avatar;
        c.handle = ch.handle;
        c.lastChecked = Date.now();
        c.history = [...(c.history || []), snapshotOf(ch)].slice(-730);
        c.latest = { recent: (ch.stats.videos || []).slice(0, 5).map((v) => ({ videoId: v.videoId, title: v.title, views: v.views, publishedAt: v.publishedAt })) };
      }
      return list;
    });
    return ch;
  }

  async function snapshotMyChannel() {
    const s = await MT.store.getSettings();
    if (!s.myChannelId) return null;
    const ch = await MT.yt.getChannel(s.myChannelId, { videoLimit: 15 });
    await MT.store.update('mySnapshots', (list) => {
      list = Array.isArray(list) ? list : [];
      const last = list[list.length - 1];
      const snap = snapshotOf(ch);
      if (last && new Date(last.t).toDateString() === new Date(snap.t).toDateString()) list[list.length - 1] = snap;
      else list.push(snap);
      return list.slice(-1000);
    });
    return ch;
  }

  /* ------------------------------------------------------- alertes */

  async function checkAlert(id) {
    const alerts = await MT.store.list('alerts');
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return null;
    const page = await MT.yt.searchPage(alert.term, MT.yt.SEARCH_FILTERS.uploadDate);
    const fresh = [];
    await MT.store.update('alerts', (list) => {
      const a = list.find((x) => x.id === id);
      if (!a) return list;
      const seen = new Set(a.seen || []);
      const baseline = !a.lastChecked;
      for (const v of page.videos) {
        if (seen.has(v.videoId)) continue;
        seen.add(v.videoId);
        if (!baseline && (!a.excludeChannel || v.channelId !== a.excludeChannel)) {
          fresh.push({ videoId: v.videoId, title: v.title, channelName: v.channelName, channelId: v.channelId, publishedText: v.publishedText, foundAt: Date.now() });
        }
      }
      a.seen = [...seen].slice(-500);
      a.hits = [...fresh, ...(a.hits || [])].slice(0, 100);
      a.unread = (a.unread || 0) + fresh.length;
      a.lastChecked = Date.now();
      return list;
    });
    return { alert, fresh };
  }

  /* ------------------------------------------- tests A/B & programmation */

  function dataUrlToBlob(dataUrl) {
    const [head, b64] = dataUrl.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function rawVideo(videoId, auth) {
    const [v] = await MT.ytapi.videos([videoId], auth, 'snippet,status,statistics,localizations');
    if (!v) throw new Error('Vidéo introuvable sur votre chaîne');
    return v;
  }

  /** Applique une variante (titre, description ou miniature) à une vidéo. */
  async function applyVariant(type, videoId, variant, auth) {
    if (type === 'thumbnail') {
      await MT.ytapi.setThumbnail(videoId, dataUrlToBlob(variant.image), auth);
      return;
    }
    const v = await rawVideo(videoId, auth);
    const snippet = type === 'title' ? { title: variant.value } : { description: variant.value };
    await MT.ytapi.updateVideo(v.raw, { snippet }, auth);
  }

  /** Applique une mise à jour programmée : {title, description, tags, privacyStatus, thumbnail}. */
  async function applyChanges(videoId, changes, auth) {
    const v = await rawVideo(videoId, auth);
    const snippet = {};
    if (changes.title) snippet.title = changes.title;
    if (changes.description != null && changes.description !== '') snippet.description = changes.description;
    if (changes.appendDescription) snippet.description = (v.raw.snippet.description || '') + '\n\n' + changes.appendDescription;
    if (changes.tags && changes.tags.length) snippet.tags = changes.tags;
    const upd = {};
    if (Object.keys(snippet).length) upd.snippet = snippet;
    if (changes.privacyStatus) upd.status = { privacyStatus: changes.privacyStatus };
    if (upd.snippet || upd.status) await MT.ytapi.updateVideo(v.raw, upd, auth);
    if (changes.thumbnail) await MT.ytapi.setThumbnail(videoId, dataUrlToBlob(changes.thumbnail), auth);
  }

  MT.research = {
    myChannelContext,
    analyzeKeyword,
    quickScore,
    topTags,
    longTail,
    recordRank,
    checkRank,
    trackRank,
    addCompetitor,
    snapshotCompetitor,
    snapshotMyChannel,
    checkAlert,
    dataUrlToBlob,
    rawVideo,
    applyVariant,
    applyChanges,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
