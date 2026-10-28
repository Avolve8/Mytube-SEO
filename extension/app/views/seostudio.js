/* MyTube SEO — vues : SEO Studio (rédaction optimisée), générateur de titres et descriptions. Fournit A.tagEditor. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  /** Éditeur de tags : pastilles supprimables + saisie (Entrée ou virgule). */
  function tagEditor(initial = [], { onChange, placeholder = 'Ajouter des tags (Entrée ou virgule)…' } = {}) {
    let tags = [...initial];
    const chipsBox = el('div');
    const counter = el('span', { class: 'counter' });
    const inp = A.input({ placeholder });
    const emit = () => {
      draw();
      if (onChange) onChange([...tags]);
    };
    const add = (list) => {
      const seen = new Set(tags.map(MT.text.normalize));
      for (const t of list) {
        const v = String(t).trim().replace(/^#/, '');
        if (v && !seen.has(MT.text.normalize(v))) {
          tags.push(v);
          seen.add(MT.text.normalize(v));
        }
      }
      emit();
    };
    function draw() {
      const len = MT.seo.tagsLength(tags);
      counter.textContent = `${tags.length} tags · ${len}/500 caractères`;
      counter.classList.toggle('over', len > 500);
      MT.fill(
        chipsBox,
        tags.length
          ? W.chips(tags, {
              onRemove: (t) => {
                tags = tags.filter((x) => x !== t);
                emit();
              },
            })
          : el('span', { class: 'mt-muted mt-small' }, 'Aucun tag')
      );
    }
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (inp.value.trim()) add(MT.seo.parseTagInput(inp.value));
        inp.value = '';
      } else if (e.key === 'Backspace' && !inp.value && tags.length) {
        tags.pop();
        emit();
      }
    });
    inp.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (/[,\n]/.test(text)) {
        e.preventDefault();
        add(MT.seo.parseTagInput(text));
      }
    });
    inp.addEventListener('blur', () => {
      if (inp.value.trim()) {
        add(MT.seo.parseTagInput(inp.value));
        inp.value = '';
      }
    });
    draw();
    const wrap = el('div', { class: 'mt-col', style: 'gap:6px' }, chipsBox, inp, counter);
    wrap.get = () => [...tags];
    wrap.set = (list) => {
      tags = [...list];
      emit();
    };
    wrap.add = add;
    return wrap;
  }
  A.tagEditor = tagEditor;

  /** Aperçu d'un résultat de recherche YouTube. */
  function searchPreview({ title, description, thumb, channel }) {
    return el(
      'div',
      { class: 'yt-mock light', style: 'border-radius:10px;border:1px solid var(--mt-border);overflow:hidden' },
      el(
        'div',
        { class: 'yt-list' },
        el(
          'div',
          { class: 'yt-card', style: 'gap:10px' },
          thumb
            ? el('img', { src: thumb, alt: '', style: 'width:168px' })
            : el(
                'div',
                {
                  style:
                    'width:168px;aspect-ratio:16/9;background:#ddd;border-radius:12px;flex:none;display:flex;align-items:center;justify-content:center;color:#777;font-size:11px',
                },
                'Miniature'
              ),
          el(
            'div',
            { style: 'min-width:0' },
            el('div', { class: 't', style: 'margin-top:0' }, title || 'Titre de la vidéo'),
            el('div', { class: 's' }, `${channel || 'Votre chaîne'} · 1,2 k vues · il y a 1 jour`),
            el(
              'div',
              { class: 's', style: 'margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' },
              (description || '').slice(0, 160)
            )
          )
        )
      )
    );
  }
  A.searchPreview = searchPreview;

  A.register('seo-studio', {
    title: 'SEO Studio',
    icon: 'edit',
    group: 'research',
    order: 2,
    description: 'Rédiger titre, description et tags optimisés',
    async render(c, params) {
      const s = await MT.store.getSettings();
      const draft = (await MT.store.get('seoStudioDraft', null)) || { keyword: '', title: '', description: '', tags: [] };
      if (params.k) draft.keyword = params.k;
      const state = { ...draft, analysis: null, competitorTags: [], thumb: null };

      const kwInput = A.input({ value: state.keyword, placeholder: 'Mot-clé cible (ex. recette crêpes faciles)' });
      const titleInput = A.input({ value: state.title, placeholder: 'Titre de la vidéo', maxlength: 100 });
      const descInput = A.textarea({ value: state.description, rows: 14, placeholder: 'Description (les 2 premières lignes sont les plus importantes)' });
      const tags = tagEditor(state.tags, { onChange: () => update() });
      const scoreBox = el('div');
      const sugBox = el('div');
      const analysisBox = el('div');
      const previewBox = el('div');

      const save = MT.debounce(() => MT.store.set('seoStudioDraft', { keyword: kwInput.value, title: titleInput.value, description: descInput.value, tags: tags.get() }), 500);

      function drawSuggestions() {
        const sug = MT.seo.suggestTags({
          title: titleInput.value,
          keyword: kwInput.value.trim(),
          related: state.analysis ? state.analysis.related : [],
          competitorTags: state.competitorTags,
          existing: tags.get(),
          limit: 40,
        });
        MT.fill(
          sugBox,
          sug.length ? W.chips(sug, { onClick: (x) => tags.add([x.tag]), title: (x) => `${x.tag} — ${x.sources.join(', ')}` }) : W.empty('Saisissez un mot-clé et un titre'),
          sug.length
            ? el(
                'div',
                { class: 'mt-row', style: 'margin-top:8px' },
                W.button('Ajouter les 10 premiers', () => tags.add(MT.seo.fitTags([...tags.get(), ...sug.slice(0, 10).map((x) => x.tag)]).slice(tags.get().length)), {
                  size: 'sm',
                  icon: 'plus',
                  busy: false,
                })
              )
            : null
        );
      }

      function update() {
        const seo = MT.seo.scoreVideo({ title: titleInput.value, description: descInput.value, tags: tags.get(), keyword: kwInput.value.trim() });
        const label = MT.seo.scoreLabel(seo.score);
        MT.fill(
          scoreBox,
          el(
            'div',
            { class: 'mt-row', style: 'gap:14px;margin-bottom:10px' },
            W.gauge(seo.score, { size: 80, label: 'SEO' }),
            el(
              'div',
              null,
              el('div', { style: 'font-size:16px;font-weight:700' }, label.label),
              el('div', { class: 'mt-muted mt-small' }, seo.keyword ? `pour « ${seo.keyword} »` : 'Définissez un mot-clé cible')
            )
          ),
          W.checklist(seo.checks)
        );
        MT.fill(previewBox, searchPreview({ title: titleInput.value, description: descInput.value, thumb: state.thumb, channel: s.myChannelTitle }));
        drawSuggestions();
        save();
      }

      async function analyze() {
        const k = kwInput.value.trim();
        if (!k) return W.toast('Saisissez un mot-clé cible', 'error');
        MT.fill(analysisBox, W.spinner('Analyse du mot-clé…'));
        state.analysis = await MT.research.analyzeKeyword(k);
        const sc = state.analysis.score;
        MT.fill(
          analysisBox,
          el(
            'div',
            { class: 'mt-row', style: 'justify-content:space-around' },
            [
              ['Global', sc.overall],
              ['Volume', sc.volume],
              ['Concurrence', sc.competition, true],
            ].map(([l, v, inv]) =>
              el('div', { class: 'mt-col', style: 'align-items:center;gap:2px' }, W.gauge(v, { size: 60, inverse: !!inv }), el('span', { class: 'mt-small' }, l))
            )
          ),
          el(
            'div',
            { class: 'mt-row', style: 'margin-top:8px' },
            W.button(
              'Tags des concurrents',
              async () => {
                const r = await MT.research.topTags(state.analysis.videos, { limit: 12 });
                state.competitorTags = r.tags;
                drawSuggestions();
                W.toast(`${r.tags.length} tags concurrents chargés dans les suggestions`, 'success');
              },
              { size: 'sm', icon: 'users' }
            ),
            W.button('Explorateur', () => A.navigate('keywords', { q: k }), { size: 'sm', variant: 'ghost', busy: false })
          )
        );
        drawSuggestions();
      }

      for (const i of [kwInput, titleInput, descInput]) i.addEventListener('input', MT.debounce(update, 250));
      kwInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') analyze();
      });

      const thumbInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      thumbInput.addEventListener('change', () => {
        const f = thumbInput.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          state.thumb = r.result;
          update();
        };
        r.readAsDataURL(f);
      });

      async function loadFromVideo() {
        const inp = A.input({ placeholder: 'URL ou identifiant de vidéo' });
        W.modal(
          'Charger depuis une vidéo',
          el(
            'div',
            null,
            el('p', { class: 'mt-muted', style: 'margin-top:0' }, 'Importe le titre, la description et les tags d’une vidéo publique (la vôtre ou celle d’un concurrent).'),
            inp
          ),
          {
            actions: [
              { label: 'Annuler', onClick: () => true },
              {
                label: 'Charger',
                variant: 'primary',
                onClick: async () => {
                  const id = MT.videoIdFromUrl(inp.value);
                  if (!id) {
                    W.toast('Vidéo invalide', 'error');
                    return false;
                  }
                  const v = await MT.yt.getVideo(id, { withNext: false });
                  titleInput.value = v.title;
                  descInput.value = v.description;
                  tags.set(v.tags);
                  state.videoId = id;
                  if (!kwInput.value && v.tags[0]) kwInput.value = v.tags[0];
                  update();
                  return true;
                },
              },
            ],
          }
        );
      }

      async function applyToVideo() {
        if (!(await MT.oauth.status()).connected) return W.toast('Connectez votre compte Google (Paramètres) pour modifier une vidéo.', 'error');
        const videos = await A.loadMyVideos();
        let picked = [];
        const sel = A.videoSelector(videos, { multi: false, onChange: (v) => (picked = v), initial: state.videoId ? [state.videoId] : [] });
        W.modal(
          'Appliquer à une de mes vidéos',
          el(
            'div',
            null,
            W.alert('Le titre, la description et les tags de la vidéo choisie seront remplacés (coût : 50 unités de quota).', 'warn'),
            el('div', { style: 'margin-top:10px' }, sel)
          ),
          {
            width: '900px',
            actions: [
              { label: 'Annuler', onClick: () => true },
              {
                label: 'Appliquer',
                variant: 'primary',
                onClick: async () => {
                  const v = picked[0];
                  if (!v) {
                    W.toast('Choisissez une vidéo', 'error');
                    return false;
                  }
                  const t = tags.get();
                  if (MT.seo.tagsLength(t) > 500) throw new Error('Les tags dépassent 500 caractères.');
                  await MT.ytapi.updateVideo(v.raw, { snippet: { title: titleInput.value.trim(), description: descInput.value, tags: t } }, await A.auth());
                  A.invalidateMyVideos();
                  W.toast('Vidéo mise à jour sur YouTube', 'success');
                  return true;
                },
              },
            ],
          }
        );
      }

      const aiOut = el('div');
      const aiBar = el(
        'div',
        { class: 'mt-row' },
        W.button(
          'Titres',
          async () => {
            const list = await MT.ai.titles({ keyword: kwInput.value, topic: titleInput.value || descInput.value.slice(0, 300), current: titleInput.value });
            MT.fill(
              aiOut,
              el(
                'div',
                { class: 'mt-col', style: 'gap:4px;margin-top:8px' },
                list.map((t) =>
                  el(
                    'div',
                    { class: 'mt-row', style: 'justify-content:space-between;flex-wrap:nowrap' },
                    el('span', null, t.title, el('span', { class: 'mt-small mt-muted' }, ` · ${t.angle}`)),
                    W.button(
                      'Utiliser',
                      () => {
                        titleInput.value = t.title;
                        update();
                      },
                      { size: 'sm', busy: false }
                    )
                  )
                )
              )
            );
          },
          { size: 'sm', icon: 'bolt' }
        ),
        W.button(
          'Description',
          async () => {
            descInput.value = await MT.ai.description({ title: titleInput.value, keyword: kwInput.value, notes: descInput.value });
            update();
          },
          { size: 'sm', icon: 'bolt' }
        ),
        W.button(
          'Tags',
          async () => {
            tags.add(await MT.ai.tags({ title: titleInput.value, keyword: kwInput.value, description: descInput.value }));
          },
          { size: 'sm', icon: 'bolt' }
        )
      );

      const titleCounter = A.counter(titleInput, 100);
      const descCounter = A.counter(descInput, 5000);
      const wordCounter = A.counter(descInput, null, (v) => MT.text.wordCount(v) + ' mots');

      MT.add(
        c,
        A.pageHead(
          'SEO Studio',
          'Rédigez un titre, une description et des tags optimisés pour un mot-clé, avec un score en temps réel.',
          'edit',
          W.button('Charger une vidéo', loadFromVideo, { icon: 'download', busy: false }),
          W.button('Appliquer à ma vidéo', applyToVideo, { icon: 'upload' }),
          W.button(
            'Nouveau',
            async () => {
              if (await W.confirm('Effacer le brouillon ?')) {
                await MT.store.set('seoStudioDraft', null);
                A.navigate('seo-studio');
                A.render();
              }
            },
            { variant: 'ghost', icon: 'trash', busy: false }
          )
        ),
        el(
          'div',
          { class: 'grid sidebar' },
          el(
            'div',
            { class: 'stack' },
            A.card(
              null,
              A.field('Mot-clé cible', el('div', { class: 'field-row' }, kwInput, W.button('Analyser', analyze, { variant: 'primary', icon: 'search' }))),
              A.field('Titre', titleInput),
              titleCounter,
              A.field('Description', descInput),
              el('div', { class: 'mt-row', style: 'justify-content:flex-end;gap:12px' }, wordCounter, descCounter),
              A.field('Tags', tags),
              el(
                'div',
                { class: 'mt-row' },
                W.button('Trier par pertinence', () => tags.set(MT.seo.sortTags(tags.get(), { keyword: kwInput.value, title: titleInput.value, description: descInput.value })), {
                  size: 'sm',
                  icon: 'sort',
                  busy: false,
                }),
                W.button('Limiter à 500 car.', () => tags.set(MT.seo.fitTags(tags.get())), { size: 'sm', busy: false }),
                W.button(
                  'Insérer une liste',
                  async () => {
                    const lists = await MT.store.list('tagLists');
                    if (!lists.length) return W.toast('Aucune liste de tags enregistrée', 'error');
                    const m = W.modal(
                      'Insérer une liste de tags',
                      W.chips(
                        lists.map((l) => ({ label: `${l.name} (${l.tags.length})`, l })),
                        {
                          onClick: (x) => {
                            tags.add(x.l.tags);
                            m.close();
                          },
                        }
                      )
                    );
                  },
                  { size: 'sm', icon: 'list', busy: false }
                ),
                W.copyButton(() => tags.get().join(', '), 'Copier les tags'),
                W.button('Vider', () => tags.set([]), { size: 'sm', variant: 'ghost', busy: false })
              )
            ),
            A.card('Assistant IA (Claude)', aiBar, aiOut),
            A.card(
              'Aperçu dans les résultats',
              previewBox,
              el(
                'div',
                { class: 'mt-row', style: 'margin-top:8px' },
                thumbInput,
                W.button('Choisir une miniature', () => thumbInput.click(), { size: 'sm', icon: 'image', busy: false })
              )
            ),
            A.card(
              'Exporter',
              el(
                'div',
                { class: 'mt-row' },
                W.copyButton(() => `${titleInput.value}\n\n${descInput.value}\n\nTags : ${tags.get().join(', ')}`, 'Tout copier', { size: 'md' }),
                W.button(
                  'Enregistrer comme profil',
                  async () => {
                    await MT.store.upsert('profiles', {
                      id: MT.uid(),
                      name: titleInput.value.slice(0, 50) || 'Profil SEO Studio',
                      title: titleInput.value,
                      description: descInput.value,
                      tags: tags.get(),
                    });
                    W.toast('Profil de mise en ligne créé', 'success');
                  },
                  { icon: 'layers' }
                ),
                W.button(
                  'Ajouter au planificateur',
                  async () => {
                    await MT.store.upsert('ideas', {
                      id: MT.uid(),
                      title: titleInput.value || kwInput.value,
                      keyword: kwInput.value,
                      status: 'script',
                      notes: descInput.value.slice(0, 500),
                      tags: tags.get(),
                      createdAt: Date.now(),
                    });
                    W.toast('Ajouté au planificateur', 'success');
                  },
                  { icon: 'star' }
                )
              )
            )
          ),
          el('div', { class: 'stack' }, A.card('Score SEO', scoreBox), A.card('Analyse du mot-clé', analysisBox), A.card('Suggestions de tags', sugBox))
        )
      );
      MT.fill(analysisBox, el('p', { class: 'mt-muted', style: 'margin:0' }, 'Cliquez sur « Analyser » pour évaluer le mot-clé et obtenir des suggestions.'));
      update();
      if (params.k) analyze();
    },
  });

  /* --------------------------------------------- titres & descriptions */

  A.register('titles', {
    title: 'Titres & descriptions',
    icon: 'bolt',
    group: 'research',
    order: 4,
    description: 'Générateur de titres, modèles de description, IA',
    async render(c, params) {
      const kw = A.input({ value: params.k || '', placeholder: 'Mot-clé ou sujet de la vidéo' });
      const titlesBox = el('div');
      const drawTitles = (list) =>
        MT.fill(
          titlesBox,
          W.table(
            [
              { key: 'title', label: 'Titre' },
              {
                key: 'len',
                label: 'Longueur',
                num: true,
                sort: (t) => [...t.title].length,
                render: (t) => {
                  const n = [...t.title].length;
                  return el('span', { style: { color: n > 70 ? 'var(--mt-fair)' : 'inherit' } }, `${n}`);
                },
              },
              { key: 'angle', label: 'Angle', render: (t) => t.angle || 'Modèle' },
              {
                key: 'act',
                label: '',
                sortable: false,
                render: (t) =>
                  el(
                    'span',
                    { class: 'mt-row', style: 'gap:4px;flex-wrap:nowrap' },
                    W.copyButton(t.title, '', { variant: 'ghost' }),
                    W.button(
                      '',
                      () => {
                        MT.store
                          .update('seoStudioDraft', (d) => ({ keyword: kw.value, description: '', tags: [], ...(d || {}), title: t.title }))
                          .then(() => A.navigate('seo-studio'));
                      },
                      { size: 'sm', variant: 'ghost', icon: 'edit', title: 'Ouvrir dans SEO Studio', busy: false }
                    )
                  ),
              },
            ],
            list
          )
        );
      const genTemplates = () => {
        if (!kw.value.trim()) return W.toast('Saisissez un mot-clé', 'error');
        drawTitles(MT.seo.titleIdeas(kw.value.trim()).map((title) => ({ title })));
      };

      const summary = A.textarea({ rows: 3, placeholder: 'Résumé de la vidéo en 2 phrases (avec le mot-clé)' });
      const points = A.textarea({ rows: 4, placeholder: 'Points clés abordés (un par ligne)' });
      const chapters = A.textarea({ rows: 4, placeholder: '00:00 Introduction\n01:30 …' });
      const links = A.textarea({ rows: 3, placeholder: 'Liens utiles (un par ligne : Libellé | URL)' });
      const cta = A.input({ value: '🔔 Abonne-toi et active la cloche pour ne rien rater !' });
      const hashtags = A.input({ placeholder: '#exemple #youtube' });
      const result = A.textarea({ rows: 16 });
      const counter = A.counter(result, 5000);
      const build = () => {
        const parts = [];
        if (summary.value.trim()) parts.push(summary.value.trim());
        const pts = points.value
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean);
        if (pts.length) parts.push('Dans cette vidéo :\n' + pts.map((p) => '✅ ' + p).join('\n'));
        if (chapters.value.trim()) parts.push('⏱️ Chapitres :\n' + chapters.value.trim());
        const ls = links.value
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        if (ls.length)
          parts.push(
            '🔗 Liens :\n' +
              ls
                .map((l) => {
                  const [a, b] = l.split('|').map((x) => x.trim());
                  return b ? `${a} : ${b}` : a;
                })
                .join('\n')
          );
        if (cta.value.trim()) parts.push(cta.value.trim());
        if (hashtags.value.trim())
          parts.push(
            hashtags.value
              .trim()
              .split(/\s+/)
              .map((h) => (h.startsWith('#') ? h : '#' + h))
              .join(' ')
          );
        result.value = parts.join('\n\n');
        counter.update();
      };
      for (const f of [summary, points, chapters, links, cta, hashtags]) f.addEventListener('input', MT.debounce(build, 200));

      MT.add(
        c,
        A.pageHead('Titres & descriptions', 'Trouvez des titres accrocheurs et construisez des descriptions structurées et complètes.', 'bolt'),
        el(
          'div',
          { class: 'stack' },
          A.card(
            'Générateur de titres',
            el(
              'div',
              { class: 'field-row' },
              kw,
              W.button('Modèles', genTemplates, { variant: 'primary', icon: 'list', busy: false }),
              W.button(
                'IA',
                async () => {
                  if (!kw.value.trim()) return W.toast('Saisissez un mot-clé', 'error');
                  drawTitles(await MT.ai.titles({ keyword: kw.value.trim(), topic: kw.value.trim(), count: 12 }));
                },
                { icon: 'bolt' }
              )
            ),
            el('div', { style: 'margin-top:12px' }, titlesBox)
          ),
          A.grid(
            2,
            A.card(
              'Modèle de description',
              A.field('Résumé', summary),
              A.field('Points clés', points),
              A.field('Chapitres', chapters),
              A.field('Liens', links),
              A.field('Appel à l’action', cta),
              A.field('Hashtags', hashtags)
            ),
            A.card(
              'Résultat',
              result,
              counter,
              el(
                'div',
                { class: 'mt-row', style: 'margin-top:8px' },
                W.copyButton(() => result.value, 'Copier', { size: 'md' }),
                W.button(
                  'Rédiger avec l’IA',
                  async () => {
                    result.value = await MT.ai.description({
                      title: kw.value,
                      keyword: kw.value,
                      notes: [summary.value, points.value, chapters.value].join('\n'),
                      links: links.value,
                    });
                    counter.update();
                  },
                  { icon: 'bolt' }
                ),
                W.button(
                  'Envoyer vers SEO Studio',
                  async () => {
                    await MT.store.update('seoStudioDraft', (d) => ({ keyword: kw.value, title: '', tags: [], ...(d || {}), description: result.value }));
                    A.navigate('seo-studio');
                  },
                  { icon: 'edit', busy: false }
                )
              )
            )
          )
        )
      );
      if (params.k) genTemplates();
      build();
    },
  });
})();
