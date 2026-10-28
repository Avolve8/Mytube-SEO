/*
 * MyTube SEO — coquille du tableau de bord : routeur (hash), navigation, thème,
 * et aides de mise en page partagées par toutes les vues.
 */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;

  const views = new Map();
  const GROUPS = [
    ['home', 'Accueil'],
    ['research', 'Recherche & SEO'],
    ['analysis', 'Analyse'],
    ['create', 'Création'],
    ['community', 'Communauté'],
    ['manage', 'Gestion de chaîne (Google)'],
    ['system', 'Extension'],
  ];

  function register(id, def) {
    views.set(id, { id, order: 100, ...def });
  }

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const i = h.indexOf('?');
    const path = i >= 0 ? h.slice(0, i) : h;
    const query = i >= 0 ? h.slice(i + 1) : '';
    return { route: path || 'home', params: Object.fromEntries(new URLSearchParams(query)) };
  }

  function navigate(route, params) {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString() : '';
    location.hash = '#/' + route + (qs ? '?' + qs : '');
  }

  /** Met à jour les paramètres de l'URL sans recharger la vue. */
  function setParams(params) {
    const { route } = parseHash();
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
    history.replaceState(null, '', '#/' + route + (qs ? '?' + qs : ''));
  }

  /* ---------------------------------------------------------- navigation */

  let badges = {};
  function renderNav(active) {
    const nav = document.getElementById('nav');
    MT.clear(nav);
    for (const [gid, gtitle] of GROUPS) {
      const items = [...views.values()].filter((v) => v.group === gid && !v.hidden).sort((a, b) => a.order - b.order);
      if (!items.length) continue;
      nav.appendChild(
        el(
          'div',
          { class: 'nav-group' },
          el('div', { class: 'nav-group-title' }, gtitle),
          items.map((v) =>
            el(
              'a',
              { class: ['nav-link', v.id === active ? 'active' : null], href: '#/' + v.id, title: v.description || v.title },
              W.icon(v.icon || 'info', 17),
              el('span', null, v.title),
              badges[v.id]
                ? el('span', { class: 'nav-badge' }, String(badges[v.id]))
                : v.oauth
                  ? el('span', { class: 'nav-lock', title: 'Nécessite la connexion Google' }, '🔑')
                  : null
            )
          )
        )
      );
    }
  }

  async function refreshBadges() {
    const alerts = await MT.store.list('alerts');
    const unread = alerts.reduce((s, a) => s + (a.unread || 0), 0);
    badges = { alerts: unread || 0 };
    renderNav(parseHash().route);
  }

  /* ---------------------------------------------------------------- rendu */

  let cleanup = null;
  let renderSeq = 0;
  async function render() {
    const { route, params } = parseHash();
    const view = views.get(route) || views.get('home');
    const seq = ++renderSeq;
    if (cleanup) {
      try {
        cleanup();
      } catch (e) {
        /* ignore */
      }
    }
    cleanup = null;
    const container = document.getElementById('view');
    MT.clear(container);
    renderNav(view.id);
    document.title = `${view.title} — MyTube SEO`;
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
    try {
      const r = await view.render(container, params);
      if (typeof r === 'function') {
        if (seq === renderSeq) cleanup = r;
        else r();
      }
    } catch (e) {
      console.error(e);
      container.appendChild(W.alert('Erreur : ' + (e.message || e), 'error'));
    }
  }

  /* ---------------------------------------------------------- thème */

  async function applyTheme() {
    const s = await MT.store.getSettings();
    const dark = s.theme === 'dark' || (s.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  async function renderTopbarRight() {
    const box = document.getElementById('topbar-right');
    const s = await MT.store.getSettings();
    const cache = await MT.store.get('myChannelCache', null);
    MT.fill(
      box,
      s.myChannelId
        ? el(
            'a',
            { class: 'mt-row', href: '#/channelytics?c=' + encodeURIComponent(s.myChannelId), title: 'Ma chaîne', style: 'gap:8px;color:var(--mt-fg)' },
            cache && cache.avatar ? el('img', { src: cache.avatar, width: 28, height: 28, style: 'border-radius:50%' }) : W.icon('user', 22),
            el('span', { class: 'mt-ellipsis', style: 'max-width:160px;font-weight:600' }, s.myChannelTitle || (cache && cache.title) || 'Ma chaîne')
          )
        : W.button('Définir ma chaîne', () => navigate('settings'), { size: 'sm', icon: 'user', busy: false }),
      W.button(
        '',
        async () => {
          const dark = document.body.getAttribute('data-theme') === 'dark';
          await MT.store.setSettings({ theme: dark ? 'light' : 'dark' });
        },
        { variant: 'ghost', icon: 'emoji', title: 'Basculer thème clair / sombre', busy: false }
      )
    );
  }

  /* --------------------------------------------------- aides de mise en page */

  function pageHead(title, description, icon, ...actions) {
    return el(
      'div',
      { class: 'page-head' },
      el('div', null, el('h1', null, icon ? W.icon(icon, 22) : null, title), description ? el('p', null, description) : null),
      el('div', { class: 'mt-row' }, actions)
    );
  }

  function card(title, ...children) {
    return el('section', { class: 'mt-card' }, title ? el('h3', null, title) : null, children);
  }

  function field(label, control, hint) {
    return el('div', { class: 'field' }, label ? el('label', null, label) : null, control, hint ? el('div', { class: 'hint' }, hint) : null);
  }

  function input(attrs = {}) {
    return el('input', { class: 'mt-input', type: 'text', ...attrs });
  }

  function textarea(attrs = {}) {
    const { value, ...rest } = attrs;
    const t = el('textarea', { class: 'mt-textarea', ...rest });
    if (value != null) t.value = value;
    return t;
  }

  function select(options, value, attrs = {}) {
    const s = el(
      'select',
      { class: 'mt-select', ...attrs },
      options.map(([v, label]) => el('option', { value: v }, label))
    );
    if (value != null) s.value = value;
    return s;
  }

  function checkbox(label, checked, onChange) {
    const cb = el('input', { type: 'checkbox', checked: !!checked });
    if (onChange) cb.addEventListener('change', () => onChange(cb.checked));
    return el('label', { class: 'mt-row', style: 'gap:6px;cursor:pointer' }, cb, el('span', null, label));
  }

  /** Compteur de caractères/mots lié à un champ. */
  function counter(control, max, count = (v) => [...v].length) {
    const c = el('div', { class: 'counter' });
    const update = () => {
      const n = count(control.value);
      c.textContent = max ? `${n}/${max}` : String(n);
      c.classList.toggle('over', !!max && n > max);
    };
    control.addEventListener('input', update);
    update();
    c.update = update;
    return c;
  }

  function grid(cols, ...children) {
    return el('div', { class: ['grid', typeof cols === 'number' ? 'cols-' + cols : cols] }, children);
  }

  /** Exécute une tâche en affichant un indicateur puis le résultat ou l'erreur. */
  async function withLoading(container, text, fn) {
    MT.fill(container, W.spinner(text));
    try {
      const res = await fn();
      return res;
    } catch (e) {
      console.error(e);
      MT.fill(container, W.alert(e.message || String(e), 'error'));
      return undefined;
    }
  }

  function videoCell(v, { channel = true } = {}) {
    return el(
      'div',
      { class: 'result-video' },
      W.thumb(v.videoId, 'sm'),
      el(
        'div',
        { class: 'meta' },
        el('a', { href: `https://www.youtube.com/watch?v=${v.videoId}`, target: '_blank', rel: 'noopener', title: v.title }, v.title || v.videoId),
        channel && v.channelName ? el('div', { class: 'mt-small mt-muted mt-ellipsis' }, v.channelName, v.verified ? ' ✓' : '') : null
      )
    );
  }

  /* ---------------------------------------------------------- Google */

  /** Affiche une invite de connexion si nécessaire ; renvoie true si connecté. */
  async function oauthGate(container, purpose) {
    const st = await MT.oauth.status();
    if (st.connected) return true;
    const s = await MT.store.getSettings();
    container.appendChild(
      card(
        'Connexion Google requise',
        el('p', null, purpose || 'Cette fonction modifie ou lit des données privées de votre chaîne via l’API officielle YouTube.'),
        s.oauthClientId
          ? W.button(
              'Se connecter avec Google',
              async () => {
                await MT.oauth.login({ interactive: true });
                render();
              },
              { variant: 'primary', icon: 'user' }
            )
          : el(
              'div',
              { class: 'mt-col' },
              W.alert('Configurez d’abord votre identifiant client OAuth Google dans les paramètres (guide pas à pas inclus).', 'warn'),
              el(
                'div',
                null,
                W.button('Ouvrir les paramètres', () => navigate('settings', { section: 'google' }), { busy: false })
              )
            )
      )
    );
    return false;
  }

  function auth() {
    return MT.oauth.auth({ interactive: true });
  }

  /** Authentification « lecture » : clé API si disponible, sinon OAuth. */
  async function readAuth() {
    const s = await MT.store.getSettings();
    const st = await MT.oauth.status();
    if (st.connected) return MT.oauth.auth({ interactive: true });
    if (s.apiKey) return { apiKey: s.apiKey };
    throw new Error('Cette fonction nécessite une clé API YouTube ou la connexion Google (Paramètres).');
  }

  let myVideosCache = null;
  /** Vidéos de ma chaîne via l'API (y compris privées). */
  async function loadMyVideos({ force = false, onProgress } = {}) {
    if (!force && myVideosCache && Date.now() - myVideosCache.t < 10 * 60 * 1000) return myVideosCache.list;
    const a = await auth();
    const list = await MT.ytapi.myVideos(a, { limit: 1000, onProgress });
    myVideosCache = { t: Date.now(), list };
    return list;
  }

  function invalidateMyVideos() {
    myVideosCache = null;
  }

  const PRIVACY = { public: 'Publique', unlisted: 'Non répertoriée', private: 'Privée' };

  /**
   * Sélecteur de vidéos (tableau avec cases à cocher et filtre).
   * Renvoie un élément avec .getSelected() → tableau de vidéos.
   */
  function videoSelector(videos, { multi = true, onChange, initial = [] } = {}) {
    const selected = new Set(initial);
    const filterInput = input({ placeholder: 'Filtrer par titre, tag ou description…', type: 'search' });
    const privacySel = select(
      [
        ['', 'Toutes'],
        ['public', 'Publiques'],
        ['unlisted', 'Non répertoriées'],
        ['private', 'Privées'],
      ],
      ''
    );
    const count = el('span', { class: 'mt-muted' });
    const tableBox = el('div');
    const filtered = () => {
      const q = MT.text.normalize(filterInput.value);
      return videos.filter(
        (v) => (!privacySel.value || v.privacyStatus === privacySel.value) && (!q || MT.text.normalize(v.title + ' ' + v.tags.join(' ') + ' ' + v.description).includes(q))
      );
    };
    const changed = () => {
      count.textContent = `${selected.size} sélectionnée(s) / ${videos.length}`;
      if (onChange) onChange([...selected].map((id) => videos.find((v) => v.videoId === id)).filter(Boolean));
    };
    const draw = () => {
      const rows = filtered();
      MT.fill(
        tableBox,
        W.table(
          [
            {
              key: 'sel',
              label: multi
                ? el('input', {
                    type: 'checkbox',
                    title: 'Tout sélectionner (filtre actuel)',
                    checked: rows.length > 0 && rows.every((r) => selected.has(r.videoId)),
                    onclick: (e) => {
                      e.stopPropagation();
                      const all = rows.every((r) => selected.has(r.videoId));
                      for (const r of rows) all ? selected.delete(r.videoId) : selected.add(r.videoId);
                      draw();
                      changed();
                    },
                  })
                : '',
              sortable: false,
              width: '34px',
              render: (v) =>
                el('input', {
                  type: multi ? 'checkbox' : 'radio',
                  name: 'mt-video-pick',
                  checked: selected.has(v.videoId),
                  onchange: (e) => {
                    if (!multi) selected.clear();
                    if (e.target.checked) selected.add(v.videoId);
                    else selected.delete(v.videoId);
                    if (!multi) draw();
                    changed();
                  },
                }),
            },
            { key: 'title', label: 'Vidéo', render: (v) => videoCell(v, { channel: false }) },
            { key: 'privacyStatus', label: 'Visibilité', render: (v) => PRIVACY[v.privacyStatus] || v.privacyStatus || '—' },
            { key: 'publishedAt', label: 'Publiée', num: true, render: (v) => fmt.date(v.publishedAt) },
            { key: 'views', label: 'Vues', num: true, render: (v) => fmt.num(v.views) },
            { key: 'tagsCount', label: 'Tags', num: true, sort: (v) => v.tags.length, render: (v) => String(v.tags.length) },
          ],
          rows,
          { sortKey: 'publishedAt', maxHeight: '420px' }
        )
      );
    };
    filterInput.addEventListener('input', MT.debounce(draw, 200));
    privacySel.addEventListener('change', draw);
    draw();
    changed();
    const wrap = el(
      'div',
      { class: 'mt-col' },
      el('div', { class: 'mt-row', style: 'flex-wrap:nowrap' }, filterInput, el('div', { style: 'width:200px' }, privacySel), count),
      tableBox
    );
    wrap.getSelected = () => [...selected].map((id) => videos.find((v) => v.videoId === id)).filter(Boolean);
    return wrap;
  }

  /** Champ « vidéo » (URL ou identifiant) avec bouton d'action. */
  function videoInput({ value = '', label = 'Analyser', onSubmit, placeholder = 'URL ou identifiant de vidéo YouTube' } = {}) {
    const inp = input({ value, placeholder });
    const go = () => {
      const id = MT.videoIdFromUrl(inp.value);
      if (!id) return W.toast('URL ou identifiant de vidéo invalide', 'error');
      return onSubmit(id);
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
    return el('div', { class: 'search-hero' }, inp, W.button(label, go, { variant: 'primary', icon: 'search' }));
  }

  function channelInput({ value = '', label = 'Analyser', onSubmit, placeholder = 'URL de chaîne, @handle ou identifiant UC…' } = {}) {
    const inp = input({ value, placeholder });
    const go = () => {
      const v = inp.value.trim();
      if (!v) return W.toast('Saisissez une chaîne', 'error');
      return onSubmit(v);
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
    return el('div', { class: 'search-hero' }, inp, W.button(label, go, { variant: 'primary', icon: 'search' }));
  }

  function keywordInput({ value = '', label = 'Analyser', onSubmit, placeholder = 'Mot-clé ou expression (ex. recette crêpes faciles)' } = {}) {
    const inp = input({ value, placeholder });
    const go = () => {
      const v = inp.value.trim();
      if (!v) return W.toast('Saisissez un mot-clé', 'error');
      return onSubmit(v);
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
    const wrap = el('div', { class: 'search-hero' }, inp, W.button(label, go, { variant: 'primary', icon: 'search' }));
    wrap.input = inp;
    return wrap;
  }

  /* ----------------------------------------------------------- démarrage */

  function quickSearch(value) {
    const v = value.trim();
    if (!v) return;
    const vid = /youtu\.?be|watch\?|shorts\//.test(v) || /^[\w-]{11}$/.test(v) ? MT.videoIdFromUrl(v) : null;
    if (vid) return navigate('videolytics', { v: vid });
    if (/^@|\/channel\/|youtube\.com\/(@|c\/|user\/)|^UC[\w-]{22}$/.test(v)) return navigate('channelytics', { c: v });
    navigate('keywords', { q: v });
  }

  function start() {
    applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    MT.store.onChange('settings', () => {
      applyTheme();
      renderTopbarRight();
    });
    MT.store.onChange(['alerts'], refreshBadges);
    window.addEventListener('hashchange', render);
    document.getElementById('quick-search').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = document.getElementById('quick-input');
      quickSearch(inp.value);
      inp.value = '';
      inp.blur();
    });
    document.getElementById('menu-toggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    renderTopbarRight();
    refreshBadges();
    render();
  }

  MT.app = {
    views,
    register,
    parseHash,
    navigate,
    setParams,
    render,
    start,
    pageHead,
    card,
    field,
    input,
    textarea,
    select,
    checkbox,
    counter,
    grid,
    withLoading,
    videoCell,
    oauthGate,
    auth,
    readAuth,
    loadMyVideos,
    invalidateMyVideos,
    videoSelector,
    videoInput,
    channelInput,
    keywordInput,
    refreshBadges,
    PRIVACY,
  };
})();
