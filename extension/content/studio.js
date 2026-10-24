/*
 * MyTube SEO — assistant YouTube Studio (page de modification et fenêtre de mise en ligne) :
 * score SEO en direct, recherche de mot-clé, suggestions et insertion de tags, profils de mise en ligne,
 * checklist, émojis, génération IA. Le panneau s'insère dans la colonne de droite (aperçu vidéo).
 */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const P = MT.page;

  /* ---------------------------------------------------- accès aux champs */

  function dialog() {
    const d = document.querySelector('ytcp-uploads-dialog');
    return d && P.visible(d.querySelector('#title-textarea')) ? d : null;
  }

  function scope() {
    return dialog() || document;
  }

  function first(selectors) {
    const s = scope();
    for (const sel of selectors) {
      for (const n of s.querySelectorAll(sel)) if (P.visible(n)) return n;
    }
    return null;
  }

  function fields() {
    const titleEl = first(['#title-textarea #textbox', 'ytcp-social-suggestions-textbox#title-textarea #textbox']);
    const descEl = first(['#description-textarea #textbox', 'ytcp-social-suggestions-textbox#description-textarea #textbox']);
    const tagsContainer = first(['#tags-container', 'ytcp-form-input-container#tags-container']);
    const tagInput = tagsContainer ? tagsContainer.querySelector('input#text-input, input') : null;
    const tags = tagsContainer ? [...tagsContainer.querySelectorAll('ytcp-chip')].map((c) => (c.querySelector('#chip-text') || c).textContent.trim()).filter(Boolean) : [];
    return {
      titleEl,
      descEl,
      tagInput,
      tagsVisible: !!tagsContainer,
      title: titleEl ? titleEl.innerText.replace(/\n$/, '') : '',
      description: descEl ? descEl.innerText.replace(/\n$/, '') : '',
      tags,
    };
  }

  function currentVideoId() {
    const m = location.pathname.match(/\/video\/([\w-]{11})/);
    if (m) return m[1];
    const d = dialog();
    if (d) {
      const a = d.querySelector('a[href*="youtu.be/"], a[href*="/watch?v="], a[href*="/shorts/"]');
      if (a) return MT.videoIdFromUrl(a.href);
    }
    return null;
  }

  // Mémorise la position du curseur dans le titre / la description pour insérer les émojis au bon endroit
  let lastField = null;
  let lastRange = null;
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const f = node && node.closest ? node.closest('#textbox') : null;
    if (f && f.closest('#title-textarea, #description-textarea')) {
      lastField = f;
      lastRange = sel.getRangeAt(0).cloneRange();
    }
  });

  function caretToEnd(elm) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(elm);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** Écrit dans un champ contenteditable de Studio (mode : replace | append | cursor). */
  function writeField(elm, text, mode = 'replace') {
    if (!elm) return false;
    elm.focus();
    if (mode === 'replace') document.execCommand('selectAll', false, null);
    else if (mode === 'cursor' && lastField === elm && lastRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(lastRange);
    } else caretToEnd(elm);
    return document.execCommand('insertText', false, text);
  }

  async function addTags(tags) {
    const f = fields();
    if (!f.tagInput) {
      await MT.copy(tags.join(', '));
      W.toast('Champ « Tags » introuvable (cliquez sur « Afficher plus »). Tags copiés dans le presse-papiers.', 'error', 5000);
      return 0;
    }
    const existing = new Set(f.tags.map(MT.text.normalize));
    const fresh = [...new Set(tags)].filter((t) => !existing.has(MT.text.normalize(t)));
    const allowed = MT.seo.fitTags([...f.tags, ...fresh]).slice(f.tags.length);
    f.tagInput.focus();
    for (const t of allowed) {
      document.execCommand('insertText', false, t + ',');
      await MT.sleep(40);
      if (f.tagInput.value.trim()) {
        f.tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        await MT.sleep(40);
      }
    }
    if (allowed.length < fresh.length) W.toast(`${fresh.length - allowed.length} tag(s) non ajouté(s) : limite de 500 caractères.`, 'error');
    return allowed.length;
  }

  /* ------------------------------------------------------------ panneau */

  let panel = null;
  let state = null;
  let timer = null;

  function newState(videoId) {
    return { videoId, keyword: '', analysis: null, competitorTags: null, sig: '', activeTab: 'seo' };
  }

  function placement() {
    const d = dialog();
    if (d) {
      const info = [...d.querySelectorAll('ytcp-video-info')].find(P.visible);
      if (info) return { node: info, where: 'after' };
    }
    const side = [...document.querySelectorAll('ytcp-video-metadata-editor-sidepanel, #side-panel')].find(P.visible);
    if (side) return { node: side, where: 'append' };
    return null;
  }

  function mount() {
    const where = placement();
    if (!panel) {
      panel = P.createPanel({ id: 'studio', title: 'MyTube SEO', sub: 'Assistant Studio' });
      buildPanel();
    }
    if (where) {
      const parent = where.where === 'after' ? where.node.parentNode : where.node;
      if (panel.host.parentNode !== parent) {
        panel.root.classList.remove('mt-floating', 'top');
        panel.host.style.cssText = 'display:block;margin:12px 0';
        if (where.where === 'after') where.node.parentNode.insertBefore(panel.host, where.node.nextSibling);
        else where.node.appendChild(panel.host);
      }
    } else if (!panel.host.isConnected || panel.host.parentNode !== document.documentElement) {
      panel.root.classList.add('mt-floating', 'top');
      panel.host.style.cssText = 'position:relative;z-index:2147483000';
      document.documentElement.appendChild(panel.host);
    }
  }

  function unmount() {
    if (panel) panel.destroy();
    panel = null;
    state = null;
  }

  /* zones mises à jour en direct */
  let headerBox;
  let tabBody;
  let tabsHead;

  function buildPanel() {
    headerBox = el('div');
    tabsHead = el('div', { class: 'mt-tabs' });
    tabBody = el('div');
    const tabs = [
      ['seo', 'SEO'],
      ['keyword', 'Mot-clé'],
      ['tags', 'Tags'],
      ['profiles', 'Profils'],
      ['checklist', 'Checklist'],
      ['ai', 'IA'],
    ];
    for (const [id, label] of tabs) {
      tabsHead.appendChild(
        el(
          'button',
          {
            class: 'mt-tab',
            type: 'button',
            dataset: { id },
            onclick: () => {
              state.activeTab = id;
              renderTab(true);
            },
          },
          label
        )
      );
    }
    const emojiBox = el(
      'div',
      { style: 'display:none;margin-top:6px' },
      W.emojiPicker((e) => {
        const target = lastField || fields().titleEl;
        if (!writeField(target, e, 'cursor')) W.toast('Cliquez d’abord dans le titre ou la description', 'error');
      })
    );
    MT.fill(
      panel.body,
      headerBox,
      el(
        'div',
        { class: 'mt-row', style: 'margin:6px 0 8px' },
        W.button(
          'Émojis',
          () => {
            emojiBox.style.display = emojiBox.style.display === 'none' ? '' : 'none';
          },
          { size: 'sm', icon: 'emoji', busy: false }
        ),
        W.button('Tableau de bord', () => MT.openApp('seo-studio'), { size: 'sm', variant: 'ghost', icon: 'external', busy: false })
      ),
      emojiBox,
      tabsHead,
      tabBody
    );
  }

  function liveScore(f) {
    return MT.seo.scoreVideo({ title: f.title, description: f.description, tags: f.tags, keyword: state.keyword });
  }

  function renderHeader(f, seo) {
    MT.fill(
      headerBox,
      el(
        'div',
        { class: 'mt-row', style: 'flex-wrap:nowrap;gap:12px' },
        el('div', { class: 'mt-gauge-box' }, W.gauge(seo.score, { size: 62, label: 'SEO' })),
        el(
          'div',
          { class: 'mt-grow' },
          W.stats([
            { label: 'Titre', value: `${[...f.title].length}/100` },
            { label: 'Description', value: `${MT.text.wordCount(f.description)} mots` },
            {
              label: 'Tags',
              value: f.tagsVisible ? `${f.tags.length} · ${MT.seo.tagsLength(f.tags)}/500` : '—',
              title: f.tagsVisible ? '' : 'Ouvrez « Afficher plus » pour afficher les tags',
            },
          ])
        )
      )
    );
    panel.setSub(state.keyword ? `« ${state.keyword} »` : 'Définissez un mot-clé cible');
  }

  function renderTab(force) {
    for (const b of tabsHead.children) b.classList.toggle('active', b.dataset.id === state.activeTab);
    // les onglets interactifs ne sont pas reconstruits à chaque frappe dans Studio
    if (!force && ['profiles', 'checklist', 'ai', 'keyword'].includes(state.activeTab)) return;
    const f = fields();
    MT.fill(tabBody, TABS[state.activeTab](f, liveScore(f)));
  }

  const TABS = {
    seo(f, seo) {
      const demo = MT.seo.demonetizationAudit(f);
      return el(
        'div',
        null,
        state.keyword ? null : W.alert('Saisissez un mot-clé cible (onglet « Mot-clé ») pour un score précis. Par défaut : le premier tag.', 'info'),
        el('div', { style: 'margin-top:8px' }, W.checklist(seo.checks)),
        demo.findings.length
          ? el(
              'div',
              { style: 'margin-top:8px' },
              W.alert(`Démonétisation — risque ${demo.level} : ${[...new Set(demo.findings.map((x) => x.word))].slice(0, 8).join(', ')}`, demo.risk >= 50 ? 'error' : 'warn')
            )
          : null
      );
    },

    keyword() {
      const input = el('input', { class: 'mt-input', value: state.keyword, placeholder: 'ex. recette crêpes faciles' });
      const out = el('div', { style: 'margin-top:8px' });
      const analyze = async () => {
        state.keyword = input.value.trim();
        await saveKeyword();
        if (!state.keyword) return;
        MT.fill(out, W.spinner('Analyse…'));
        try {
          state.analysis = await MT.send('keyword.analyze', { keyword: state.keyword });
          drawAnalysis(out);
        } catch (e) {
          MT.fill(out, W.alert(e.message, 'error'));
        }
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') analyze();
      });
      if (state.analysis && MT.text.normalize(state.analysis.keyword) === MT.text.normalize(state.keyword)) drawAnalysis(out);
      return el(
        'div',
        null,
        el('div', { class: 'mt-row', style: 'flex-wrap:nowrap' }, input, W.button('Analyser', analyze, { size: 'sm', variant: 'primary', icon: 'search' })),
        out
      );
    },

    tags(f) {
      const box = el('div');
      if (!f.tagsVisible) {
        box.appendChild(
          el(
            'div',
            { class: 'mt-col' },
            W.alert('Le champ « Tags » est masqué : cliquez sur « Afficher plus » dans Studio.', 'warn'),
            W.button(
              'Afficher plus',
              () => {
                const btn = first(['#toggle-button', 'ytcp-button#toggle-button']);
                if (btn) btn.click();
              },
              { size: 'sm', busy: false }
            )
          )
        );
      } else {
        const sorted = MT.seo.sortTags(f.tags, { keyword: state.keyword, title: f.title, description: f.description });
        MT.add(
          box,
          el(
            'div',
            { class: 'mt-row', style: 'justify-content:space-between;margin-bottom:6px' },
            el('span', { class: 'mt-muted' }, `${f.tags.length} tags · ${MT.seo.tagsLength(f.tags)}/500`),
            el(
              'span',
              { class: 'mt-row', style: 'gap:4px' },
              W.copyButton(() => f.tags.join(', '), 'Copier'),
              W.copyButton(() => sorted.join(', '), 'Copier triés', { title: 'Copier les tags triés par pertinence (à recoller dans Studio)' })
            )
          ),
          f.tags.length ? W.chips(f.tags) : W.empty('Aucun tag pour le moment')
        );
      }
      const sugBox = el('div', { class: 'mt-section' });
      const related = state.analysis ? state.analysis.related : [];
      const suggestions = MT.seo.suggestTags({
        title: f.title,
        keyword: state.keyword || f.tags[0] || '',
        related,
        competitorTags: state.competitorTags || [],
        existing: f.tags,
        limit: 30,
      });
      MT.add(
        sugBox,
        el('div', { class: 'mt-section-title' }, 'Suggestions (cliquer pour ajouter)'),
        suggestions.length
          ? W.chips(suggestions, {
              onClick: async (s) => {
                await addTags([s.tag]);
                setTimeout(() => renderTab(true), 300);
              },
              title: (s) => `${s.tag} — ${s.sources.join(', ')}`,
            })
          : W.empty('Analysez un mot-clé pour obtenir des suggestions'),
        el(
          'div',
          { class: 'mt-row', style: 'margin-top:8px' },
          suggestions.length
            ? W.button(
                'Ajouter les 10 premières',
                async () => {
                  const n = await addTags(suggestions.slice(0, 10).map((s) => s.tag));
                  W.toast(`${n} tag(s) ajouté(s)`, 'success');
                  setTimeout(() => renderTab(true), 400);
                },
                { size: 'sm', icon: 'plus' }
              )
            : null,
          state.analysis
            ? W.button(
                'Tags des concurrents',
                async () => {
                  const r = await MT.send('keyword.topTags', { videos: state.analysis.videos, limit: 12 });
                  state.competitorTags = r.tags;
                  renderTab(true);
                },
                { size: 'sm', icon: 'users' }
              )
            : null
        )
      );
      const listsBox = el('div', { class: 'mt-section' });
      MT.store.list('tagLists').then((lists) => {
        if (!lists.length) return;
        MT.add(
          listsBox,
          el('div', { class: 'mt-section-title' }, 'Mes listes de tags'),
          W.chips(
            lists.map((l) => ({ label: `${l.name} (${l.tags.length})`, list: l })),
            {
              onClick: async (x) => {
                const n = await addTags(x.list.tags);
                W.toast(`${n} tag(s) ajouté(s)`, 'success');
                setTimeout(() => renderTab(true), 400);
              },
            }
          )
        );
      });
      return el('div', null, box, sugBox, listsBox);
    },

    profiles(f) {
      const box = el('div', null, W.spinner());
      MT.store.list('profiles').then((profiles) => {
        if (!profiles.length) {
          MT.fill(
            box,
            W.empty('Aucun profil. Créez-en dans le tableau de bord.'),
            W.button('Gérer les profils', () => MT.openApp('profiles'), { size: 'sm', busy: false })
          );
          return;
        }
        const select = el(
          'select',
          { class: 'mt-select' },
          profiles.map((p) => el('option', { value: p.id }, p.name))
        );
        const mode = el(
          'select',
          { class: 'mt-select' },
          el('option', { value: 'append' }, 'Ajouter à la fin de la description'),
          el('option', { value: 'replace' }, 'Remplacer la description')
        );
        MT.fill(
          box,
          el('label', { class: 'mt-small mt-muted' }, 'Profil'),
          select,
          el('label', { class: 'mt-small mt-muted', style: 'margin-top:6px;display:block' }, 'Description'),
          mode,
          el(
            'div',
            { class: 'mt-row', style: 'margin-top:8px' },
            W.button(
              'Appliquer',
              async () => {
                const p = profiles.find((x) => x.id === select.value);
                const cur = fields();
                const vars = {
                  titre: cur.title,
                  mot_cle: state.keyword,
                  resume: '',
                  date: new Date().toLocaleDateString('fr-FR'),
                  lien_chaine: '',
                  hashtag1: (state.keyword || '').replace(/\s+/g, ''),
                  hashtag2: '',
                };
                if (p.title && !cur.title.trim()) writeField(cur.titleEl, MT.seo.fillTemplate(p.title, vars), 'replace');
                if (p.description)
                  writeField(
                    cur.descEl,
                    (mode.value === 'append' && cur.description.trim() ? '\n\n' : '') + MT.seo.fillTemplate(p.description, vars),
                    mode.value === 'replace' ? 'replace' : 'append'
                  );
                if (p.tags && p.tags.length) await addTags(p.tags);
                W.toast('Profil appliqué', 'success');
              },
              { size: 'sm', variant: 'primary', icon: 'check' }
            ),
            W.button('Gérer', () => MT.openApp('profiles'), { size: 'sm', variant: 'ghost', busy: false })
          ),
          el('p', { class: 'mt-small mt-muted' }, 'Variables : {titre}, {mot_cle}, {date}, {resume}, {lien_chaine}, {hashtag1}, {hashtag2}.')
        );
      });
      return box;
    },

    checklist() {
      const box = el('div', null, W.spinner());
      const key = state.videoId || 'nouvelle-video';
      Promise.all([MT.store.list('checklist'), MT.store.get('checklistState', {})]).then(([items, all]) => {
        const done = new Set((all || {})[key] || []);
        const progressLbl = el('span', { class: 'mt-muted' });
        const update = () => (progressLbl.textContent = `${items.filter((i) => done.has(i.id)).length}/${items.length} terminés`);
        update();
        MT.fill(
          box,
          progressLbl,
          el(
            'div',
            { style: 'margin-top:6px' },
            items.map((it) => {
              const cb = el('input', { type: 'checkbox', checked: done.has(it.id) });
              const row = el('label', { class: ['mt-check-row', done.has(it.id) ? 'done' : null] }, cb, el('span', null, it.text));
              cb.addEventListener('change', async () => {
                if (cb.checked) done.add(it.id);
                else done.delete(it.id);
                row.classList.toggle('done', cb.checked);
                update();
                await MT.store.update('checklistState', (s) => ({ ...(s || {}), [key]: [...done] }));
              });
              return row;
            })
          )
        );
      });
      return box;
    },

    ai(f) {
      const out = el('div', { style: 'margin-top:8px' });
      const box = el('div', null, W.spinner());
      MT.send('ai', { fn: 'available' }).then((ok) => {
        if (!ok) {
          MT.fill(
            box,
            W.alert('Ajoutez votre clé API Claude dans les paramètres pour générer titres, descriptions et tags.', 'info'),
            W.button('Paramètres', () => MT.openApp('settings'), { size: 'sm', busy: false })
          );
          return;
        }
        const ctx = () => ({ ...fields(), keyword: state.keyword });
        MT.fill(
          box,
          el(
            'div',
            { class: 'mt-row' },
            W.button(
              'Titres',
              async () => {
                const c = ctx();
                MT.fill(out, W.spinner('Génération des titres…'));
                const titles = await MT.send('ai', { fn: 'titles', args: [{ topic: c.title || c.description.slice(0, 200), keyword: c.keyword, current: c.title }] });
                MT.fill(
                  out,
                  titles.map((t) =>
                    el(
                      'div',
                      {
                        class: 'mt-dropdown-item',
                        onclick: () => {
                          writeField(fields().titleEl, t.title, 'replace');
                          W.toast('Titre inséré', 'success');
                        },
                      },
                      el('strong', null, t.title),
                      el('span', { class: 'mt-small mt-muted' }, `${[...t.title].length} car. · ${t.angle}`)
                    )
                  )
                );
              },
              { size: 'sm', icon: 'bolt' }
            ),
            W.button(
              'Description',
              async () => {
                const c = ctx();
                MT.fill(out, W.spinner('Rédaction de la description…'));
                const d = await MT.send('ai', { fn: 'description', args: [{ title: c.title, keyword: c.keyword, notes: c.description.slice(0, 800) }] });
                MT.fill(
                  out,
                  el('pre', { style: 'white-space:pre-wrap;font:inherit;max-height:220px;overflow:auto;background:var(--mt-bg2);padding:8px;border-radius:8px' }, d),
                  el(
                    'div',
                    { class: 'mt-row', style: 'margin-top:6px' },
                    W.button('Remplacer', () => writeField(fields().descEl, d, 'replace'), { size: 'sm', variant: 'primary', busy: false }),
                    W.button('Ajouter à la fin', () => writeField(fields().descEl, '\n\n' + d, 'append'), { size: 'sm', busy: false }),
                    W.copyButton(d)
                  )
                );
              },
              { size: 'sm', icon: 'bolt' }
            ),
            W.button(
              'Tags',
              async () => {
                const c = ctx();
                MT.fill(out, W.spinner('Génération des tags…'));
                const tags = await MT.send('ai', { fn: 'tags', args: [{ title: c.title, keyword: c.keyword, description: c.description }] });
                MT.fill(
                  out,
                  W.chips(tags, { onClick: (t) => addTags([t]) }),
                  el(
                    'div',
                    { class: 'mt-row', style: 'margin-top:6px' },
                    W.button(
                      'Tout ajouter',
                      async () => {
                        const n = await addTags(tags);
                        W.toast(`${n} tag(s) ajouté(s)`, 'success');
                      },
                      { size: 'sm', variant: 'primary' }
                    )
                  )
                );
              },
              { size: 'sm', icon: 'bolt' }
            )
          )
        );
      });
      return el('div', null, box, out);
    },
  };

  function drawAnalysis(out) {
    const a = state.analysis;
    const s = a.score;
    MT.fill(
      out,
      el(
        'div',
        { class: 'mt-gauges' },
        ...[
          ['Global', s.overall],
          ['Volume', s.volume],
          ['Concurrence', s.competition, true],
        ].map(([l, v, inv]) => el('div', { class: 'mt-gauge-box' }, W.gauge(v, { size: 52, inverse: !!inv }), l))
      ),
      a.related.length
        ? P.section(
            'Recherches associées',
            W.chips(a.related.slice(0, 12), {
              onClick: (k) => {
                state.keyword = k;
                saveKeyword();
                renderTab(true);
              },
            })
          )
        : null,
      el(
        'div',
        { class: 'mt-row', style: 'margin-top:8px' },
        W.button(
          'Voir les suggestions de tags',
          () => {
            state.activeTab = 'tags';
            renderTab(true);
          },
          { size: 'sm', icon: 'tag', busy: false }
        )
      )
    );
  }

  async function saveKeyword() {
    if (!state.videoId) return;
    await MT.store.update('studioKeywords', (m) => ({ ...(m || {}), [state.videoId]: state.keyword }));
  }

  async function tick() {
    const f = fields();
    if (!f.titleEl) {
      if (panel) unmount();
      return;
    }
    const videoId = currentVideoId();
    if (state && state.videoId == null && videoId) {
      // la fenêtre de mise en ligne n'affiche l'identifiant qu'après le début de l'envoi
      state.videoId = videoId;
      saveKeyword();
    } else if (!state || state.videoId !== videoId) {
      if (panel) unmount();
      const st = newState(videoId);
      if (videoId) {
        const saved = await MT.store.get('studioKeywords', {});
        st.keyword = (saved || {})[videoId] || '';
      }
      state = st;
    }
    const fresh = !panel;
    mount();
    if (fresh) renderTab(true);
    const sig = JSON.stringify([f.title, f.description.length, f.tags, state.keyword]);
    if (sig !== state.sig) {
      state.sig = sig;
      renderHeader(f, liveScore(f));
      renderTab(false);
    }
  }

  P.register({
    name: 'studio',
    enabled: (s) => s.panels.studio,
    match: (loc) => loc.hostname.startsWith('studio.'),
    start() {
      clearInterval(timer);
      timer = setInterval(() => tick().catch(() => {}), 1500);
      tick().catch(() => {});
      return () => {
        clearInterval(timer);
        unmount();
      };
    },
  });

  P.start();
})();
