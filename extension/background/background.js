/*
 * MyTube SEO — script d'arrière-plan : routeur de messages (scripts de contenu → données YouTube),
 * alarmes, menus contextuels, raccourcis clavier.
 */
(function () {
  'use strict';
  const MT = globalThis.MT;

  // Fonctions de MT.yt accessibles aux scripts de contenu
  const YT_ALLOWED = new Set(['search', 'searchPage', 'suggest', 'rankOf', 'getVideo', 'getVideoTags', 'getChannel', 'getChannelVideos', 'resolveChannel', 'getRss']);
  const AI_ALLOWED = new Set(['titles', 'description', 'tags', 'replies', 'thumbnailTexts', 'available']);

  function openApp(route = '') {
    return browser.tabs.create({ url: browser.runtime.getURL('app/app.html') + '#/' + route.replace(/^#?\/?/, '') });
  }

  const handlers = {
    yt: ({ fn, args = [] }) => {
      if (!YT_ALLOWED.has(fn)) throw new Error('Fonction non autorisée : ' + fn);
      return MT.yt[fn](...args);
    },
    'keyword.analyze': ({ keyword }) => MT.research.analyzeKeyword(keyword),
    'keyword.quick': ({ keyword }) => MT.research.quickScore(keyword),
    'keyword.topTags': async ({ videos, limit }) => MT.research.topTags(videos, { limit }),
    'tags.forVideos': async ({ ids }) => {
      const res = await MT.pool(ids, 4, async (id) => ({ videoId: id, tags: await MT.yt.getVideoTags(id) }));
      return res.filter((r) => r && !r.error);
    },
    'rank.check': async ({ videoId, keyword, maxResults }) => MT.yt.rankOf(videoId, keyword, { maxResults: maxResults || 50 }),
    'rank.track': (p) => MT.research.trackRank(p),
    'competitor.add': ({ input }) => MT.research.addCompetitor(input),
    translate: ({ text, target }) => MT.translate.translate(text, target),
    ai: ({ fn, args = [] }) => {
      if (!AI_ALLOWED.has(fn)) throw new Error('Fonction IA non autorisée');
      return MT.ai[fn](...args);
    },
    'idea.add': (idea) => MT.store.upsert('ideas', { status: 'idea', createdAt: Date.now(), ...idea }),
    'frame.store': async ({ dataUrl, videoId, title }) => {
      await MT.store.set('pendingFrame', { dataUrl, videoId, title, t: Date.now() });
      await openApp('thumbnails?frame=1');
      return true;
    },
    'open.app': ({ route }) => openApp(route).then(() => true),
    clientVersion: async ({ version }) => {
      const current = await MT.store.get('clientVersion', null);
      if (version && /^2\.\d{8}\.\d{2}\.\d{2}$/.test(version) && (!current || version > current)) {
        await MT.store.set('clientVersion', version);
        MT.yt.setClientVersion(version);
      }
      return true;
    },
    'ab.advance': async ({ id, finish }) => {
      const auth = await MT.oauth.auth({ interactive: false });
      await MT.jobs.advanceAbTest(id, auth, { finish });
      return true;
    },
    'jobs.run': async ({ name }) => {
      await MT.jobs.run(name);
      return true;
    },
  };

  browser.runtime.onMessage.addListener((msg, sender) => {
    const handler = msg && handlers[msg.type];
    if (!handler) return undefined;
    return Promise.resolve()
      .then(() => handler(msg.payload || {}, sender))
      .then(
        (data) => ({ ok: true, data }),
        (e) => ({ ok: false, error: (e && e.message) || String(e) })
      );
  });

  /* ------------------------------------------------------------ alarmes */

  browser.alarms.onAlarm.addListener((alarm) => {
    MT.jobs.run(alarm.name);
  });

  /* ------------------------------------------------------- notifications */

  const NOTIF_ROUTES = [
    ['rank-', 'rank'],
    ['alert-', 'alerts'],
    ['ab-', 'abtests'],
    ['sched-', 'scheduled'],
  ];
  browser.notifications.onClicked.addListener((id) => {
    const match = NOTIF_ROUTES.find(([p]) => id.startsWith(p));
    openApp(match ? match[1] : '');
    browser.notifications.clear(id);
  });

  /* ---------------------------------------------------- menus contextuels */

  function createMenus() {
    browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({ id: 'mt-kw', title: 'Analyser « %s » (explorateur de mots-clés)', contexts: ['selection'] });
      browser.contextMenus.create({
        id: 'mt-video-link',
        title: 'Analyser cette vidéo (Videolytics)',
        contexts: ['link'],
        targetUrlPatterns: ['*://www.youtube.com/watch*', '*://youtu.be/*', '*://www.youtube.com/shorts/*'],
      });
      browser.contextMenus.create({
        id: 'mt-video-page',
        title: 'Analyser cette vidéo (Videolytics)',
        contexts: ['page'],
        documentUrlPatterns: ['*://www.youtube.com/watch*', '*://www.youtube.com/shorts/*'],
      });
      browser.contextMenus.create({
        id: 'mt-channel-page',
        title: 'Analyser cette chaîne (Channelytics)',
        contexts: ['page'],
        documentUrlPatterns: ['*://www.youtube.com/@*', '*://www.youtube.com/channel/*', '*://www.youtube.com/c/*', '*://www.youtube.com/user/*'],
      });
    });
  }

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'mt-kw' && info.selectionText) openApp('keywords?q=' + encodeURIComponent(info.selectionText.trim().slice(0, 100)));
    else if (info.menuItemId === 'mt-video-link') openApp('videolytics?v=' + encodeURIComponent(MT.videoIdFromUrl(info.linkUrl) || ''));
    else if (info.menuItemId === 'mt-video-page') openApp('videolytics?v=' + encodeURIComponent(MT.videoIdFromUrl(info.pageUrl) || ''));
    else if (info.menuItemId === 'mt-channel-page') openApp('channelytics?c=' + encodeURIComponent(info.pageUrl));
  });

  /* ------------------------------------------------------------ commandes */

  browser.commands.onCommand.addListener((command) => {
    if (command === 'open-dashboard') openApp('');
    if (command === 'open-keywords') openApp('keywords');
  });

  /* ------------------------------------------ en-tête Origin pour Innertube */

  async function setupHeaderRules() {
    if (!browser.declarativeNetRequest) return;
    try {
      await browser.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [1],
        addRules: [
          {
            id: 1,
            priority: 1,
            action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Origin', operation: 'set', value: 'https://www.youtube.com' }] },
            condition: { urlFilter: '|https://www.youtube.com/youtubei/', excludedInitiatorDomains: ['youtube.com'], resourceTypes: ['xmlhttprequest'] },
          },
        ],
      });
    } catch (e) {
      /* règle facultative */
    }
  }

  /* ---------------------------------------------------------- démarrage */

  browser.runtime.onInstalled.addListener(async (details) => {
    createMenus();
    await MT.jobs.ensureAlarms();
    if (details.reason === 'install') openApp('welcome');
  });

  browser.runtime.onStartup.addListener(() => {
    MT.jobs.ensureAlarms();
  });

  setupHeaderRules();
  MT.jobs.ensureAlarms();
})();
