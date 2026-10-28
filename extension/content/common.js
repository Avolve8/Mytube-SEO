/*
 * MyTube SEO — socle des scripts de contenu : routeur de navigation (YouTube est une SPA),
 * création de panneaux isolés (Shadow DOM), accès aux données de la page, appels à l'arrière-plan.
 */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el } = MT;
  const W = MT.widgets;

  /* ---------------------------------------------------------- réglages */

  let settings = null;
  async function getSettings() {
    if (!settings) settings = await MT.store.getSettings();
    return settings;
  }
  MT.store.onChange('settings', (k, v) => {
    settings = v ? { ...MT.store.DEFAULT_SETTINGS, ...v, panels: { ...MT.store.DEFAULT_SETTINGS.panels, ...(v.panels || {}) } } : null;
  });

  /* ---------------------------------------------------------- utilitaires */

  function isDark() {
    const html = document.documentElement;
    if (html.hasAttribute('dark')) return true;
    if (location.hostname.startsWith('studio.')) return html.hasAttribute('dark') || document.body.classList.contains('dark-theme');
    return false;
  }

  /** Attend qu'un élément (sélecteur ou fonction) existe. */
  function waitFor(selectorOrFn, timeout = 12000) {
    const find = typeof selectorOrFn === 'function' ? selectorOrFn : () => document.querySelector(selectorOrFn);
    return new Promise((resolve) => {
      const found = find();
      if (found) return resolve(found);
      const obs = new MutationObserver(() => {
        const f = find();
        if (f) {
          obs.disconnect();
          clearTimeout(timer);
          resolve(f);
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        obs.disconnect();
        resolve(find() || null);
      }, timeout);
    });
  }

  function visible(elm) {
    return !!(elm && elm.isConnected && (elm.offsetWidth || elm.offsetHeight || elm.getClientRects().length));
  }

  /** Appel d'une fonction de données YouTube exécutée en arrière-plan. */
  function yt(fn, ...args) {
    return MT.send('yt', { fn, args });
  }

  /** Réponse du lecteur de la page (tags, description…) sans requête réseau. */
  function playerResponse(videoId) {
    try {
      const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      const page = player && player.wrappedJSObject;
      const resp = page && typeof page.getPlayerResponse === 'function' ? page.getPlayerResponse() : null;
      if (!resp) return null;
      const json = JSON.parse(JSON.stringify(resp));
      if (!json.videoDetails || (videoId && json.videoDetails.videoId !== videoId)) return null;
      return json;
    } catch (e) {
      return null;
    }
  }

  function reportClientVersion() {
    try {
      const ytcfg = window.wrappedJSObject && window.wrappedJSObject.ytcfg;
      const v = ytcfg && ytcfg.data_ ? ytcfg.data_.INNERTUBE_CLIENT_VERSION : ytcfg && typeof ytcfg.get === 'function' ? ytcfg.get('INNERTUBE_CLIENT_VERSION') : null;
      if (v) MT.send('clientVersion', { version: String(v) }).catch(() => {});
    } catch (e) {
      /* facultatif */
    }
  }

  /* ------------------------------------------------------------ panneaux */

  const panelState = {};
  MT.store.get('panelState', {}).then((s) => Object.assign(panelState, s || {}));

  /**
   * Crée un panneau isolé dans un Shadow DOM.
   * Renvoie {host, root, body, panel, head, setSub(text), destroy()}.
   */
  function createPanel({ id, title, sub = '', floating = false, position = '' }) {
    const host = el('mytube-seo-panel', { 'data-mt': id, style: floating ? '' : 'display:block;margin-bottom:12px' });
    const shadow = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = W.CSS + MT.contentCSS;
    const rootEl = el('div', { class: ['mt-root', floating ? 'mt-floating' : null, position], 'data-theme': isDark() ? 'dark' : 'light' });
    const subEl = el('span', { class: 'mt-panel-sub mt-ellipsis' }, sub);
    const body = el('div', { class: 'mt-panel-body' });
    const collapseBtn = W.button('', null, { variant: 'ghost', size: 'sm', icon: 'sort', title: 'Réduire / déplier', busy: false });
    const head = el(
      'div',
      { class: 'mt-panel-head' },
      el('span', { class: 'mt-logo' }, W.icon('play', 12)),
      el('span', { class: 'mt-panel-title' }, title),
      subEl,
      el(
        'span',
        { class: 'mt-panel-actions' },
        W.button(
          '',
          (e) => {
            e.stopPropagation();
            MT.openApp('');
          },
          { variant: 'ghost', size: 'sm', icon: 'home', title: 'Ouvrir le tableau de bord MyTube SEO', busy: false }
        ),
        collapseBtn
      )
    );
    const panel = el('div', { class: ['mt-panel', panelState[id] ? 'collapsed' : null] }, head, body);
    head.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.mt-panel-actions') && !collapseBtn.contains(e.target)) return;
      panel.classList.toggle('collapsed');
      panelState[id] = panel.classList.contains('collapsed');
      MT.store.set('panelState', panelState);
    });
    rootEl.appendChild(panel);
    shadow.append(style, rootEl);
    // Empêche les raccourcis clavier de YouTube de se déclencher pendant la saisie dans le panneau
    for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());
    const themeObs = new MutationObserver(() => rootEl.setAttribute('data-theme', isDark() ? 'dark' : 'light'));
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });
    return {
      host,
      root: rootEl,
      shadow,
      body,
      panel,
      head,
      setSub(text) {
        subEl.textContent = text || '';
      },
      expand() {
        panel.classList.remove('collapsed');
      },
      destroy() {
        themeObs.disconnect();
        host.remove();
      },
    };
  }

  /** Couche pour toasts/modales dans un Shadow DOM partagé (styles isolés). */
  function ensureOverlay() {
    if (W.overlayRoot && W.overlayRoot.isConnected) {
      W.overlayRoot.setAttribute('data-theme', isDark() ? 'dark' : 'light');
      return W.overlayRoot;
    }
    const host = el('mytube-seo-overlay', { style: 'position:fixed;inset:auto;z-index:2147483647' });
    const shadow = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = W.CSS + MT.contentCSS;
    const rootEl = el('div', { class: 'mt-root', 'data-theme': isDark() ? 'dark' : 'light' });
    shadow.append(style, rootEl);
    for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());
    document.documentElement.appendChild(host);
    W.overlayRoot = rootEl;
    return rootEl;
  }

  /**
   * Insère un panneau dans la page : candidates = [{selector, where: 'prepend'|'append'|'before'|'after'}].
   * Sinon panneau flottant.
   */
  async function mountPanel(panel, candidates, { timeout = 8000 } = {}) {
    const found = await waitFor(() => {
      for (const c of candidates) {
        const node = typeof c.selector === 'function' ? c.selector() : document.querySelector(c.selector);
        if (node && visible(node)) return { node, where: c.where };
      }
      return null;
    }, timeout);
    if (!found) {
      panel.root.classList.add('mt-floating');
      document.documentElement.appendChild(panel.host);
      return 'floating';
    }
    const { node, where } = found;
    if (where === 'before') node.parentNode.insertBefore(panel.host, node);
    else if (where === 'after') node.parentNode.insertBefore(panel.host, node.nextSibling);
    else if (where === 'append') node.appendChild(panel.host);
    else node.insertBefore(panel.host, node.firstChild);
    return 'inline';
  }

  /** Bouton « section » repliable dans un panneau. */
  function section(title, ...children) {
    return el('div', { class: 'mt-section' }, el('div', { class: 'mt-section-title' }, title), ...children);
  }

  /* ------------------------------------------------------------ routeur */

  const modules = [];
  let lastKey = null;
  let cleanups = [];
  let generation = 0;

  function register(mod) {
    modules.push(mod);
  }

  async function route() {
    const key = location.pathname + location.search;
    if (key === lastKey) return;
    lastKey = key;
    for (const fn of cleanups) {
      try {
        fn();
      } catch (e) {
        /* ignore */
      }
    }
    cleanups = [];
    const gen = ++generation;
    const s = await getSettings();
    for (const m of modules) {
      try {
        if (m.enabled && !m.enabled(s)) continue;
        if (!m.match(location)) continue;
        const cleanup = await m.start(location, s);
        if (typeof cleanup === 'function') {
          // navigation survenue pendant le démarrage : on retire aussitôt le panneau devenu obsolète
          if (gen !== generation) cleanup();
          else cleanups.push(cleanup);
        }
      } catch (e) {
        console.warn('[MyTube SEO]', m.name, e);
      }
    }
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    const rerun = MT.debounce(route, 250);
    document.addEventListener('yt-navigate-finish', rerun);
    window.addEventListener('yt-navigate-finish', rerun);
    window.addEventListener('popstate', rerun);
    // Studio et cas limites : surveillance légère de l'URL
    let href = location.href;
    setInterval(() => {
      if (location.href !== href) {
        href = location.href;
        rerun();
      }
    }, 800);
    route();
    reportClientVersion();
    for (const m of modules) if (m.init) m.init();
  }

  /** Force un nouveau rendu (ex. changement de réglages). */
  function refresh() {
    lastKey = null;
    route();
  }

  MT.store.onChange('settings', MT.debounce(refresh, 300));

  W.getOverlay = ensureOverlay;

  MT.page = { getSettings, isDark, waitFor, visible, yt, playerResponse, createPanel, ensureOverlay, mountPanel, section, register, start, refresh };
})();
