/* MyTube SEO — fenêtre de l'icône : contexte de l'onglet, recherche rapide, outils, liens Studio. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el } = MT;
  const W = MT.widgets;

  function open(route) {
    browser.tabs.create({ url: MT.appUrl(route) });
    window.close();
  }

  const TOOLS = [
    ['keywords', 'Mots-clés', 'search'],
    ['seo-studio', 'SEO Studio', 'edit'],
    ['rank', 'Classements', 'trophy'],
    ['competitors', 'Concurrents', 'users'],
    ['thumbnails', 'Miniatures', 'image'],
    ['planner', 'Planificateur', 'calendar'],
    ['comments', 'Commentaires', 'comment'],
    ['bulk', 'En masse', 'layers'],
    ['tags', 'Tags', 'tag'],
    ['audit', 'Audit', 'shield'],
    ['abtests', 'Tests A/B', 'flask'],
    ['settings', 'Paramètres', 'settings'],
  ];

  async function contextCard() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tab && tab.url ? new URL(tab.url) : null;
    if (!url || !/(^|\.)youtube\.com$/.test(url.hostname)) return null;
    const videoId = MT.videoIdFromUrl(url.href);
    const btn = (label, icon, fn) => W.button(label, fn, { size: 'sm', icon, busy: false });
    if (videoId && (url.pathname === '/watch' || url.pathname.startsWith('/shorts/') || url.hostname.startsWith('studio.'))) {
      return el(
        'div',
        { class: 'p-context' },
        el('div', { class: 'title', title: tab.title }, '🎬 ', (tab.title || '').replace(/ - YouTube( Studio)?$/, '')),
        el(
          'div',
          { class: 'mt-row' },
          btn('Videolytics', 'chart', () => open('videolytics?v=' + videoId)),
          btn('Commentaires', 'comment', () => open('comments?v=' + videoId)),
          W.button(
            'Copier les tags',
            async () => {
              const tags = await MT.yt.getVideoTags(videoId);
              const ok = tags.length && (await MT.copy(tags.join(', ')));
              W.toast(tags.length ? (ok ? `${tags.length} tags copiés` : 'Copie impossible') : 'Aucun tag', ok ? 'success' : 'error');
            },
            { size: 'sm', icon: 'copy' }
          ),
          btn('Démonétisation', 'money', () => open('demonetization?v=' + videoId))
        )
      );
    }
    const q = url.searchParams.get('search_query');
    if (url.pathname === '/results' && q) {
      return el(
        'div',
        { class: 'p-context' },
        el('div', { class: 'title' }, '🔎 « ', q, ' »'),
        el(
          'div',
          { class: 'mt-row' },
          btn('Explorer ce mot-clé', 'search', () => open('keywords?q=' + encodeURIComponent(q))),
          btn('SEO Studio', 'edit', () => open('seo-studio?k=' + encodeURIComponent(q)))
        )
      );
    }
    if (/^\/(@|channel\/|c\/|user\/)/.test(url.pathname)) {
      const ref =
        url.origin +
        url.pathname
          .split('/')
          .slice(0, url.pathname.startsWith('/@') ? 2 : 3)
          .join('/');
      return el(
        'div',
        { class: 'p-context' },
        el('div', { class: 'title' }, '📺 ', (tab.title || '').replace(/ - YouTube$/, '')),
        el(
          'div',
          { class: 'mt-row' },
          btn('Channelytics', 'users', () => open('channelytics?c=' + encodeURIComponent(ref))),
          btn('Audit', 'shield', () => open('audit?c=' + encodeURIComponent(ref))),
          btn('Meilleur moment', 'clock', () => open('besttime?c=' + encodeURIComponent(ref))),
          W.button(
            'Concurrent',
            async () => {
              await MT.research.addCompetitor(ref);
              W.toast('Ajoutée aux concurrents', 'success');
            },
            { size: 'sm', icon: 'plus' }
          )
        )
      );
    }
    return null;
  }

  async function render() {
    const s = await MT.store.getSettings();
    const dark = s.theme === 'dark' || (s.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
    const root = document.getElementById('popup');
    const input = el('input', { class: 'mt-input', type: 'search', placeholder: 'Mot-clé, URL de vidéo ou @chaîne…', autofocus: true });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !input.value.trim()) return;
      const v = input.value.trim();
      const vid = /youtu\.?be|watch\?|shorts\//.test(v) ? MT.videoIdFromUrl(v) : null;
      if (vid) open('videolytics?v=' + vid);
      else if (/^@|\/channel\/|youtube\.com\/(@|c\/|user\/)/.test(v)) open('channelytics?c=' + encodeURIComponent(v));
      else open('keywords?q=' + encodeURIComponent(v));
    });
    const studioBase = s.myChannelId ? `https://studio.youtube.com/channel/${s.myChannelId}` : 'https://studio.youtube.com';
    const alerts = await MT.store.list('alerts');
    const unread = alerts.reduce((n, a) => n + (a.unread || 0), 0);
    MT.fill(
      root,
      input,
      await contextCard(),
      unread
        ? el(
            'a',
            {
              href: '#',
              class: 'mt-alert warn',
              onclick: (e) => {
                e.preventDefault();
                open('alerts');
              },
            },
            `🔔 ${unread} nouvelle(s) vidéo(s) détectée(s) par vos alertes`
          )
        : null,
      el(
        'div',
        null,
        el('div', { class: 'p-section-title' }, 'Outils'),
        el(
          'div',
          { class: 'p-grid' },
          TOOLS.map(([route, label, icon]) =>
            el(
              'a',
              {
                class: 'p-tool',
                href: '#',
                onclick: (e) => {
                  e.preventDefault();
                  open(route);
                },
              },
              W.icon(icon, 18),
              label
            )
          )
        )
      ),
      el(
        'div',
        null,
        el('div', { class: 'p-section-title' }, 'YouTube Studio'),
        el(
          'div',
          { class: 'mt-row' },
          [
            ['Tableau de bord', studioBase],
            ['Contenu', studioBase + '/videos'],
            ['Statistiques', studioBase + '/analytics'],
            ['Commentaires', studioBase + '/comments'],
            ['Mettre en ligne', 'https://www.youtube.com/upload'],
          ].map(([label, href]) => el('a', { class: 'mt-btn sm', href, target: '_blank', rel: 'noopener' }, label))
        )
      )
    );
    input.focus();
  }

  document.getElementById('open-dashboard').addEventListener('click', (e) => {
    e.preventDefault();
    open('');
  });
  W.injectCSS(document.head);
  render();
})();
