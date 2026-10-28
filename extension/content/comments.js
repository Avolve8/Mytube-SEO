/*
 * MyTube SEO — barre d'outils des zones de commentaire (YouTube et Studio) :
 * réponses types (avec variables), sélecteur d'émojis, suggestions de réponses par IA.
 */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el } = MT;
  const W = MT.widgets;
  const P = MT.page;

  let enabled = true;
  let toolbar = null;
  let target = null;
  let hideTimer = null;

  function isCommentBox(node) {
    if (!node || !(node.isContentEditable || node.tagName === 'TEXTAREA')) return false;
    for (let n = node; n && n !== document.body; n = n.parentElement || (n.getRootNode && n.getRootNode().host)) {
      const tag = (n.tagName || '').toLowerCase();
      if (tag.includes('comment') || (n.id && /comment|reply/i.test(n.id))) return true;
    }
    return false;
  }

  function parentCommentInfo(node) {
    const thread = node.closest('ytd-comment-thread-renderer, ytd-comment-view-model, ytd-comment-renderer, ytcp-comment-thread, ytcp-comment');
    if (!thread) return {};
    const authorEl = thread.querySelector('#author-text, #name, .author-name, a[href*="/@"]');
    const textEl = thread.querySelector('#content-text, #content, .comment-text');
    return { author: authorEl ? authorEl.textContent.trim() : '', text: textEl ? textEl.textContent.trim().slice(0, 1000) : '' };
  }

  function fillVars(text, info, settings) {
    return MT.seo.fillTemplate(text, {
      auteur: info.author || '',
      author: info.author || '',
      chaine: settings.myChannelTitle || '',
      date: new Date().toLocaleDateString('fr-FR'),
    });
  }

  function insertText(text) {
    if (!target || !target.isConnected) return;
    target.focus();
    if (target.tagName === 'TEXTAREA') {
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      target.setRangeText(text, start, end, 'end');
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
      target.textContent += text;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function closeDropdowns() {
    if (toolbar) toolbar.root.querySelectorAll('.mt-dropdown').forEach((d) => d.remove());
  }

  async function openCanned(anchor) {
    closeDropdowns();
    const [list, settings] = await Promise.all([MT.store.list('canned'), P.getSettings()]);
    const info = parentCommentInfo(target);
    const search = el('input', { class: 'mt-input', placeholder: 'Rechercher une réponse…', style: 'margin-bottom:6px' });
    const items = el('div');
    const draw = () => {
      const q = MT.text.normalize(search.value);
      const filtered = list.filter((r) => !q || MT.text.normalize(r.name + ' ' + r.text).includes(q));
      MT.fill(
        items,
        filtered.length
          ? filtered.map((r) =>
              el(
                'div',
                {
                  class: 'mt-dropdown-item',
                  onmousedown: (e) => e.preventDefault(),
                  onclick: () => {
                    insertText(fillVars(r.text, info, settings));
                    closeDropdowns();
                  },
                },
                el('strong', null, r.name),
                el('span', { class: 'mt-small mt-muted' }, r.text)
              )
            )
          : W.empty('Aucune réponse type. Créez-en dans le tableau de bord.'),
        el('div', { class: 'mt-dropdown-item mt-small', onclick: () => MT.openApp('canned') }, '⚙️ Gérer les réponses types')
      );
    };
    search.addEventListener('input', draw);
    draw();
    const dd = el('div', { class: 'mt-dropdown', style: 'bottom:44px;left:0' }, search, items);
    anchor.appendChild(dd);
    search.focus();
  }

  function openEmojis(anchor) {
    closeDropdowns();
    anchor.appendChild(
      el(
        'div',
        { class: 'mt-dropdown', style: 'bottom:44px;left:0;width:340px', onmousedown: (e) => e.preventDefault() },
        W.emojiPicker((e) => insertText(e))
      )
    );
  }

  async function openAi(anchor) {
    closeDropdowns();
    const info = parentCommentInfo(target);
    const dd = el('div', { class: 'mt-dropdown', style: 'bottom:44px;left:0' }, W.spinner('Rédaction de suggestions…'));
    anchor.appendChild(dd);
    if (!info.text) {
      MT.fill(dd, W.alert('Ouvrez la réponse sous un commentaire pour obtenir des suggestions.', 'warn'));
      return;
    }
    try {
      const title = (document.querySelector('h1.ytd-watch-metadata, #video-title') || {}).textContent || '';
      const replies = await MT.send('ai', { fn: 'replies', args: [{ comment: info.text, videoTitle: title.trim() }] });
      MT.fill(
        dd,
        replies.map((r) =>
          el(
            'div',
            {
              class: 'mt-dropdown-item',
              onmousedown: (e) => e.preventDefault(),
              onclick: () => {
                insertText(r);
                closeDropdowns();
              },
            },
            r
          )
        )
      );
    } catch (e) {
      MT.fill(dd, W.alert(e.message, 'error'));
    }
  }

  async function ensureToolbar() {
    if (toolbar && toolbar.host.isConnected) return toolbar;
    const host = el('mytube-seo-toolbar', { style: 'position:fixed;z-index:2147483000;display:none' });
    const shadow = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = W.CSS + MT.contentCSS;
    const anchor = el('div', { style: 'position:relative' });
    const rootEl = el('div', { class: 'mt-root', 'data-theme': P.isDark() ? 'dark' : 'light' }, anchor);
    const hasAi = await MT.store.getSettings().then((s) => !!(s.claudeApiKey || '').trim());
    const bar = el(
      'div',
      {
        class: 'mt-toolbar',
        onmousedown: (e) => {
          if (!e.target.closest('input')) e.preventDefault();
        },
      },
      el('span', { class: 'mt-logo', title: 'MyTube SEO' }, W.icon('play', 12)),
      W.button('Réponses types', () => openCanned(anchor), { size: 'sm', variant: 'ghost', icon: 'comment', busy: false }),
      W.button('', () => openEmojis(anchor), { size: 'sm', variant: 'ghost', icon: 'emoji', title: 'Émojis', busy: false }),
      hasAi ? W.button('IA', () => openAi(anchor), { size: 'sm', variant: 'ghost', icon: 'bolt', title: 'Suggestions de réponse par IA', busy: false }) : null,
      W.button('', () => hide(true), { size: 'sm', variant: 'ghost', icon: 'x', title: 'Masquer', busy: false })
    );
    anchor.appendChild(bar);
    shadow.append(style, rootEl);
    for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());
    host.addEventListener('focusin', () => clearTimeout(hideTimer));
    host.addEventListener('focusout', () => scheduleHide());
    document.documentElement.appendChild(host);
    toolbar = { host, root: rootEl, anchor };
    return toolbar;
  }

  function position() {
    if (!toolbar || !target || !target.isConnected) return;
    const r = target.getBoundingClientRect();
    if (!r.width && !r.height) return hide(true);
    const top = Math.min(window.innerHeight - 48, r.bottom + 6);
    toolbar.host.style.top = top + 'px';
    toolbar.host.style.left = Math.max(8, r.left) + 'px';
  }

  async function show(node) {
    target = node;
    const t = await ensureToolbar();
    t.root.setAttribute('data-theme', P.isDark() ? 'dark' : 'light');
    t.host.style.display = 'block';
    position();
  }

  function hide(force) {
    if (!toolbar) return;
    if (force) {
      toolbar.host.style.display = 'none';
      closeDropdowns();
      return;
    }
    toolbar.host.style.display = 'none';
    closeDropdowns();
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      const active = document.activeElement;
      if (toolbar && (active === toolbar.host || (target && active === target))) return;
      hide();
    }, 250);
  }

  async function init() {
    const s = await P.getSettings();
    enabled = s.panels.comments;
    MT.store.onChange('settings', (k, v) => {
      enabled = !v || !v.panels || v.panels.comments !== false;
      if (!enabled) hide(true);
    });
    document.addEventListener(
      'focusin',
      (e) => {
        if (!enabled) return;
        const node = e.composedPath ? e.composedPath()[0] : e.target;
        if (isCommentBox(node)) {
          clearTimeout(hideTimer);
          show(node);
        }
      },
      true
    );
    document.addEventListener(
      'focusout',
      (e) => {
        if (target && (e.target === target || (e.composedPath && e.composedPath()[0] === target))) scheduleHide();
      },
      true
    );
    window.addEventListener('scroll', MT.debounce(position, 30), true);
    window.addEventListener('resize', MT.debounce(position, 50));
  }

  P.register({ name: 'comments', init, match: () => false, start: () => null });
})();
