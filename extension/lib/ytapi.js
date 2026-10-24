/*
 * MyTube SEO — API officielles Google : YouTube Data API v3 et YouTube Analytics API v2.
 * auth = { apiKey } (lecture publique) ou { token } (OAuth, lecture/écriture de votre chaîne).
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  const API = 'https://www.googleapis.com/youtube/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3';
  const ANALYTICS = 'https://youtubeanalytics.googleapis.com/v2/reports';

  class ApiError extends Error {
    constructor(message, status, reason) {
      super(message);
      this.status = status;
      this.reason = reason;
    }
  }

  function explain(status, reason, message) {
    const r = reason || '';
    if (/quotaExceeded|dailyLimitExceeded/.test(r)) return 'Quota quotidien de l’API YouTube épuisé. Réessayez demain (remise à zéro à minuit, heure du Pacifique).';
    if (/keyInvalid|badRequest/.test(r) && /key/i.test(message)) return 'Clé API YouTube invalide : vérifiez-la dans les paramètres.';
    if (/accessNotConfigured/.test(r)) return 'L’API n’est pas activée dans votre projet Google Cloud (YouTube Data API v3 / YouTube Analytics API).';
    if (status === 401) return 'Session Google expirée : reconnectez votre compte dans les paramètres.';
    if (/insufficientPermissions|forbidden/.test(r) || status === 403) return `Autorisation refusée par Google : ${message}`;
    if (/uploadRateLimitExceeded|rateLimitExceeded/.test(r)) return 'Trop de requêtes : patientez un peu avant de recommencer.';
    return message || `Erreur API (${status})`;
  }

  async function request(url, { params = {}, method = 'GET', body, auth = {}, contentType } = {}) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, v);
    const headers = {};
    if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
    else if (auth.apiKey) u.searchParams.set('key', auth.apiKey);
    else throw new ApiError('Clé API YouTube ou connexion Google requise (Paramètres).', 0, 'noAuth');
    let payload = body;
    if (body != null && !(typeof Blob !== 'undefined' && body instanceof Blob)) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    } else if (body != null) {
      headers['Content-Type'] = contentType || body.type || 'application/octet-stream';
    }
    let res;
    try {
      res = await fetch(u.toString(), { method, headers, body: payload, credentials: 'omit' });
    } catch (e) {
      throw new ApiError('Impossible de joindre les serveurs Google.', 0, 'network');
    }
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e) {
      json = {};
    }
    if (!res.ok) {
      const err = json.error || {};
      const reason = err.errors && err.errors[0] ? err.errors[0].reason : err.status;
      throw new ApiError(explain(res.status, reason, err.message || res.statusText), res.status, reason);
    }
    return json;
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function bestThumb(thumbnails) {
    if (!thumbnails) return null;
    const t = thumbnails.maxres || thumbnails.standard || thumbnails.high || thumbnails.medium || thumbnails.default;
    return t ? t.url : null;
  }

  function normalizeVideo(item) {
    const sn = item.snippet || {};
    const st = item.statistics || {};
    const cd = item.contentDetails || {};
    const ss = item.status || {};
    const num = (x) => (x != null ? Number(x) : null);
    return {
      videoId: item.id,
      title: sn.title || '',
      description: sn.description || '',
      tags: sn.tags || [],
      categoryId: sn.categoryId || null,
      channelId: sn.channelId || null,
      channelTitle: sn.channelTitle || '',
      publishedAt: sn.publishedAt ? Date.parse(sn.publishedAt) : null,
      defaultLanguage: sn.defaultLanguage || null,
      defaultAudioLanguage: sn.defaultAudioLanguage || null,
      liveBroadcastContent: sn.liveBroadcastContent || 'none',
      thumbnail: bestThumb(sn.thumbnails),
      views: num(st.viewCount),
      likes: num(st.likeCount),
      comments: num(st.commentCount),
      durationSec: cd.duration ? MT.parseIsoDuration(cd.duration) : null,
      definition: cd.definition || null,
      caption: cd.caption === 'true',
      privacyStatus: ss.privacyStatus || null,
      publishAt: ss.publishAt ? Date.parse(ss.publishAt) : null,
      madeForKids: !!ss.madeForKids,
      localizations: item.localizations || {},
      raw: item,
    };
  }

  /** videos.list (1 unité / 50 vidéos). */
  async function videos(ids, auth, parts = 'snippet,statistics,contentDetails,status') {
    const out = [];
    for (const group of chunk(ids.filter(Boolean), 50)) {
      const json = await request(`${API}/videos`, { params: { part: parts, id: group.join(','), maxResults: 50 }, auth });
      out.push(...(json.items || []).map(normalizeVideo));
    }
    const order = new Map(ids.map((id, i) => [id, i]));
    return out.sort((a, b) => order.get(a.videoId) - order.get(b.videoId));
  }

  function normalizeChannel(item) {
    const sn = item.snippet || {};
    const st = item.statistics || {};
    const cd = item.contentDetails || {};
    const bs = (item.brandingSettings && item.brandingSettings.channel) || {};
    return {
      channelId: item.id,
      title: sn.title || '',
      description: sn.description || '',
      handle: sn.customUrl || '',
      avatar: bestThumb(sn.thumbnails),
      publishedAt: sn.publishedAt ? Date.parse(sn.publishedAt) : null,
      country: sn.country || bs.country || null,
      subscribers: st.hiddenSubscriberCount ? null : st.subscriberCount != null ? Number(st.subscriberCount) : null,
      views: st.viewCount != null ? Number(st.viewCount) : null,
      videoCount: st.videoCount != null ? Number(st.videoCount) : null,
      uploadsPlaylist: cd.relatedPlaylists ? cd.relatedPlaylists.uploads : null,
      keywords: bs.keywords ? MT.yt.parseKeywordString(bs.keywords) : [],
    };
  }

  /** channels.list : {ids:[…]} ou {mine:true} ou {handle:'@x'}. */
  async function channels(query, auth) {
    const params = { part: 'snippet,statistics,contentDetails,brandingSettings', maxResults: 50 };
    if (query.mine) params.mine = 'true';
    else if (query.handle) params.forHandle = query.handle.startsWith('@') ? query.handle : '@' + query.handle;
    else params.id = (query.ids || []).join(',');
    const json = await request(`${API}/channels`, { params, auth });
    return (json.items || []).map(normalizeChannel);
  }

  async function myChannel(auth) {
    const [ch] = await channels({ mine: true }, auth);
    if (!ch) throw new ApiError('Aucune chaîne YouTube associée à ce compte Google.', 404);
    return ch;
  }

  /** Identifiants de vidéos d'une playlist (ex. playlist « uploads » UU…). */
  async function playlistItems(playlistId, auth, { limit = 500, onProgress } = {}) {
    const out = [];
    let pageToken;
    do {
      const json = await request(`${API}/playlistItems`, { params: { part: 'contentDetails,snippet', playlistId, maxResults: 50, pageToken }, auth });
      for (const it of json.items || []) {
        out.push({
          videoId: it.contentDetails && it.contentDetails.videoId,
          publishedAt: it.contentDetails && it.contentDetails.videoPublishedAt ? Date.parse(it.contentDetails.videoPublishedAt) : null,
          title: it.snippet ? it.snippet.title : '',
        });
      }
      pageToken = json.nextPageToken;
      if (onProgress) onProgress(out.length, json.pageInfo ? json.pageInfo.totalResults : null);
    } while (pageToken && out.length < limit);
    return out.slice(0, limit);
  }

  function uploadsPlaylistOf(channelId) {
    return channelId && channelId.startsWith('UC') ? 'UU' + channelId.slice(2) : null;
  }

  /** Toutes les vidéos (y compris privées/non répertoriées avec OAuth) d'une chaîne. */
  async function channelVideos(channelId, auth, { limit = 500, onProgress, parts } = {}) {
    const items = await playlistItems(uploadsPlaylistOf(channelId), auth, { limit, onProgress: onProgress && ((n, t) => onProgress('liste', n, t)) });
    const ids = items.map((i) => i.videoId).filter(Boolean);
    const out = [];
    for (const group of chunk(ids, 50)) {
      out.push(...(await videos(group, auth, parts || 'snippet,statistics,contentDetails,status,localizations')));
      if (onProgress) onProgress('détails', out.length, ids.length);
    }
    return out;
  }

  async function myVideos(auth, opts = {}) {
    const ch = await myChannel(auth);
    return channelVideos(ch.channelId, auth, opts);
  }

  const SNIPPET_FIELDS = ['title', 'description', 'tags', 'categoryId', 'defaultLanguage', 'defaultAudioLanguage'];
  const STATUS_FIELDS = ['privacyStatus', 'embeddable', 'license', 'publicStatsViewable', 'publishAt', 'selfDeclaredMadeForKids', 'containsSyntheticMedia'];

  /**
   * Met à jour une vidéo en conservant les champs existants (l'API efface les champs omis).
   * raw: objet vidéo brut de l'API (avec snippet/status/localizations) ; changes: {snippet?, status?, localizations?}
   */
  async function updateVideo(raw, changes, auth) {
    const body = { id: raw.id };
    const parts = [];
    if (changes.snippet || changes.localizations) {
      const current = raw.snippet || {};
      const snippet = {};
      for (const f of SNIPPET_FIELDS) if (current[f] != null) snippet[f] = current[f];
      Object.assign(snippet, changes.snippet || {});
      if (!snippet.title) throw new ApiError('Le titre ne peut pas être vide.', 400);
      if (!snippet.categoryId) snippet.categoryId = '22';
      if (snippet.tags && MT.seo && MT.seo.tagsLength(snippet.tags) > 500) throw new ApiError(`Tags trop longs pour « ${snippet.title} » (limite 500 caractères).`, 400);
      if (changes.localizations && !snippet.defaultLanguage) snippet.defaultLanguage = changes.defaultLanguage || 'fr';
      body.snippet = snippet;
      parts.push('snippet');
    }
    if (changes.status) {
      const current = raw.status || {};
      const status = {};
      for (const f of STATUS_FIELDS) if (current[f] != null) status[f] = current[f];
      Object.assign(status, changes.status);
      if (status.privacyStatus !== 'private') delete status.publishAt;
      body.status = status;
      parts.push('status');
    }
    if (changes.localizations) {
      body.localizations = { ...(raw.localizations || {}), ...changes.localizations };
      parts.push('localizations');
    }
    if (!parts.length) return raw;
    return request(`${API}/videos`, { method: 'PUT', params: { part: parts.join(',') }, body, auth });
  }

  /** Remplace la miniature (image ≤ 2 Mo, JPEG/PNG). */
  async function setThumbnail(videoId, blob, auth) {
    if (blob.size > 2 * 1024 * 1024) throw new ApiError('La miniature dépasse 2 Mo.', 400);
    return request(`${UPLOAD}/thumbnails/set`, { method: 'POST', params: { videoId, uploadType: 'media' }, body: blob, auth });
  }

  async function categories(regionCode, auth, hl = 'fr') {
    const json = await request(`${API}/videoCategories`, { params: { part: 'snippet', regionCode, hl }, auth });
    return (json.items || []).filter((c) => c.snippet && c.snippet.assignable).map((c) => ({ id: c.id, title: c.snippet.title }));
  }

  /** commentThreads.list (alternative officielle à la lecture des commentaires). */
  async function commentThreads(videoId, auth, { max = 500, order = 'relevance', onProgress } = {}) {
    const out = [];
    let pageToken;
    do {
      const json = await request(`${API}/commentThreads`, { params: { part: 'snippet', videoId, maxResults: 100, order, pageToken, textFormat: 'plainText' }, auth });
      for (const it of json.items || []) {
        const c = it.snippet.topLevelComment.snippet;
        out.push({
          id: it.id,
          text: c.textDisplay || c.textOriginal || '',
          author: c.authorDisplayName,
          authorChannelId: c.authorChannelId ? c.authorChannelId.value : null,
          authorAvatar: c.authorProfileImageUrl,
          likes: c.likeCount || 0,
          replies: it.snippet.totalReplyCount || 0,
          publishedAt: Date.parse(c.publishedAt),
          ageSec: (Date.now() - Date.parse(c.publishedAt)) / 1000,
          publishedText: MT.fmt.date(c.publishedAt),
          isOwner: c.authorChannelId && it.snippet.channelId ? c.authorChannelId.value === it.snippet.channelId : false,
        });
      }
      pageToken = json.nextPageToken;
      if (onProgress) onProgress(out.length);
    } while (pageToken && out.length < max);
    return out.slice(0, max);
  }

  /** YouTube Analytics : rapport générique (OAuth requis). */
  async function analytics(params, auth) {
    const json = await request(ANALYTICS, { params: { ids: 'channel==MINE', ...params }, auth });
    const headers = (json.columnHeaders || []).map((h) => h.name);
    return (json.rows || []).map((row) => Object.fromEntries(row.map((v, i) => [headers[i], v])));
  }

  function isoDate(d) {
    return new Date(d).toISOString().slice(0, 10);
  }

  MT.ytapi = {
    ApiError,
    request,
    videos,
    channels,
    myChannel,
    playlistItems,
    uploadsPlaylistOf,
    channelVideos,
    myVideos,
    updateVideo,
    setThumbnail,
    categories,
    commentThreads,
    analytics,
    isoDate,
    normalizeVideo,
  };

  if (typeof module === 'object' && module.exports) module.exports = MT.ytapi;
})(typeof globalThis !== 'undefined' ? globalThis : this);
