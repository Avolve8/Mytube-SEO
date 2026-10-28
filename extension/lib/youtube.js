/*
 * MyTube SEO — accès aux données publiques YouTube sans clé API :
 *  - API interne « Innertube » (recherche, lecteur, suite de lecture, chaînes, commentaires)
 *  - flux RSS des chaînes (dates exactes des 15 dernières vidéos)
 *  - autocomplétion YouTube (suggestqueries)
 * Les analyseurs (parse*) sont des fonctions pures, testées avec Node.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  const BASE = 'https://www.youtube.com';
  const DEFAULT_CLIENT_VERSION = '2.20260623.01.00';
  const TAB_PARAMS = {
    videos: 'EgZ2aWRlb3PyBgQKAjoA',
    shorts: 'EgZzaG9ydHPyBgUKA5oBAA%3D%3D',
    streams: 'EgdzdHJlYW1z8gYECgJ6AA%3D%3D',
  };
  // Filtres de recherche (paramètre « sp »)
  const SEARCH_FILTERS = {
    videos: 'EgIQAQ%3D%3D',
    uploadDate: 'CAI%3D',
    uploadDateVideos: 'CAISAhAB',
    viewCount: 'CAM%3D',
    thisWeek: 'EgQIAxAB',
    thisMonth: 'EgQIBBAB',
  };

  class YtError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  /* --------------------------------------------------------- utilitaires */

  function textOf(t) {
    if (t == null) return '';
    if (typeof t === 'string') return t;
    if (typeof t === 'number') return String(t);
    if (t.simpleText != null) return String(t.simpleText);
    if (Array.isArray(t.runs)) return t.runs.map((r) => r.text || '').join('');
    if (t.content != null) return String(t.content);
    if (t.text != null) return textOf(t.text);
    return '';
  }

  /** Toutes les valeurs associées à une clé, en profondeur et dans l'ordre du document. */
  function findAll(obj, key, out = []) {
    if (!obj || typeof obj !== 'object') return out;
    if (Array.isArray(obj)) {
      for (const x of obj) findAll(x, key, out);
      return out;
    }
    for (const k of Object.keys(obj)) {
      if (k === key) out.push(obj[k]);
      findAll(obj[k], key, out);
    }
    return out;
  }

  function findFirst(obj, key) {
    if (!obj || typeof obj !== 'object') return undefined;
    if (Array.isArray(obj)) {
      for (const x of obj) {
        const r = findFirst(x, key);
        if (r !== undefined) return r;
      }
      return undefined;
    }
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    for (const k of Object.keys(obj)) {
      const r = findFirst(obj[k], key);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  /** Premier objet (en profondeur) satisfaisant un prédicat. */
  function findWhere(obj, pred) {
    if (!obj || typeof obj !== 'object') return undefined;
    if (!Array.isArray(obj) && pred(obj)) return obj;
    for (const k of Object.keys(obj)) {
      const r = findWhere(obj[k], pred);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  function bestThumb(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const best = [...list].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    let url = best.url || '';
    if (url.startsWith('//')) url = 'https:' + url;
    return url || null;
  }

  function channelIdIn(obj) {
    const be = findWhere(obj, (o) => typeof o.browseId === 'string' && o.browseId.startsWith('UC'));
    return be ? be.browseId : null;
  }

  function decodeXml(s) {
    return String(s)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
      .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&amp;/g, '&');
  }

  function parseKeywordString(s) {
    if (!s) return [];
    const out = [];
    const re = /"([^"]+)"|(\S+)/g;
    let m;
    while ((m = re.exec(s))) out.push((m[1] || m[2]).trim());
    return out.filter(Boolean);
  }

  /** Extrait un objet JSON assigné à une variable dans une page HTML (ytInitialData…). */
  function extractJson(html, varName) {
    const markers = [`var ${varName} = `, `window["${varName}"] = `, `${varName} = `];
    for (const marker of markers) {
      const idx = html.indexOf(marker);
      if (idx < 0) continue;
      const start = html.indexOf('{', idx + marker.length - 1);
      if (start < 0) continue;
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < html.length; i++) {
        const c = html[i];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
          continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(html.slice(start, i + 1));
            } catch (e) {
              break;
            }
          }
        }
      }
    }
    return null;
  }

  /* -------------------------------------------------------- normaliseurs */

  const VIDEO_KEYS = new Set([
    'videoRenderer',
    'compactVideoRenderer',
    'gridVideoRenderer',
    'playlistVideoRenderer',
    'playlistPanelVideoRenderer',
    'videoWithContextRenderer',
    'endScreenVideoRenderer',
    'reelItemRenderer',
    'shortsLockupViewModel',
    'lockupViewModel',
  ]);
  const SHELF_KEYS = new Set(['reelShelfRenderer', 'shelfRenderer', 'horizontalCardListRenderer', 'gridShelfViewModel', 'richShelfRenderer', 'horizontalListRenderer']);
  const AD_KEYS = new Set([
    'adSlotRenderer',
    'promotedVideoRenderer',
    'promotedSparklesWebRenderer',
    'searchPyvRenderer',
    'inFeedAdLayoutRenderer',
    'adSlotAndLayoutRenderer',
    'compactPromotedVideoRenderer',
  ]);

  function overlayTime(overlays) {
    for (const o of overlays || []) {
      const r = o.thumbnailOverlayTimeStatusRenderer;
      if (r) return { text: textOf(r.text), style: r.style };
    }
    return null;
  }

  function fromRenderer(v) {
    if (!v.videoId) return null;
    const owner = v.ownerText || v.longBylineText || v.shortBylineText;
    const run = owner && owner.runs && owner.runs[0];
    const browse = run && run.navigationEndpoint && run.navigationEndpoint.browseEndpoint;
    const ov = overlayTime(v.thumbnailOverlays);
    const lengthText = textOf(v.lengthText) || (ov && ov.style !== 'LIVE' && ov.style !== 'SHORTS' ? ov.text : '');
    let viewText = textOf(v.viewCountText);
    let shortView = textOf(v.shortViewCountText);
    let publishedText = textOf(v.publishedTimeText);
    if (!viewText && v.videoInfo) {
      // playlistVideoRenderer : « 1,2 M de vues • il y a 3 ans »
      for (const part of textOf(v.videoInfo)
        .split('•')
        .map((p) => p.trim())) {
        if (MT.parseRelative(part) != null) publishedText = publishedText || part;
        else if (MT.parseCount(part) != null) viewText = viewText || part;
      }
    }
    const badgeStyles = [...(v.badges || []), ...(v.ownerBadges || [])].map((b) => (b.metadataBadgeRenderer && b.metadataBadgeRenderer.style) || '');
    const isLive = badgeStyles.some((s) => /LIVE/.test(s)) || (ov && ov.style === 'LIVE');
    const isShort = (ov && ov.style === 'SHORTS') || !!(v.navigationEndpoint && v.navigationEndpoint.reelWatchEndpoint);
    const verified = (v.ownerBadges || []).some((b) => /VERIFIED/.test((b.metadataBadgeRenderer && b.metadataBadgeRenderer.style) || ''));
    const snippet = (v.detailedMetadataSnippets && v.detailedMetadataSnippets[0] && v.detailedMetadataSnippets[0].snippetText) || v.descriptionSnippet;
    const count = MT.parseCount(viewText);
    return {
      videoId: v.videoId,
      title: textOf(v.title) || textOf(v.headline),
      channelName: textOf(owner),
      channelId: (browse && browse.browseId) || v.channelId || null,
      channelUrl: (browse && browse.canonicalBaseUrl) || null,
      views: isLive ? null : count != null ? count : MT.parseCount(shortView),
      viewsText: viewText || shortView,
      watching: isLive ? count : null,
      publishedText,
      ageSec: MT.parseRelative(publishedText),
      durationSec: v.lengthSeconds ? +v.lengthSeconds : MT.parseDuration(lengthText),
      thumbnail: bestThumb(v.thumbnail && v.thumbnail.thumbnails) || MT.thumbUrl(v.videoId),
      verified,
      description: textOf(snippet),
      isShort,
      isLive: !!isLive,
    };
  }

  function fromReelItem(v) {
    if (!v.videoId) return null;
    const viewsText = textOf(v.viewCountText);
    return {
      videoId: v.videoId,
      title: textOf(v.headline),
      channelName: '',
      channelId: null,
      views: MT.parseCount(viewsText),
      viewsText,
      publishedText: '',
      ageSec: null,
      durationSec: null,
      thumbnail: bestThumb(v.thumbnail && v.thumbnail.thumbnails) || MT.thumbUrl(v.videoId),
      verified: false,
      description: '',
      isShort: true,
      isLive: false,
    };
  }

  function fromShortsLockup(v) {
    const reel = findFirst(v.onTap || v, 'reelWatchEndpoint');
    let videoId = reel && reel.videoId;
    if (!videoId && typeof v.entityId === 'string') {
      const m = v.entityId.match(/([\w-]{11})$/);
      if (m) videoId = m[1];
    }
    if (!videoId) return null;
    const om = v.overlayMetadata || {};
    const viewsText = textOf(om.secondaryText);
    const sources = findFirst(v.thumbnailViewModel || v.thumbnail, 'sources') || (v.thumbnail && v.thumbnail.sources);
    return {
      videoId,
      title: textOf(om.primaryText) || (v.accessibilityText || '').split(',')[0],
      channelName: '',
      channelId: null,
      views: MT.parseCount(viewsText),
      viewsText,
      publishedText: '',
      ageSec: null,
      durationSec: null,
      thumbnail: bestThumb(sources) || MT.thumbUrl(videoId),
      verified: false,
      description: '',
      isShort: true,
      isLive: false,
    };
  }

  function fromLockup(l) {
    const type = l.contentType || '';
    if (type && !/VIDEO/.test(type)) return null;
    const videoId = l.contentId;
    if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;
    const meta = (l.metadata && l.metadata.lockupMetadataViewModel) || {};
    const rows = (meta.metadata && meta.metadata.contentMetadataViewModel && meta.metadata.contentMetadataViewModel.metadataRows) || [];
    const parts = rows.map((r) => (r.metadataParts || []).map((p) => textOf(p.text)).filter(Boolean));
    const channelName = rows.length >= 2 && parts[0].length ? parts[0][0] : '';
    let viewsText = '';
    let publishedText = '';
    for (const part of parts.slice(rows.length >= 2 ? 1 : 0).flat()) {
      if (!publishedText && MT.parseRelative(part) != null) publishedText = part;
      else if (!viewsText && MT.parseCount(part) != null && !/^\d{1,2}:\d{2}/.test(part)) viewsText = part;
    }
    const badges = findAll(l.contentImage, 'thumbnailBadgeViewModel');
    const badgeTexts = badges.map((b) => textOf(b.text).trim());
    const durationText = badgeTexts.find((t) => /^\d{1,3}(?::\d{2}){1,2}$/.test(t));
    const isLive = badges.some((b) => /LIVE/.test(b.badgeStyle || '')) || badgeTexts.some((t) => /^(live|en direct|en vivo|direkt|live now)$/i.test(t));
    const rowsJson = JSON.stringify(rows);
    const sources = findFirst(l.contentImage, 'sources');
    const count = MT.parseCount(viewsText);
    return {
      videoId,
      title: textOf(meta.title),
      channelName,
      channelId: channelIdIn(meta),
      channelUrl: null,
      views: isLive ? null : count,
      viewsText,
      watching: isLive ? count : null,
      publishedText,
      ageSec: MT.parseRelative(publishedText),
      durationSec: MT.parseDuration(durationText),
      thumbnail: bestThumb(sources) || MT.thumbUrl(videoId),
      verified: /CHECK_CIRCLE|VERIFIED/.test(rowsJson),
      description: '',
      isShort: false,
      isLive,
    };
  }

  function normalizeVideo(key, node) {
    try {
      if (key === 'lockupViewModel') return fromLockup(node);
      if (key === 'shortsLockupViewModel') return fromShortsLockup(node);
      if (key === 'reelItemRenderer') return fromReelItem(node);
      return fromRenderer(node);
    } catch (e) {
      return null;
    }
  }

  /** Collecte toutes les vidéos d'une réponse dans l'ordre d'affichage (hors publicités). */
  function collectVideos(rootNode) {
    const out = [];
    const seen = new Set();
    (function rec(node, inShelf) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const x of node) rec(x, inShelf);
        return;
      }
      for (const key of Object.keys(node)) {
        const val = node[key];
        if (AD_KEYS.has(key)) continue;
        if (VIDEO_KEYS.has(key) && val && typeof val === 'object' && !Array.isArray(val)) {
          const v = normalizeVideo(key, val);
          if (v && !seen.has(v.videoId)) {
            seen.add(v.videoId);
            v.inShelf = !!inShelf;
            v.position = out.length + 1;
            out.push(v);
          }
          continue;
        }
        rec(val, inShelf || SHELF_KEYS.has(key));
      }
    })(rootNode, false);
    return out;
  }

  function lastContinuation(scope) {
    const items = findAll(scope, 'continuationItemRenderer');
    for (let i = items.length - 1; i >= 0; i--) {
      const cmd = findFirst(items[i], 'continuationCommand');
      if (cmd && cmd.token) return cmd.token;
    }
    return null;
  }

  /* ---------------------------------------------------------- analyseurs */

  function parseSearch(json) {
    const scope = json.contents || json.onResponseReceivedCommands || json.onResponseReceivedActions || json;
    const related = [];
    for (const r of Array.isArray(json.refinements) ? json.refinements : []) if (typeof r === 'string') related.push(r);
    for (const c of findAll(json, 'searchRefinementCardRenderer')) {
      const q = textOf(c.query);
      if (q) related.push(q);
    }
    const corrected = findFirst(json, 'showingResultsForRenderer') || findFirst(json, 'didYouMeanRenderer');
    return {
      estimatedResults: Number(json.estimatedResults) || 0,
      videos: collectVideos(scope),
      continuation: lastContinuation(scope),
      related: [...new Set(related)],
      correctedQuery: corrected ? textOf(corrected.correctedQuery) : null,
    };
  }

  function parsePlayer(json) {
    const d = json.videoDetails || {};
    const mf = (json.microformat && json.microformat.playerMicroformatRenderer) || {};
    const ps = json.playabilityStatus || {};
    const tracks = (json.captions && json.captions.playerCaptionsTracklistRenderer && json.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
    const published = mf.publishDate || mf.uploadDate;
    return {
      videoId: d.videoId,
      title: d.title || textOf(mf.title),
      description: d.shortDescription != null ? d.shortDescription : textOf(mf.description),
      tags: Array.isArray(d.keywords) ? d.keywords : [],
      channelId: d.channelId || mf.externalChannelId,
      channelName: d.author || mf.ownerChannelName,
      views: d.viewCount != null ? Number(d.viewCount) : mf.viewCount != null ? Number(mf.viewCount) : null,
      durationSec: d.lengthSeconds != null ? Number(d.lengthSeconds) : null,
      isLive: !!(d.isLiveContent && d.isLive),
      wasLive: !!d.isLiveContent,
      isPrivate: !!d.isPrivate,
      isUnlisted: !!mf.isUnlisted,
      isFamilySafe: mf.isFamilySafe !== false,
      category: mf.category || null,
      publishedAt: published ? Date.parse(published) : null,
      uploadDate: mf.uploadDate || null,
      thumbnail: bestThumb(d.thumbnail && d.thumbnail.thumbnails) || (d.videoId ? MT.thumbUrl(d.videoId, 'hqdefault') : null),
      ownerUrl: mf.ownerProfileUrl || null,
      availableCountries: Array.isArray(mf.availableCountries) ? mf.availableCountries.length : null,
      captions: tracks.map((t) => ({ lang: t.languageCode, name: textOf(t.name), auto: t.kind === 'asr' })),
      playability: ps.status || null,
      playabilityReason: ps.reason || null,
    };
  }

  function parseNext(json) {
    const out = {};
    const vp = findFirst(json, 'videoPrimaryInfoRenderer');
    if (vp) {
      out.dateText = textOf(vp.dateText);
      out.relativeDateText = textOf(vp.relativeDateText);
      out.hashtags = (vp.superTitleLink && vp.superTitleLink.runs ? vp.superTitleLink.runs : []).map((r) => r.text.trim()).filter((t) => t.startsWith('#'));
    }
    const vvc = findFirst(json, 'videoViewCountRenderer');
    if (vvc) out.views = vvc.originalViewCount != null && vvc.originalViewCount !== '' ? Number(vvc.originalViewCount) : MT.parseCount(textOf(vvc.viewCount));

    const seg = findFirst(json, 'segmentedLikeDislikeButtonViewModel');
    if (seg) {
      const likeVm = findFirst(seg, 'likeButtonViewModel') || seg;
      const acc = findAll(likeVm, 'accessibilityText').find((t) => typeof t === 'string' && /\d/.test(t));
      const title = findAll(likeVm, 'title').find((t) => typeof t === 'string' && /\d/.test(t));
      out.likes = acc ? MT.parseCount(acc) : null;
      if (out.likes == null && title) out.likes = MT.parseCount(title);
      out.likesText = title || '';
    } else {
      const tb = findWhere(json, (o) => o.toggleButtonRenderer && o.toggleButtonRenderer.defaultIcon && o.toggleButtonRenderer.defaultIcon.iconType === 'LIKE');
      if (tb) {
        const label =
          (tb.toggleButtonRenderer.defaultText && tb.toggleButtonRenderer.defaultText.accessibility && tb.toggleButtonRenderer.defaultText.accessibility.accessibilityData.label) ||
          textOf(tb.toggleButtonRenderer.defaultText);
        out.likes = MT.parseCount(label);
      }
    }

    for (const p of findAll(json, 'engagementPanelSectionListRenderer')) {
      if (p.panelIdentifier === 'engagement-panel-comments-section') {
        const ctx = findFirst(p.header, 'contextualInfo');
        if (ctx) out.comments = MT.parseCount(textOf(ctx));
      }
    }
    if (out.comments == null) {
      const ce = findFirst(json, 'commentsEntryPointHeaderRenderer');
      if (ce) out.comments = MT.parseCount(textOf(ce.commentCount));
    }

    const owner = findFirst(json, 'videoOwnerRenderer');
    if (owner) {
      const be = owner.navigationEndpoint && owner.navigationEndpoint.browseEndpoint;
      out.channel = {
        channelId: be && be.browseId,
        url: be && be.canonicalBaseUrl ? BASE + be.canonicalBaseUrl : null,
        title: textOf(owner.title),
        subscribers: MT.parseCount(textOf(owner.subscriberCountText)),
        subscribersText: textOf(owner.subscriberCountText),
        avatar: bestThumb(owner.thumbnail && owner.thumbnail.thumbnails),
        verified: JSON.stringify(owner.badges || []).includes('VERIFIED'),
      };
    }
    const secondary = findFirst(json, 'secondaryResults');
    out.related = secondary ? collectVideos(secondary).slice(0, 20) : [];
    out.commentsToken = commentsToken(json);
    return out;
  }

  function commentsToken(json) {
    for (const sec of findAll(json, 'itemSectionRenderer')) {
      if (sec && (sec.sectionIdentifier === 'comment-item-section' || sec.targetId === 'comments-section')) {
        const c = findFirst(sec, 'continuationCommand');
        if (c && c.token) return c.token;
      }
    }
    for (const p of findAll(json, 'engagementPanelSectionListRenderer')) {
      if (p.panelIdentifier === 'engagement-panel-comments-section') {
        const c = findFirst(p.content, 'continuationCommand');
        if (c && c.token) return c.token;
      }
    }
    return null;
  }

  function fromCommentEntity(ent) {
    const props = ent.properties || {};
    const author = ent.author || {};
    const toolbar = ent.toolbar || {};
    const content = props.content && typeof props.content === 'object' ? props.content.content : props.content;
    return {
      id: props.commentId || ent.key,
      text: content || '',
      author: author.displayName || '',
      authorChannelId: author.channelId || null,
      authorAvatar: author.avatarThumbnailUrl || null,
      isOwner: !!author.isCreator,
      isVerified: !!author.isVerified,
      likes: MT.parseCount(toolbar.likeCountNotliked) || 0,
      replies: MT.parseCount(toolbar.replyCount) || 0,
      publishedText: props.publishedTime || '',
      ageSec: MT.parseRelative(props.publishedTime),
      replyLevel: props.replyLevel || 0,
    };
  }

  function fromCommentRenderer(c) {
    const published = textOf(c.publishedTimeText);
    return {
      id: c.commentId,
      text: textOf(c.contentText),
      author: textOf(c.authorText),
      authorChannelId: c.authorEndpoint && c.authorEndpoint.browseEndpoint ? c.authorEndpoint.browseEndpoint.browseId : null,
      authorAvatar: bestThumb(c.authorThumbnail && c.authorThumbnail.thumbnails),
      isOwner: !!c.authorIsChannelOwner,
      isVerified: false,
      likes: MT.parseCount(textOf(c.voteCount)) || 0,
      replies: c.replyCount || 0,
      publishedText: published,
      ageSec: MT.parseRelative(published),
      replyLevel: 0,
    };
  }

  function parseComments(json) {
    const items = [];
    for (const ep of json.onResponseReceivedEndpoints || []) {
      const action = ep.reloadContinuationItemsCommand || ep.appendContinuationItemsAction;
      if (action && Array.isArray(action.continuationItems)) items.push(...action.continuationItems);
    }
    const entities = new Map();
    const mutations = (json.frameworkUpdates && json.frameworkUpdates.entityBatchUpdate && json.frameworkUpdates.entityBatchUpdate.mutations) || [];
    for (const m of mutations) {
      const p = m.payload && m.payload.commentEntityPayload;
      if (p) entities.set(m.entityKey || p.key, p);
    }
    const comments = [];
    let next = null;
    let total = null;
    let sortNewToken = null;
    for (const it of items) {
      if (it.commentsHeaderRenderer) {
        const h = it.commentsHeaderRenderer;
        total = MT.parseCount(textOf(h.countText) || textOf(h.commentsCount));
        const menu = findFirst(h, 'sortFilterSubMenuRenderer');
        const sub = menu && menu.subMenuItems && menu.subMenuItems[1];
        const cmd = sub && findFirst(sub, 'continuationCommand');
        sortNewToken = cmd ? cmd.token : null;
      } else if (it.commentThreadRenderer) {
        const t = it.commentThreadRenderer;
        const key = findFirst(t.commentViewModel, 'commentKey');
        const ent = key && entities.get(key);
        if (ent) comments.push(fromCommentEntity(ent));
        else if (t.comment && t.comment.commentRenderer) comments.push(fromCommentRenderer(t.comment.commentRenderer));
      } else if (it.continuationItemRenderer) {
        const cmd = findFirst(it.continuationItemRenderer, 'continuationCommand');
        if (cmd && cmd.token) next = cmd.token;
      }
    }
    if (!comments.length && entities.size) {
      for (const ent of entities.values()) if (!(ent.properties && ent.properties.replyLevel)) comments.push(fromCommentEntity(ent));
    }
    return { comments, next, total, sortNewToken };
  }

  function parseChannel(json) {
    const md = (json.metadata && json.metadata.channelMetadataRenderer) || {};
    const mf = (json.microformat && json.microformat.microformatDataRenderer) || {};
    const header = json.header || {};
    let subsText = '';
    let videosText = '';
    let handle = '';
    let banner = null;
    let avatar = bestThumb(md.avatar && md.avatar.thumbnails);
    const c4 = header.c4TabbedHeaderRenderer;
    if (c4) {
      subsText = textOf(c4.subscriberCountText);
      videosText = textOf(c4.videosCountText);
      handle = textOf(c4.channelHandleText);
      banner = bestThumb(c4.banner && c4.banner.thumbnails);
      avatar = avatar || bestThumb(c4.avatar && c4.avatar.thumbnails);
    }
    const phv = findFirst(header, 'pageHeaderViewModel');
    if (phv) {
      const rows = (phv.metadata && phv.metadata.contentMetadataViewModel && phv.metadata.contentMetadataViewModel.metadataRows) || [];
      const parts = rows.flatMap((r) => (r.metadataParts || []).map((p) => textOf(p.text)));
      handle = handle || parts.find((p) => p.trim().startsWith('@')) || '';
      const nums = parts.filter((p) => !p.trim().startsWith('@') && /\d/.test(p));
      subsText = subsText || nums[0] || '';
      videosText = videosText || nums[1] || '';
      banner = banner || bestThumb(findFirst(phv.banner, 'sources'));
      avatar = avatar || bestThumb(findFirst(phv.image, 'sources'));
    }
    const tabs = findAll(json.contents, 'tabRenderer').map((t) => ({
      title: t.title || '',
      url: (t.endpoint && t.endpoint.commandMetadata && t.endpoint.commandMetadata.webCommandMetadata && t.endpoint.commandMetadata.webCommandMetadata.url) || '',
      params: t.endpoint && t.endpoint.browseEndpoint ? t.endpoint.browseEndpoint.params : null,
      selected: !!t.selected,
    }));
    const aboutCmd = findFirst(header, 'continuationCommand');
    const headerJson = JSON.stringify(header);
    return {
      channelId: md.externalId || null,
      title: md.title || textOf(findFirst(phv && phv.title, 'content')),
      description: md.description || '',
      keywords: Array.isArray(mf.tags) && mf.tags.length ? mf.tags : parseKeywordString(md.keywords),
      handle: handle.trim(),
      avatar,
      banner,
      url: md.vanityChannelUrl || md.channelUrl || (md.externalId ? `${BASE}/channel/${md.externalId}` : null),
      isFamilySafe: md.isFamilySafe !== false,
      subscribers: MT.parseCount(subsText),
      subscribersText: subsText,
      videoCount: MT.parseCount(videosText),
      videoCountText: videosText,
      tabs,
      aboutToken: aboutCmd ? aboutCmd.token : null,
      verified: /CHECK_CIRCLE|BADGE_STYLE_TYPE_VERIFIED/.test(headerJson),
    };
  }

  function parseAbout(json) {
    const a = findFirst(json, 'aboutChannelViewModel');
    if (!a) return null;
    const joinedText = textOf(a.joinedDateText);
    return {
      description: a.description || '',
      country: a.country || null,
      views: MT.parseCount(textOf(a.viewCountText)),
      viewsText: textOf(a.viewCountText),
      joinedAt: MT.parseDateText(joinedText),
      joinedText,
      subscribers: MT.parseCount(textOf(a.subscriberCountText)),
      videoCount: MT.parseCount(textOf(a.videoCountText)),
      links: (a.links || [])
        .map((l) => l.channelExternalLinkViewModel)
        .filter(Boolean)
        .map((v) => {
          let url = textOf(v.link);
          if (url && !/^https?:/.test(url)) url = 'https://' + url;
          return { title: textOf(v.title), url };
        }),
      canonicalUrl: a.canonicalChannelUrl || null,
    };
  }

  function parseRss(xml) {
    const entries = [];
    const re = /<entry>([\s\S]*?)<\/entry>/g;
    let m;
    while ((m = re.exec(xml))) {
      const e = m[1];
      const get = (tag) => {
        const r = e.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
        return r ? decodeXml(r[1]).trim() : '';
      };
      const attr = (tag, a) => {
        const r = e.match(new RegExp(`<${tag}\\b[^>]*\\b${a}="([^"]*)"`));
        return r ? decodeXml(r[1]) : null;
      };
      const views = attr('media:statistics', 'views');
      const likes = attr('media:starRating', 'count');
      const href = attr('link', 'href') || '';
      entries.push({
        videoId: get('yt:videoId'),
        title: get('title'),
        publishedAt: Date.parse(get('published')) || null,
        updatedAt: Date.parse(get('updated')) || null,
        description: get('media:description'),
        views: views != null ? Number(views) : null,
        likes: likes != null ? Number(likes) : null,
        thumbnail: attr('media:thumbnail', 'url'),
        channelId: get('yt:channelId'),
        isShort: /\/shorts\//.test(href),
      });
    }
    const head = xml.split('<entry>')[0];
    const title = (head.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const channelId = (head.match(/<yt:channelId>([\s\S]*?)<\/yt:channelId>/) || [])[1];
    return { channelId: channelId || (entries[0] && entries[0].channelId) || null, title: title ? decodeXml(title) : '', entries };
  }

  function parseSuggest(txt) {
    const start = txt.indexOf('[');
    const end = txt.lastIndexOf(']');
    if (start < 0 || end < start) return [];
    let arr;
    try {
      arr = JSON.parse(txt.slice(start, end + 1));
    } catch (e) {
      return [];
    }
    const list = Array.isArray(arr[1]) ? arr[1] : [];
    return list.map((x) => (Array.isArray(x) ? x[0] : x)).filter((s) => typeof s === 'string');
  }

  /* -------------------------------------------------------------- client */

  const cfg = { hl: 'fr', gl: 'FR', clientVersion: DEFAULT_CLIENT_VERSION, apiKey: '', loaded: false };

  async function loadConfig() {
    if (cfg.loaded || !MT.store || typeof browser === 'undefined') return cfg;
    try {
      const s = await MT.store.getSettings();
      cfg.hl = s.language || 'fr';
      cfg.gl = s.region || 'FR';
      cfg.apiKey = s.apiKey || '';
      const cv = await MT.store.get('clientVersion', null);
      if (cv && /^2\.\d{8}\.\d{2}\.\d{2}$/.test(cv) && cv > cfg.clientVersion) cfg.clientVersion = cv;
      cfg.loaded = true;
      MT.store.onChange(['settings', 'clientVersion'], () => {
        cfg.loaded = false;
      });
    } catch (e) {
      /* hors extension (tests) */
    }
    return cfg;
  }

  function configure(patch) {
    Object.assign(cfg, patch);
  }

  function context() {
    return {
      client: {
        clientName: 'WEB',
        clientVersion: cfg.clientVersion,
        hl: cfg.hl,
        gl: cfg.gl,
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
      },
      user: { lockedSafetyMode: false },
    };
  }

  const cache = new Map();
  function cached(key, ttlMs, fn) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;
    const promise = fn().catch((e) => {
      cache.delete(key);
      throw e;
    });
    cache.set(key, { promise, expires: Date.now() + ttlMs });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return promise;
  }

  function httpError(status) {
    if (status === 429) return new YtError('YouTube limite temporairement les requêtes (429). Patientez quelques minutes.', status);
    if (status === 403) return new YtError('Accès refusé par YouTube (403).', status);
    return new YtError(`YouTube a répondu avec l’erreur ${status}.`, status);
  }

  async function post(endpoint, body) {
    await loadConfig();
    let res;
    try {
      res = await fetch(`${BASE}/youtubei/v1/${endpoint}?prettyPrint=false`, {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'X-Youtube-Client-Name': '1',
          'X-Youtube-Client-Version': cfg.clientVersion,
        },
        body: JSON.stringify({ context: context(), ...body }),
      });
    } catch (e) {
      throw new YtError('Impossible de joindre YouTube. Vérifiez votre connexion et les autorisations de l’extension.', 0);
    }
    if (!res.ok) throw httpError(res.status);
    return res.json();
  }

  async function fetchText(url, opts = {}) {
    let res;
    try {
      res = await fetch(url, { credentials: 'include', ...opts });
    } catch (e) {
      throw new YtError('Impossible de joindre YouTube.', 0);
    }
    if (/consent\./.test(res.url)) throw new YtError('YouTube demande d’accepter les cookies : ouvrez youtube.com, acceptez, puis réessayez.', 0);
    if (!res.ok) throw httpError(res.status);
    return res.text();
  }

  /* ----------------------------------------------------------- recherche */

  async function searchPage(query, sp) {
    await loadConfig();
    return cached(`s:${cfg.hl}:${cfg.gl}:${sp || ''}:${query}`, 10 * 60 * 1000, async () =>
      parseSearch(await post('search', sp ? { query, params: decodeURIComponent(sp) } : { query }))
    );
  }

  async function searchContinue(token) {
    return parseSearch(await post('search', { continuation: token }));
  }

  /** Recherche agrégée sur plusieurs pages ; renvoie au moins `limit` vidéos si possible. */
  async function search(query, { limit = 20, sp } = {}) {
    const first = await searchPage(query, sp);
    const videos = [...first.videos];
    const seen = new Set(videos.map((v) => v.videoId));
    let token = first.continuation;
    let pages = 1;
    while (token && videos.filter((v) => !v.inShelf).length < limit && pages < 8) {
      const page = await searchContinue(token);
      for (const v of page.videos)
        if (!seen.has(v.videoId)) {
          seen.add(v.videoId);
          videos.push(v);
        }
      token = page.continuation;
      pages++;
    }
    let pos = 0;
    for (const v of videos) v.rank = v.inShelf ? null : ++pos;
    return { ...first, videos, continuation: token };
  }

  async function suggest(query, opts = {}) {
    await loadConfig();
    const hl = opts.hl || cfg.hl;
    const gl = opts.gl || cfg.gl;
    return cached(`ac:${hl}:${gl}:${query}`, 30 * 60 * 1000, async () => {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ie=utf-8&oe=utf-8&q=${encodeURIComponent(query)}`;
      let res;
      try {
        res = await fetch(url, { credentials: 'omit' });
      } catch (e) {
        throw new YtError('Autocomplétion indisponible.', 0);
      }
      if (!res.ok) throw httpError(res.status);
      const buf = await res.arrayBuffer();
      const charset = ((res.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || [])[1] || 'utf-8';
      let txt;
      try {
        txt = new TextDecoder(charset).decode(buf);
      } catch (e) {
        txt = new TextDecoder().decode(buf);
      }
      return parseSuggest(txt);
    });
  }

  /** Position d'une vidéo dans les résultats d'un mot-clé (null si absente des N premiers). */
  async function rankOf(videoId, keyword, { maxResults = 100, sp } = {}) {
    let page = await searchPage(keyword, sp);
    const seen = new Set();
    const top = [];
    let pos = 0;
    let pages = 1;
    const maxPages = Math.ceil(maxResults / 15) + 2;
    for (;;) {
      for (const v of page.videos) {
        if (seen.has(v.videoId)) continue;
        seen.add(v.videoId);
        if (v.inShelf) {
          if (v.videoId === videoId) return { rank: null, inShelf: true, checked: pos, top };
          continue;
        }
        pos++;
        if (top.length < 3) top.push({ videoId: v.videoId, title: v.title, channelName: v.channelName, views: v.views });
        if (v.videoId === videoId) return { rank: pos, checked: pos, top };
        if (pos >= maxResults) return { rank: null, checked: pos, top };
      }
      if (!page.continuation || pages >= maxPages) break;
      page = await searchContinue(page.continuation);
      pages++;
    }
    return { rank: null, checked: pos, top };
  }

  /* -------------------------------------------------------------- vidéos */

  async function player(videoId) {
    return cached(`p:${videoId}`, 30 * 60 * 1000, async () => {
      const json = await post('player', { videoId, contentCheckOk: true, racyCheckOk: true });
      if (!json.videoDetails) throw new YtError(json.playabilityStatus && json.playabilityStatus.reason ? json.playabilityStatus.reason : 'Détails de la vidéo indisponibles', 0);
      return parsePlayer(json);
    });
  }

  async function next(videoId) {
    return cached(`n:${videoId}`, 10 * 60 * 1000, async () => parseNext(await post('next', { videoId })));
  }

  async function watchPageFallback(videoId) {
    const html = await fetchText(`${BASE}/watch?v=${videoId}&hl=${cfg.hl}&gl=${cfg.gl}&bpctr=9999999999&has_verified=1`);
    const pr = extractJson(html, 'ytInitialPlayerResponse');
    const id = extractJson(html, 'ytInitialData');
    return { details: pr && pr.videoDetails ? parsePlayer(pr) : null, next: id ? parseNext(id) : null };
  }

  /** Fiche complète d'une vidéo (détails + engagement + chaîne). */
  async function getVideo(videoId, { withNext = true } = {}) {
    await loadConfig();
    let details = null;
    let nx = null;
    let firstError = null;
    try {
      details = await player(videoId);
    } catch (e) {
      firstError = e;
    }
    if (withNext) {
      try {
        nx = await next(videoId);
      } catch (e) {
        firstError = firstError || e;
      }
    }
    if (!details) {
      try {
        const fb = await watchPageFallback(videoId);
        details = fb.details;
        nx = nx || fb.next;
      } catch (e) {
        firstError = firstError || e;
      }
    }
    if (!details) throw firstError || new YtError('Vidéo introuvable.', 404);
    const video = { ...details };
    if (nx) {
      video.likes = nx.likes != null ? nx.likes : null;
      video.comments = nx.comments != null ? nx.comments : null;
      if (video.views == null && nx.views != null) video.views = nx.views;
      video.channel = nx.channel || null;
      video.related = nx.related || [];
      video.dateText = nx.dateText || '';
      video.hashtagsShown = nx.hashtags || [];
    }
    if (cfg.apiKey && MT.ytapi) {
      try {
        const [api] = await MT.ytapi.videos([videoId], { apiKey: cfg.apiKey });
        if (api) {
          video.views = api.views != null ? api.views : video.views;
          video.likes = api.likes != null ? api.likes : video.likes;
          video.comments = api.comments != null ? api.comments : video.comments;
          video.publishedAt = api.publishedAt || video.publishedAt;
          if (api.tags && api.tags.length) video.tags = api.tags;
          video.categoryId = api.categoryId;
          video.definition = api.definition;
          video.caption = api.caption;
          video.defaultLanguage = api.defaultLanguage;
        }
      } catch (e) {
        /* la clé API est facultative */
      }
    }
    const ageDays = video.publishedAt ? Math.max(1, (Date.now() - video.publishedAt) / 86400000) : null;
    video.ageDays = ageDays;
    video.viewsPerDay = ageDays && video.views != null ? video.views / ageDays : null;
    video.engagement = video.views ? ((video.likes || 0) + (video.comments || 0)) / video.views : null;
    video.likeRatio = video.views && video.likes != null ? video.likes / video.views : null;
    video.isShort = video.durationSec != null && video.durationSec <= 180 && /#shorts/i.test(video.title + ' ' + video.description) ? true : video.isShort || false;
    return video;
  }

  async function getVideoTags(videoId) {
    try {
      const d = await player(videoId);
      return d.tags;
    } catch (e) {
      const v = await getVideo(videoId, { withNext: false });
      return v.tags;
    }
  }

  /** Commentaires d'une vidéo (pagination automatique). */
  async function getComments(videoId, { max = 500, sort = 'top', onProgress } = {}) {
    const first = await post('next', { videoId });
    let token = commentsToken(first);
    if (!token) return { comments: [], total: 0, disabled: true };
    let page = parseComments(await post('next', { continuation: token }));
    const total = page.total;
    if (sort === 'new' && page.sortNewToken) page = parseComments(await post('next', { continuation: page.sortNewToken }));
    const all = new Map();
    for (const c of page.comments) all.set(c.id, c);
    token = page.next;
    if (onProgress) onProgress(all.size, total);
    while (token && all.size < max) {
      await MT.sleep(120);
      page = parseComments(await post('next', { continuation: token }));
      if (!page.comments.length) break;
      for (const c of page.comments) all.set(c.id, c);
      token = page.next;
      if (onProgress) onProgress(all.size, total);
    }
    return { comments: [...all.values()].slice(0, max), total, truncated: !!token };
  }

  /* ------------------------------------------------------------- chaînes */

  async function resolveChannel(input) {
    const ref = typeof input === 'object' && input && input.type ? input : MT.channelRefFromUrl(input);
    if (!ref) throw new YtError('Chaîne introuvable : saisissez une URL, un @handle ou un identifiant UC…', 400);
    if (ref.type === 'id') return ref.value;
    return cached(`r:${ref.type}:${ref.value}`, 24 * 3600 * 1000, async () => {
      const url = MT.channelUrl(ref);
      try {
        const json = await post('navigation/resolve_url', { url });
        const id = findFirst(json, 'browseId');
        if (id && id.startsWith('UC')) return id;
      } catch (e) {
        /* repli HTML */
      }
      const html = await fetchText(url);
      const m = html.match(/"externalId":"(UC[\w-]{22})"/) || html.match(/<meta itemprop="identifier" content="(UC[\w-]{22})"/) || html.match(/"channelId":"(UC[\w-]{22})"/);
      if (!m) throw new YtError('Chaîne introuvable.', 404);
      return m[1];
    });
  }

  async function browse(browseId, params) {
    return post('browse', params ? { browseId, params: decodeURIComponent(params) } : { browseId });
  }

  async function getRss(channelId) {
    return cached(`rss:${channelId}`, 15 * 60 * 1000, async () => {
      const res = await fetch(`${BASE}/feeds/videos.xml?channel_id=${channelId}`, { credentials: 'omit' });
      if (!res.ok) throw httpError(res.status);
      return parseRss(await res.text());
    });
  }

  /** Vidéos d'un onglet de chaîne (videos/shorts/streams). */
  async function getChannelVideos(channelId, { limit = 30, tab = 'videos', channelJson } = {}) {
    let params = TAB_PARAMS[tab];
    if (channelJson) {
      const t = parseChannel(channelJson).tabs.find((x) => x.url.endsWith('/' + tab));
      if (t && t.params) params = t.params;
    }
    let json = await browse(channelId, params);
    const videos = collectVideos(json.contents);
    let token = lastContinuation(json.contents);
    let pages = 1;
    while (token && videos.length < limit && pages < 10) {
      json = await post('browse', { continuation: token });
      const scope = json.onResponseReceivedActions || json.onResponseReceivedEndpoints;
      const more = collectVideos(scope);
      if (!more.length) break;
      for (const v of more) if (!videos.some((x) => x.videoId === v.videoId)) videos.push(v);
      token = lastContinuation(scope);
      pages++;
    }
    if (tab === 'shorts') videos.forEach((v) => (v.isShort = true));
    return videos.slice(0, limit);
  }

  /**
   * Fiche complète d'une chaîne : en-tête, à propos, RSS (dates exactes), vidéos récentes.
   */
  async function getChannel(input, { withVideos = true, videoLimit = 30 } = {}) {
    await loadConfig();
    const channelId = await resolveChannel(input);
    return cached(`c:${channelId}:${withVideos}:${videoLimit}`, 10 * 60 * 1000, async () => {
      const json = await browse(channelId);
      const channel = parseChannel(json);
      channel.channelId = channel.channelId || channelId;
      const tasks = [];
      if (channel.aboutToken) {
        tasks.push(
          post('browse', { continuation: channel.aboutToken })
            .then((j) => (channel.about = parseAbout(j)))
            .catch(() => (channel.about = null))
        );
      }
      tasks.push(
        getRss(channelId)
          .then((r) => (channel.rss = r.entries))
          .catch(() => (channel.rss = []))
      );
      if (withVideos) {
        tasks.push(
          getChannelVideos(channelId, { limit: videoLimit, channelJson: json })
            .then((v) => (channel.videos = v))
            .catch(() => (channel.videos = []))
        );
      }
      await Promise.all(tasks);
      const about = channel.about || {};
      channel.totalViews = about.views != null ? about.views : null;
      channel.joinedAt = about.joinedAt || null;
      channel.country = about.country || null;
      channel.links = about.links || [];
      if (!channel.description && about.description) channel.description = about.description;
      if (channel.subscribers == null && about.subscribers != null) channel.subscribers = about.subscribers;
      if (channel.videoCount == null && about.videoCount != null) channel.videoCount = about.videoCount;

      if (cfg.apiKey && MT.ytapi) {
        try {
          const [api] = await MT.ytapi.channels({ ids: [channelId] }, { apiKey: cfg.apiKey });
          if (api) {
            channel.subscribers = api.subscribers != null ? api.subscribers : channel.subscribers;
            channel.totalViews = api.views != null ? api.views : channel.totalViews;
            channel.videoCount = api.videoCount != null ? api.videoCount : channel.videoCount;
            channel.joinedAt = api.publishedAt || channel.joinedAt;
            channel.country = api.country || channel.country;
            channel.uploadsPlaylist = api.uploadsPlaylist;
          }
        } catch (e) {
          /* facultatif */
        }
      }
      channel.stats = channelStats(channel);
      return channel;
    });
  }

  /** Statistiques dérivées : moyenne/médiane de vues, fréquence, vues mensuelles estimées. */
  function channelStats(channel) {
    const rss = channel.rss || [];
    const videos = channel.videos || [];
    const byId = new Map(rss.map((e) => [e.videoId, e]));
    const merged = videos.map((v) => {
      const r = byId.get(v.videoId);
      return { ...v, publishedAt: r ? r.publishedAt : v.ageSec != null ? Date.now() - v.ageSec * 1000 : null, views: v.views != null ? v.views : r ? r.views : null };
    });
    for (const r of rss) if (!merged.some((v) => v.videoId === r.videoId)) merged.push({ ...r, ageSec: r.publishedAt ? (Date.now() - r.publishedAt) / 1000 : null });
    merged.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    const long = merged.filter((v) => !v.isShort);
    const sample = (long.length >= 5 ? long : merged).slice(0, 30);
    const views = sample.map((v) => v.views).filter((v) => v != null);
    const dates = merged
      .map((v) => v.publishedAt)
      .filter(Boolean)
      .sort((a, b) => b - a);
    let uploadsPerWeek = null;
    if (dates.length >= 2) {
      // rythme actuel : 15 publications les plus récentes (les anciennes vidéos faussent la moyenne)
      const recent = dates.slice(0, 15);
      const spanDays = Math.max(1, (recent[0] - recent[recent.length - 1]) / 86400000);
      uploadsPerWeek = ((recent.length - 1) / spanDays) * 7;
    }
    const last30 = merged.filter((v) => v.publishedAt && Date.now() - v.publishedAt <= 30 * 86400000);
    // vues mensuelles estimées : vues/jour moyennes des vidéos récentes × 30 (approximation prudente)
    const vpd = sample.filter((v) => v.views != null && v.publishedAt).map((v) => v.views / Math.max(1, (Date.now() - v.publishedAt) / 86400000));
    let monthlyViews = vpd.length ? vpd.reduce((a, b) => a + b, 0) * 30 * 0.5 : null;
    if (channel.totalViews && channel.joinedAt) {
      const lifetimeMonthly = channel.totalViews / Math.max(1, (Date.now() - channel.joinedAt) / (30 * 86400000));
      monthlyViews = monthlyViews != null ? (monthlyViews + lifetimeMonthly) / 2 : lifetimeMonthly;
    }
    return {
      sampleSize: sample.length,
      avgViews: MT.mean(views),
      medianViews: MT.median(views),
      maxViews: views.length ? Math.max(...views) : null,
      uploadsPerWeek,
      uploadsLast30: last30.length,
      lastUploadAt: dates[0] || null,
      monthlyViews,
      viewsPerSub: channel.subscribers ? (MT.mean(views) || 0) / channel.subscribers : null,
      videos: merged,
    };
  }

  function setClientVersion(v) {
    if (v && /^2\.\d{8}\.\d{2}\.\d{2}$/.test(v) && v > cfg.clientVersion) cfg.clientVersion = v;
  }

  MT.yt = {
    BASE,
    TAB_PARAMS,
    SEARCH_FILTERS,
    YtError,
    textOf,
    findAll,
    findFirst,
    findWhere,
    extractJson,
    collectVideos,
    parseSearch,
    parsePlayer,
    parseNext,
    parseComments,
    parseChannel,
    parseAbout,
    parseRss,
    parseSuggest,
    parseKeywordString,
    commentsToken,
    channelStats,
    configure,
    loadConfig,
    post,
    search,
    searchPage,
    searchContinue,
    suggest,
    rankOf,
    player,
    getVideo,
    getVideoTags,
    getComments,
    resolveChannel,
    getRss,
    getChannel,
    getChannelVideos,
    setClientVersion,
  };

  if (typeof module === 'object' && module.exports) module.exports = MT.yt;
})(typeof globalThis !== 'undefined' ? globalThis : this);
