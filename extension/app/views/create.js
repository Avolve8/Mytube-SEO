/* MyTube SEO — vues : planificateur de vidéos, checklist, profils de mise en ligne, réponses types, suivi des partages. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  /* ------------------------------------------------------------ planificateur */

  const STATUSES = [
    ['idea', 'Idées'],
    ['research', 'Recherche'],
    ['script', 'Script'],
    ['filming', 'Tournage'],
    ['editing', 'Montage'],
    ['scheduled', 'Programmée'],
    ['published', 'Publiée'],
  ];

  function ideaModal(idea, onSaved) {
    const isNew = !idea;
    idea = idea || { id: MT.uid(), status: 'idea', createdAt: Date.now() };
    const title = A.input({ value: idea.title || '', placeholder: 'Titre de travail' });
    const keyword = A.input({ value: idea.keyword || '', placeholder: 'Mot-clé principal' });
    const status = A.select(STATUSES, idea.status);
    const due = A.input({ type: 'date', value: idea.due || '' });
    const notes = A.textarea({ rows: 6, value: idea.notes || '', placeholder: 'Notes, plan, liens, inspiration…' });
    const scoreBox = el(
      'div',
      { class: 'mt-row' },
      idea.score != null ? W.pill(idea.score) : null,
      el('span', { class: 'mt-muted mt-small' }, idea.score != null ? 'Score du mot-clé' : '')
    );
    W.modal(
      isNew ? 'Nouvelle idée' : 'Modifier l’idée',
      el(
        'div',
        null,
        A.field('Titre', title),
        el('div', { class: 'grid cols-2' }, A.field('Mot-clé', keyword), A.field('Statut', status)),
        el(
          'div',
          { class: 'grid cols-2' },
          A.field('Échéance', due),
          A.field(
            'Score',
            el(
              'div',
              { class: 'mt-row' },
              scoreBox,
              W.button(
                'Évaluer',
                async () => {
                  if (!keyword.value.trim()) return W.toast('Saisissez un mot-clé', 'error');
                  const sc = await MT.research.quickScore(keyword.value.trim());
                  idea.score = sc.overall;
                  MT.fill(scoreBox, W.pill(sc.overall), el('span', { class: 'mt-muted mt-small' }, `volume ${sc.volume} · concurrence ${sc.competition}`));
                },
                { size: 'sm' }
              )
            )
          )
        ),
        A.field('Notes', notes)
      ),
      {
        actions: [
          !isNew
            ? {
                label: 'Supprimer',
                variant: 'danger',
                onClick: async () => {
                  if (await W.confirm('Supprimer cette idée ?', { danger: true })) {
                    await MT.store.remove('ideas', idea.id);
                    onSaved();
                    return true;
                  }
                  return false;
                },
              }
            : null,
          { label: 'Annuler', onClick: () => true },
          {
            label: 'Enregistrer',
            variant: 'primary',
            onClick: async () => {
              await MT.store.upsert('ideas', {
                ...idea,
                title: title.value.trim() || keyword.value.trim() || 'Sans titre',
                keyword: keyword.value.trim(),
                status: status.value,
                due: due.value,
                notes: notes.value,
                updatedAt: Date.now(),
              });
              onSaved();
              return true;
            },
          },
        ].filter(Boolean),
      }
    );
  }

  A.register('planner', {
    title: 'Planificateur',
    icon: 'calendar',
    group: 'create',
    order: 1,
    description: 'Idées et production de vidéos (kanban)',
    async render(c) {
      const ideas = await MT.store.list('ideas');
      const board = el('div', { class: 'kanban' });
      const draw = (list) => {
        MT.clear(board);
        for (const [sid, label] of STATUSES) {
          const items = list.filter((i) => i.status === sid).sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || (b.createdAt || 0) - (a.createdAt || 0));
          const col = el(
            'div',
            {
              class: 'kanban-col',
              ondragover: (e) => {
                e.preventDefault();
                col.classList.add('drop');
              },
              ondragleave: () => col.classList.remove('drop'),
              ondrop: async (e) => {
                e.preventDefault();
                col.classList.remove('drop');
                const id = e.dataTransfer.getData('text/plain');
                await MT.store.update('ideas', (l) => l.map((x) => (x.id === id ? { ...x, status: sid, updatedAt: Date.now() } : x)));
                draw(await MT.store.list('ideas'));
              },
            },
            el('h4', null, label, el('span', { class: 'mt-muted' }, String(items.length))),
            items.map((i) =>
              el(
                'div',
                {
                  class: 'kanban-card',
                  draggable: true,
                  ondragstart: (e) => e.dataTransfer.setData('text/plain', i.id),
                  onclick: () => ideaModal(i, async () => draw(await MT.store.list('ideas'))),
                },
                el('div', { class: 'title' }, i.title),
                el(
                  'div',
                  { class: 'mt-row mt-small', style: 'margin-top:4px;gap:6px' },
                  i.score != null ? W.pill(i.score) : null,
                  i.keyword ? el('span', { class: 'mt-muted mt-ellipsis', style: 'max-width:120px' }, i.keyword) : null,
                  i.due ? el('span', { class: 'mt-muted' }, '📅 ' + fmt.date(i.due)) : null
                )
              )
            ),
            sid === 'idea'
              ? W.button('Ajouter', () => ideaModal(null, async () => draw(await MT.store.list('ideas'))), { size: 'sm', variant: 'ghost', icon: 'plus', busy: false })
              : null
          );
          board.appendChild(col);
        }
      };
      draw(ideas);
      const niche = A.input({ placeholder: 'Votre niche / thème (ex. cuisine végétarienne rapide)' });
      MT.add(
        c,
        A.pageHead(
          'Planificateur de vidéos',
          'Organisez vos idées et suivez la production de chaque vidéo. Glissez-déposez les cartes d’une colonne à l’autre.',
          'calendar',
          W.button('Nouvelle idée', () => ideaModal(null, async () => draw(await MT.store.list('ideas'))), { variant: 'primary', icon: 'plus', busy: false }),
          W.button(
            'Exporter CSV',
            async () =>
              MT.download(`idees-${MT.today()}.csv`, MT.toCSV(await MT.store.list('ideas'), ['title', 'keyword', 'status', 'score', 'due', 'notes']), 'text/csv;charset=utf-8'),
            { icon: 'download' }
          )
        ),
        board,
        el('div', { style: 'height:16px' }),
        A.card(
          'Trouver des idées',
          el('p', { class: 'mt-muted', style: 'margin-top:0' }, 'Générez des idées avec l’IA ou explorez les recherches associées à votre niche.'),
          el(
            'div',
            { class: 'field-row' },
            niche,
            W.button(
              'Idées IA',
              async () => {
                if (!niche.value.trim()) return W.toast('Décrivez votre niche', 'error');
                const existing = (await MT.store.list('ideas')).map((i) => i.title);
                const list = await MT.ai.ideas({ niche: niche.value.trim(), count: 10, existing });
                W.modal(
                  'Idées proposées',
                  el(
                    'div',
                    { class: 'mt-col' },
                    list.map((it) =>
                      el(
                        'div',
                        { class: 'mt-row', style: 'justify-content:space-between;flex-wrap:nowrap;border-bottom:1px solid var(--mt-border);padding:6px 0' },
                        el('div', null, el('strong', null, it.title), el('div', { class: 'mt-small mt-muted' }, `${it.format} · mot-clé : ${it.keyword} · ${it.angle}`)),
                        W.button(
                          'Ajouter',
                          async (e) => {
                            await MT.store.upsert('ideas', {
                              id: MT.uid(),
                              title: it.title,
                              keyword: it.keyword,
                              notes: `${it.angle}\nFormat : ${it.format}`,
                              status: 'idea',
                              createdAt: Date.now(),
                            });
                            draw(await MT.store.list('ideas'));
                            W.toast('Ajoutée', 'success');
                          },
                          { size: 'sm', icon: 'plus' }
                        )
                      )
                    )
                  ),
                  { width: '760px' }
                );
              },
              { icon: 'bolt' }
            ),
            W.button('Recherches associées', () => niche.value.trim() && A.navigate('keywords', { q: niche.value.trim() }), { icon: 'search', busy: false })
          )
        )
      );
    },
  });

  /* --------------------------------------------------------------- checklist */

  A.register('checklist', {
    title: 'Checklist de publication',
    icon: 'check',
    group: 'create',
    order: 3,
    description: 'Étapes à ne pas oublier avant de publier',
    async render(c) {
      const items = await MT.store.list('checklist');
      const listBox = el('div', { class: 'mt-col' });
      const save = async (list) => {
        await MT.store.set('checklist', list);
        draw(list);
      };
      const draw = (list) =>
        MT.fill(
          listBox,
          list.map((it, i) =>
            el(
              'div',
              { class: 'mt-row', style: 'flex-wrap:nowrap' },
              el('span', { class: 'mt-muted', style: 'width:22px' }, String(i + 1)),
              (() => {
                const inp = A.input({ value: it.text });
                inp.addEventListener('change', () => save(list.map((x) => (x.id === it.id ? { ...x, text: inp.value } : x))));
                return inp;
              })(),
              W.button(
                '',
                () => {
                  if (i > 0) {
                    const l = [...list];
                    [l[i - 1], l[i]] = [l[i], l[i - 1]];
                    save(l);
                  }
                },
                { size: 'sm', variant: 'ghost', icon: 'sort', title: 'Monter', busy: false }
              ),
              W.button('', () => save(list.filter((x) => x.id !== it.id)), { size: 'sm', variant: 'ghost danger', icon: 'trash', busy: false })
            )
          )
        );
      draw(items);
      const newItem = A.input({ placeholder: 'Nouvelle étape…' });
      const addItem = async () => {
        if (!newItem.value.trim()) return;
        const list = await MT.store.list('checklist');
        list.push({ id: MT.uid(), text: newItem.value.trim() });
        newItem.value = '';
        save(list);
      };
      newItem.addEventListener('keydown', (e) => e.key === 'Enter' && addItem());
      MT.add(
        c,
        A.pageHead(
          'Checklist de publication',
          'Cette liste s’affiche dans l’assistant YouTube Studio : cochez chaque étape vidéo par vidéo.',
          'check',
          W.button(
            'Rétablir par défaut',
            async () => {
              if (await W.confirm('Remplacer par la checklist par défaut ?')) save(MT.store.DEFAULT_CHECKLIST.map((x) => ({ ...x })));
            },
            { variant: 'ghost', icon: 'refresh', busy: false }
          )
        ),
        A.card(null, listBox, el('div', { class: 'field-row', style: 'margin-top:12px' }, newItem, W.button('Ajouter', addItem, { variant: 'primary', icon: 'plus', busy: false })))
      );
    },
  });

  /* ------------------------------------------------- profils de mise en ligne */

  A.register('profiles', {
    title: 'Profils de mise en ligne',
    icon: 'layers',
    group: 'create',
    order: 4,
    description: 'Modèles de description et tags par défaut',
    async render(c) {
      const profiles = await MT.store.list('profiles');
      const edit = (p) => {
        p = p || { id: MT.uid(), name: '', title: '', description: '', tags: [] };
        const name = A.input({ value: p.name, placeholder: 'Nom du profil (ex. Tutoriels)' });
        const title = A.input({ value: p.title, placeholder: 'Modèle de titre (facultatif) — ex. {mot_cle} : tuto complet' });
        const desc = A.textarea({ rows: 12, value: p.description });
        const tags = A.tagEditor(p.tags || []);
        W.modal(
          'Profil de mise en ligne',
          el(
            'div',
            null,
            A.field('Nom', name),
            A.field('Titre', title),
            A.field('Description', desc, 'Variables : {titre}, {mot_cle}, {date}, {resume}, {lien_chaine}, {hashtag1}, {hashtag2}'),
            A.counter(desc, 5000),
            A.field('Tags par défaut', tags)
          ),
          {
            width: '760px',
            actions: [
              { label: 'Annuler', onClick: () => true },
              {
                label: 'Enregistrer',
                variant: 'primary',
                onClick: async () => {
                  if (!name.value.trim()) {
                    W.toast('Nommez le profil', 'error');
                    return false;
                  }
                  await MT.store.upsert('profiles', { ...p, name: name.value.trim(), title: title.value, description: desc.value, tags: tags.get() });
                  A.render();
                  return true;
                },
              },
            ],
          }
        );
      };
      MT.add(
        c,
        A.pageHead(
          'Profils de mise en ligne',
          'Préparez des modèles (description type, liens, réseaux, tags par défaut) à appliquer en un clic dans YouTube Studio ou en masse.',
          'layers',
          W.button('Nouveau profil', () => edit(null), { variant: 'primary', icon: 'plus', busy: false })
        ),
        A.grid(
          2,
          ...(profiles.length
            ? profiles.map((p) =>
                A.card(
                  p.name,
                  p.title ? el('div', { class: 'mt-small' }, el('strong', null, 'Titre : '), p.title) : null,
                  el(
                    'pre',
                    { style: 'white-space:pre-wrap;font:inherit;font-size:12px;background:var(--mt-bg2);padding:8px;border-radius:8px;max-height:160px;overflow:auto' },
                    p.description || '(description vide)'
                  ),
                  p.tags && p.tags.length ? W.chips(p.tags.slice(0, 12)) : null,
                  el(
                    'div',
                    { class: 'mt-row', style: 'margin-top:8px' },
                    W.button('Modifier', () => edit(p), { size: 'sm', icon: 'edit', busy: false }),
                    W.copyButton(() => p.description, 'Copier la description'),
                    W.button(
                      '',
                      async () => {
                        if (await W.confirm(`Supprimer « ${p.name} » ?`, { danger: true })) {
                          await MT.store.remove('profiles', p.id);
                          A.render();
                        }
                      },
                      { size: 'sm', variant: 'ghost danger', icon: 'trash', busy: false }
                    )
                  )
                )
              )
            : [A.card(null, W.empty('Aucun profil.'))])
        )
      );
    },
  });

  /* ------------------------------------------------------------ réponses types */

  A.register('canned', {
    title: 'Réponses types',
    icon: 'comment',
    group: 'community',
    order: 2,
    description: 'Réponses enregistrées pour les commentaires',
    async render(c) {
      const list = await MT.store.list('canned');
      const edit = (r) => {
        r = r || { id: MT.uid(), name: '', text: '' };
        const name = A.input({ value: r.name, placeholder: 'Nom court (ex. Merci)' });
        const text = A.textarea({ rows: 5, value: r.text });
        W.modal(
          'Réponse type',
          el(
            'div',
            null,
            A.field('Nom', name),
            A.field('Texte', text, 'Variables : {auteur} (auteur du commentaire), {chaine} (votre chaîne), {date}'),
            el(
              'div',
              { class: 'mt-row' },
              W.button(
                'Émojis',
                () =>
                  W.modal(
                    'Émojis',
                    W.emojiPicker((e) => {
                      text.value += e;
                    })
                  ),
                { size: 'sm', icon: 'emoji', busy: false }
              )
            )
          ),
          {
            actions: [
              { label: 'Annuler', onClick: () => true },
              {
                label: 'Enregistrer',
                variant: 'primary',
                onClick: async () => {
                  if (!name.value.trim() || !text.value.trim()) {
                    W.toast('Nom et texte requis', 'error');
                    return false;
                  }
                  await MT.store.upsert('canned', { ...r, name: name.value.trim(), text: text.value });
                  A.render();
                  return true;
                },
              },
            ],
          }
        );
      };
      MT.add(
        c,
        A.pageHead(
          'Réponses types',
          'Répondez plus vite aux commentaires : vos réponses apparaissent dans une barre d’outils sous chaque zone de réponse sur YouTube et dans Studio.',
          'comment',
          W.button('Nouvelle réponse', () => edit(null), { variant: 'primary', icon: 'plus', busy: false })
        ),
        A.card(
          null,
          W.table(
            [
              { key: 'name', label: 'Nom' },
              { key: 'text', label: 'Texte', render: (r) => el('span', { style: 'white-space:pre-wrap' }, r.text) },
              {
                key: 'a',
                label: '',
                sortable: false,
                render: (r) =>
                  el(
                    'span',
                    { class: 'mt-row', style: 'gap:2px;flex-wrap:nowrap' },
                    W.copyButton(r.text, '', { variant: 'ghost' }),
                    W.button('', () => edit(r), { size: 'sm', variant: 'ghost', icon: 'edit', busy: false }),
                    W.button(
                      '',
                      async () => {
                        await MT.store.remove('canned', r.id);
                        A.render();
                      },
                      { size: 'sm', variant: 'ghost danger', icon: 'trash', busy: false }
                    )
                  ),
              },
            ],
            list,
            { sortKey: 'name', sortDir: 'asc', empty: 'Aucune réponse type.' }
          )
        )
      );
    },
  });

  /* ---------------------------------------------------------- suivi des partages */

  const PLATFORMS = [
    ['x', 'X (Twitter)', (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`],
    ['facebook', 'Facebook', (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`],
    ['linkedin', 'LinkedIn', (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`],
    ['reddit', 'Reddit', (u, t) => `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`],
    ['whatsapp', 'WhatsApp', (u, t) => `https://wa.me/?text=${encodeURIComponent(t + ' ' + u)}`],
    [
      'pinterest',
      'Pinterest',
      (u, t, id) =>
        `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(u)}&media=${encodeURIComponent(MT.thumbUrl(id, 'maxresdefault'))}&description=${encodeURIComponent(t)}`,
    ],
    ['telegram', 'Telegram', (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`],
    ['email', 'E-mail', (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}`],
    ['instagram', 'Instagram (story)', null],
    ['tiktok', 'TikTok', null],
    ['discord', 'Discord', null],
    ['newsletter', 'Newsletter', null],
  ];

  A.register('share', {
    title: 'Suivi des partages',
    icon: 'share',
    group: 'community',
    order: 5,
    description: 'Promouvoir chaque vidéo sur les réseaux',
    async render(c) {
      const tracker = await MT.store.list('shareTracker');
      const add = async (id) => {
        if (tracker.some((t) => t.videoId === id)) return W.toast('Vidéo déjà suivie', 'error');
        const v = await MT.yt.player(id);
        await MT.store.upsert('shareTracker', { id: MT.uid(), videoId: id, title: v.title, done: [], createdAt: Date.now() });
        A.render();
      };
      MT.add(
        c,
        A.pageHead('Suivi des partages', 'Partagez chaque vidéo sur vos réseaux et gardez une trace de ce qui a été fait.', 'share'),
        A.card('Ajouter une vidéo', A.videoInput({ label: 'Ajouter', onSubmit: add })),
        el('div', { style: 'height:16px' }),
        el(
          'div',
          { class: 'stack' },
          tracker.length
            ? [...tracker]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((t) => {
                  const url = `https://youtu.be/${t.videoId}`;
                  const done = new Set(t.done || []);
                  const progressLbl = el('span', { class: 'mt-muted' }, `${done.size}/${PLATFORMS.length} plateformes`);
                  return A.card(
                    null,
                    el(
                      'div',
                      { class: 'mt-row', style: 'justify-content:space-between' },
                      A.videoCell({ videoId: t.videoId, title: t.title }, { channel: false }),
                      el(
                        'span',
                        { class: 'mt-row' },
                        progressLbl,
                        W.copyButton(url, 'Lien'),
                        W.button(
                          '',
                          async () => {
                            await MT.store.remove('shareTracker', t.id);
                            A.render();
                          },
                          { size: 'sm', variant: 'ghost danger', icon: 'trash', busy: false }
                        )
                      )
                    ),
                    el(
                      'div',
                      { class: 'mt-row', style: 'margin-top:10px;gap:8px 18px' },
                      PLATFORMS.map(([pid, label, make]) => {
                        const cb = el('input', { type: 'checkbox', checked: done.has(pid) });
                        cb.addEventListener('change', async () => {
                          cb.checked ? done.add(pid) : done.delete(pid);
                          progressLbl.textContent = `${done.size}/${PLATFORMS.length} plateformes`;
                          await MT.store.update('shareTracker', (l) => l.map((x) => (x.id === t.id ? { ...x, done: [...done] } : x)));
                        });
                        return el(
                          'span',
                          { class: 'mt-row', style: 'gap:4px' },
                          cb,
                          make ? el('a', { href: make(url, t.title, t.videoId), target: '_blank', rel: 'noopener' }, label) : el('span', null, label)
                        );
                      })
                    )
                  );
                })
            : A.card(null, W.empty('Aucune vidéo suivie.'))
        )
      );
    },
  });
})();
