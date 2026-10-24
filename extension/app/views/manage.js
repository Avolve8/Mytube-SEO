/* MyTube SEO — vues (connexion Google requise) : traitement en masse, tests A/B, mises à jour programmées. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;
  const HOUR = 3600 * 1000;

  /* ------------------------------------------------------ traitement en masse */

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function replaceIn(text, find, repl, { regex, caseSensitive }) {
    if (!find) return text;
    const re = new RegExp(regex ? find : escapeRe(find), caseSensitive ? 'g' : 'gi');
    return String(text || '').replace(re, regex ? repl : () => repl);
  }

  const OPERATIONS = [
    ['replace', 'Rechercher / remplacer'],
    ['append', 'Ajouter du texte à la description'],
    ['addTags', 'Ajouter des tags'],
    ['removeTags', 'Supprimer des tags'],
    ['setTags', 'Remplacer tous les tags'],
    ['copyTags', 'Copier les tags d’une autre vidéo'],
    ['profile', 'Appliquer un profil de mise en ligne'],
    ['privacy', 'Changer la visibilité'],
    ['overlay', 'Superposition sur les miniatures'],
  ];

  /** Calcule les nouvelles métadonnées d'une vidéo pour une opération (null si inchangée). */
  function computeChange(v, op, ctx) {
    let title = v.title;
    let description = v.description;
    let tags = [...v.tags];
    let privacyStatus = null;
    if (op.type === 'replace') {
      if (op.fields.title) title = replaceIn(title, op.find, op.repl, op);
      if (op.fields.description) description = replaceIn(description, op.find, op.repl, op);
      if (op.fields.tags) tags = MT.seo.parseTagInput(tags.map((t) => replaceIn(t, op.find, op.repl, op)).join(','));
    } else if (op.type === 'append') {
      if (op.text && (!op.skipIfPresent || !description.includes(op.text.trim())))
        description = op.position === 'start' ? `${op.text}\n\n${description}` : `${description}\n\n${op.text}`;
    } else if (op.type === 'addTags') {
      const seen = new Set(tags.map(MT.text.normalize));
      const add = op.tags.filter((t) => !seen.has(MT.text.normalize(t)));
      tags = MT.seo.fitTags(op.position === 'start' ? [...add, ...tags] : [...tags, ...add]);
    } else if (op.type === 'removeTags') {
      const rm = new Set(op.tags.map(MT.text.normalize));
      tags = op.all ? [] : tags.filter((t) => !rm.has(MT.text.normalize(t)));
    } else if (op.type === 'setTags') {
      tags = MT.seo.fitTags(op.tags);
    } else if (op.type === 'copyTags') {
      tags = MT.seo.fitTags(op.mode === 'replace' ? ctx.sourceTags : [...tags, ...ctx.sourceTags.filter((t) => !tags.some((x) => MT.text.normalize(x) === MT.text.normalize(t)))]);
    } else if (op.type === 'profile') {
      const p = ctx.profile;
      const vars = { titre: v.title, mot_cle: v.tags[0] || '', date: fmt.date(v.publishedAt), resume: '', lien_chaine: '', hashtag1: '', hashtag2: '' };
      const text = MT.seo.fillTemplate(p.description || '', vars);
      if (text.trim() && !description.includes(text.trim())) description = op.mode === 'replace' ? text : `${description}\n\n${text}`;
      if (p.tags && p.tags.length) tags = MT.seo.fitTags([...tags, ...p.tags.filter((t) => !tags.some((x) => MT.text.normalize(x) === MT.text.normalize(t)))]);
    } else if (op.type === 'privacy') {
      if (op.privacy && op.privacy !== v.privacyStatus) privacyStatus = op.privacy;
    }
    title = title.slice(0, 100);
    description = description.slice(0, 5000);
    const changed = title !== v.title || description !== v.description || JSON.stringify(tags) !== JSON.stringify(v.tags) || privacyStatus;
    if (!changed) return null;
    return { title, description, tags, privacyStatus };
  }

  function diffCell(before, after) {
    if (before === after) return el('span', { class: 'mt-muted' }, '—');
    return el(
      'div',
      { class: 'mt-small' },
      el('div', { class: 'diff-del' }, String(before).slice(0, 140) || '(vide)'),
      el('div', { class: 'diff-add' }, String(after).slice(0, 140) || '(vide)')
    );
  }

  function tagsDiff(before, after) {
    const b = new Set(before.map(MT.text.normalize));
    const a = new Set(after.map(MT.text.normalize));
    const added = after.filter((t) => !b.has(MT.text.normalize(t)));
    const removed = before.filter((t) => !a.has(MT.text.normalize(t)));
    if (!added.length && !removed.length) return el('span', { class: 'mt-muted' }, before.join(',') === after.join(',') ? '—' : 'réordonnés');
    return el(
      'div',
      { class: 'mt-small' },
      added.length ? el('div', { class: 'diff-add' }, '+ ' + added.join(', ')) : null,
      removed.length ? el('div', { class: 'diff-del' }, '− ' + removed.join(', ')) : null
    );
  }

  /** Superpose une image ou un bandeau sur une miniature. */
  async function overlayThumb(videoId, op) {
    const base = await MT.thumbs.loadImage(await MT.thumbs.videoThumbDataUrl(videoId));
    const canvas = el('canvas', { width: 1280, height: 720 });
    const ctx = canvas.getContext('2d');
    const scale = Math.max(1280 / base.width, 720 / base.height);
    ctx.drawImage(base, (1280 - base.width * scale) / 2, (720 - base.height * scale) / 2, base.width * scale, base.height * scale);
    const margin = 30;
    if (op.mode === 'image' && op.image) {
      const img = await MT.thumbs.loadImage(op.image);
      const w = (1280 * op.size) / 100;
      const h = (w * img.height) / img.width;
      const x = op.corner.includes('right') ? 1280 - w - margin : margin;
      const y = op.corner.includes('bottom') ? 720 - h - margin : margin;
      ctx.drawImage(img, x, y, w, h);
    } else if (op.mode === 'text' && op.text) {
      const size = Math.round((720 * op.size) / 100);
      ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
      const tw = ctx.measureText(op.text).width + size;
      const th = size * 1.4;
      const x = op.corner.includes('right') ? 1280 - tw - margin : margin;
      const y = op.corner.includes('bottom') ? 720 - th - margin : margin;
      ctx.fillStyle = op.bg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, tw, th, 14);
      else ctx.rect(x, y, tw, th);
      ctx.fill();
      ctx.fillStyle = op.color;
      ctx.textBaseline = 'middle';
      ctx.fillText(op.text, x + size / 2, y + th / 2);
    }
    return MT.thumbs.canvasToBlob(canvas, 'image/jpeg');
  }

  function opForm(profiles) {
    const type = A.select(OPERATIONS, 'replace');
    const box = el('div', { style: 'margin-top:10px' });
    let read = () => ({});
    const draw = () => {
      const t = type.value;
      if (t === 'replace') {
        const find = A.input({ placeholder: 'Texte à rechercher' });
        const repl = A.input({ placeholder: 'Remplacer par (vide = supprimer)' });
        const fT = el('input', { type: 'checkbox' });
        const fD = el('input', { type: 'checkbox', checked: true });
        const fG = el('input', { type: 'checkbox' });
        const rx = el('input', { type: 'checkbox' });
        const cs = el('input', { type: 'checkbox' });
        MT.fill(
          box,
          el('div', { class: 'grid cols-2' }, A.field('Rechercher', find), A.field('Remplacer par', repl)),
          el(
            'div',
            { class: 'mt-row', style: 'gap:16px' },
            el('label', { class: 'mt-row', style: 'gap:4px' }, fT, 'Titres'),
            el('label', { class: 'mt-row', style: 'gap:4px' }, fD, 'Descriptions'),
            el('label', { class: 'mt-row', style: 'gap:4px' }, fG, 'Tags'),
            el('label', { class: 'mt-row', style: 'gap:4px' }, rx, 'Expression régulière'),
            el('label', { class: 'mt-row', style: 'gap:4px' }, cs, 'Respecter la casse')
          )
        );
        read = () => ({
          type: t,
          find: find.value,
          repl: repl.value,
          regex: rx.checked,
          caseSensitive: cs.checked,
          fields: { title: fT.checked, description: fD.checked, tags: fG.checked },
        });
      } else if (t === 'append') {
        const text = A.textarea({ rows: 5, placeholder: 'Texte à ajouter (liens, mentions, appel à l’action…)' });
        const pos = A.select(
          [
            ['end', 'À la fin'],
            ['start', 'Au début'],
          ],
          'end'
        );
        const skip = el('input', { type: 'checkbox', checked: true });
        MT.fill(
          box,
          A.field('Texte', text),
          el(
            'div',
            { class: 'mt-row', style: 'gap:16px' },
            el('div', { style: 'width:200px' }, pos),
            el('label', { class: 'mt-row', style: 'gap:4px' }, skip, 'Ignorer si déjà présent')
          )
        );
        read = () => ({ type: t, text: text.value, position: pos.value, skipIfPresent: skip.checked });
      } else if (t === 'addTags' || t === 'setTags') {
        const tags = A.tagEditor([]);
        const pos = A.select(
          [
            ['end', 'À la fin'],
            ['start', 'Au début (plus de poids)'],
          ],
          'end'
        );
        MT.fill(box, A.field('Tags', tags), t === 'addTags' ? A.field('Position', pos) : W.alert('Les tags existants seront entièrement remplacés.', 'warn'));
        read = () => ({ type: t, tags: tags.get(), position: pos.value });
      } else if (t === 'removeTags') {
        const tags = A.tagEditor([]);
        const all = el('input', { type: 'checkbox' });
        MT.fill(box, A.field('Tags à supprimer', tags), el('label', { class: 'mt-row', style: 'gap:4px' }, all, 'Supprimer tous les tags'));
        read = () => ({ type: t, tags: tags.get(), all: all.checked });
      } else if (t === 'copyTags') {
        const src = A.input({ placeholder: 'URL de la vidéo source (n’importe quelle vidéo publique)' });
        const mode = A.select(
          [
            ['add', 'Ajouter aux tags existants'],
            ['replace', 'Remplacer les tags'],
          ],
          'add'
        );
        MT.fill(box, el('div', { class: 'grid cols-2' }, A.field('Vidéo source', src), A.field('Mode', mode)));
        read = () => ({ type: t, source: MT.videoIdFromUrl(src.value), mode: mode.value });
      } else if (t === 'profile') {
        if (!profiles.length) MT.fill(box, W.alert('Créez d’abord un profil de mise en ligne.', 'warn'));
        else {
          const p = A.select(
            profiles.map((x) => [x.id, x.name]),
            profiles[0].id
          );
          const mode = A.select(
            [
              ['append', 'Ajouter à la description'],
              ['replace', 'Remplacer la description'],
            ],
            'append'
          );
          MT.fill(box, el('div', { class: 'grid cols-2' }, A.field('Profil', p), A.field('Description', mode)));
          read = () => ({ type: t, profileId: p.value, mode: mode.value });
        }
      } else if (t === 'privacy') {
        const p = A.select(
          [
            ['public', 'Publique'],
            ['unlisted', 'Non répertoriée'],
            ['private', 'Privée'],
          ],
          'unlisted'
        );
        MT.fill(box, A.field('Nouvelle visibilité', p), W.alert('Attention : rendre publiques plusieurs vidéos peut notifier vos abonnés.', 'warn'));
        read = () => ({ type: t, privacy: p.value });
      } else if (t === 'overlay') {
        const mode = A.select(
          [
            ['text', 'Bandeau de texte'],
            ['image', 'Image (logo, badge PNG)'],
          ],
          'text'
        );
        const text = A.input({ value: 'NOUVEAU', placeholder: 'Texte du bandeau' });
        const color = el('input', { type: 'color', value: '#ffffff' });
        const bg = el('input', { type: 'color', value: '#e5352b' });
        const corner = A.select(
          [
            ['top-left', 'Haut gauche'],
            ['top-right', 'Haut droite'],
            ['bottom-left', 'Bas gauche'],
            ['bottom-right', 'Bas droite'],
          ],
          'top-left'
        );
        const size = el('input', { type: 'range', min: 5, max: 40, value: 12, style: 'width:100%' });
        let image = null;
        const imgBtn = W.button(
          'Choisir l’image',
          async () => {
            image = await MT.thumbs.pickFile('image/png,image/*');
            if (image) W.toast('Image chargée', 'success');
          },
          { size: 'sm', icon: 'upload' }
        );
        MT.fill(
          box,
          el('div', { class: 'grid cols-3' }, A.field('Type', mode), A.field('Position', corner), A.field('Taille', size)),
          el('div', { class: 'grid cols-3' }, A.field('Texte', text), A.field('Couleur du texte', color), A.field('Fond', bg)),
          imgBtn,
          W.alert('YouTube exige une chaîne validée pour les miniatures personnalisées. Coût : 50 unités de quota par vidéo.', 'info')
        );
        read = () => ({ type: t, mode: mode.value, text: text.value, color: color.value, bg: bg.value, corner: corner.value, size: Number(size.value), image });
      }
    };
    type.addEventListener('change', draw);
    draw();
    const wrap = el('div', null, A.field('Opération', type), box);
    wrap.read = () => read();
    return wrap;
  }

  A.register('bulk', {
    title: 'Traitement en masse',
    icon: 'layers',
    group: 'manage',
    order: 1,
    oauth: true,
    description: 'Modifier titres, descriptions, tags et miniatures de plusieurs vidéos',
    async render(c) {
      c.appendChild(
        A.pageHead(
          'Traitement en masse',
          'Modifiez en une fois les métadonnées de nombreuses vidéos : rechercher/remplacer, ajout de liens, tags, profils, visibilité, bandeaux sur miniatures. Aperçu avant application et sauvegarde automatique pour annuler.',
          'layers'
        )
      );
      if (!(await A.oauthGate(c))) return;
      const profiles = await MT.store.list('profiles');
      const listBox = el('div');
      const prog = W.progress();
      MT.fill(listBox, W.spinner('Chargement de vos vidéos…'), prog);
      const opCard = opForm(profiles);
      const previewBox = el('div');
      const backups = await MT.store.list('bulkBackups');
      MT.add(
        c,
        el(
          'div',
          { class: 'stack' },
          A.card('1. Sélection des vidéos', listBox),
          A.card(
            '2. Opération',
            opCard,
            el(
              'div',
              { style: 'margin-top:10px' },
              W.button('Prévisualiser', () => preview(), { variant: 'primary', icon: 'search' })
            )
          ),
          previewBox,
          backups.length
            ? A.card(
                'Sauvegardes (annulation)',
                W.table(
                  [
                    { key: 't', label: 'Date', num: true, render: (b) => fmt.datetime(b.t) },
                    { key: 'label', label: 'Opération' },
                    { key: 'n', label: 'Vidéos', num: true, sort: (b) => b.items.length, render: (b) => String(b.items.length) },
                    {
                      key: 'a',
                      label: '',
                      sortable: false,
                      render: (b) =>
                        W.button(
                          'Restaurer',
                          async () => {
                            if (!(await W.confirm(`Restaurer les métadonnées de ${b.items.length} vidéo(s) telles qu’avant cette opération ?`))) return;
                            const auth = await A.auth();
                            const raws = await MT.ytapi.videos(
                              b.items.map((i) => i.videoId),
                              auth,
                              'snippet,status'
                            );
                            for (const r of raws) {
                              const item = b.items.find((i) => i.videoId === r.videoId);
                              await MT.ytapi.updateVideo(r.raw, { snippet: { title: item.title, description: item.description, tags: item.tags } }, auth);
                              await MT.sleep(250);
                            }
                            A.invalidateMyVideos();
                            W.toast('Métadonnées restaurées', 'success');
                          },
                          { size: 'sm', icon: 'refresh' }
                        ),
                    },
                  ],
                  backups,
                  { sortKey: 't' }
                )
              )
            : null
        )
      );
      let videos;
      try {
        videos = await A.loadMyVideos({ onProgress: (phase, d, t) => prog.set(d, t || d) });
      } catch (e) {
        MT.fill(listBox, W.alert(e.message, 'error'));
        return;
      }
      const selector = A.videoSelector(videos);
      MT.fill(listBox, selector);

      async function preview() {
        const selected = selector.getSelected();
        if (!selected.length) return W.toast('Sélectionnez au moins une vidéo', 'error');
        const op = opCard.read();
        const ctx = {};
        if (op.type === 'replace' && !op.find) return W.toast('Indiquez le texte à rechercher', 'error');
        if (op.type === 'replace' && op.regex) {
          try {
            new RegExp(op.find);
          } catch (e) {
            return W.toast('Expression régulière invalide', 'error');
          }
        }
        if (op.type === 'copyTags') {
          if (!op.source) return W.toast('Vidéo source invalide', 'error');
          ctx.sourceTags = await MT.yt.getVideoTags(op.source);
        }
        if (op.type === 'profile') ctx.profile = profiles.find((p) => p.id === op.profileId);
        if (op.type === 'overlay') {
          if (op.mode === 'image' && !op.image) return W.toast('Choisissez une image', 'error');
          const samples = await MT.pool(selected.slice(0, 6), 3, async (v) => URL.createObjectURL(await overlayThumb(v.videoId, op)));
          MT.fill(
            previewBox,
            A.card(
              `3. Aperçu (${Math.min(6, selected.length)} sur ${selected.length})`,
              el(
                'div',
                { class: 'grid cols-3' },
                samples.map((u) => (typeof u === 'string' ? el('img', { src: u, style: 'width:100%;border-radius:8px' }) : W.alert(u.error, 'error')))
              ),
              el(
                'div',
                { class: 'mt-row', style: 'margin-top:10px' },
                el('span', { class: 'mt-muted' }, `Quota estimé : ${selected.length * 50} unités`),
                W.button(
                  `Appliquer aux ${selected.length} miniatures`,
                  () =>
                    apply(
                      selected.map((v) => ({ v, thumb: true })),
                      op,
                      'Superposition miniatures'
                    ),
                  { variant: 'primary', icon: 'upload' }
                )
              )
            )
          );
          return;
        }
        const changes = selected.map((v) => ({ v, next: computeChange(v, op, ctx) })).filter((x) => x.next);
        const tooLong = changes.filter((x) => MT.seo.tagsLength(x.next.tags) > 500);
        MT.fill(
          previewBox,
          A.card(
            `3. Aperçu : ${changes.length} vidéo(s) modifiée(s) sur ${selected.length}`,
            changes.length
              ? W.table(
                  [
                    { key: 'v', label: 'Vidéo', sort: (x) => x.v.title, render: (x) => A.videoCell(x.v, { channel: false }) },
                    { key: 'title', label: 'Titre', sortable: false, render: (x) => diffCell(x.v.title, x.next.title) },
                    {
                      key: 'desc',
                      label: 'Description',
                      sortable: false,
                      render: (x) =>
                        x.v.description === x.next.description
                          ? el('span', { class: 'mt-muted' }, '—')
                          : el('span', { class: 'mt-small diff-add' }, `${x.v.description.length} → ${x.next.description.length} caractères`),
                    },
                    { key: 'tags', label: 'Tags', sortable: false, render: (x) => tagsDiff(x.v.tags, x.next.tags) },
                    {
                      key: 'p',
                      label: 'Visibilité',
                      sortable: false,
                      render: (x) => (x.next.privacyStatus ? `${A.PRIVACY[x.v.privacyStatus]} → ${A.PRIVACY[x.next.privacyStatus]}` : '—'),
                    },
                  ],
                  changes,
                  { maxHeight: '520px' }
                )
              : W.empty('Aucune vidéo ne serait modifiée par cette opération.'),
            tooLong.length ? W.alert(`${tooLong.length} vidéo(s) dépasseraient 500 caractères de tags : elles seront ignorées.`, 'warn') : null,
            changes.length
              ? el(
                  'div',
                  { class: 'mt-row', style: 'margin-top:10px' },
                  el('span', { class: 'mt-muted' }, `Quota estimé : ${changes.length * 50} unités (10 000 / jour)`),
                  W.button(
                    `Appliquer à ${changes.length} vidéo(s)`,
                    () =>
                      apply(
                        changes.filter((x) => !tooLong.includes(x)),
                        op,
                        OPERATIONS.find((o) => o[0] === op.type)[1]
                      ),
                    { variant: 'primary', icon: 'check' }
                  )
                )
              : null
          )
        );
      }

      async function apply(items, op, label) {
        if (!(await W.confirm(`Appliquer la modification à ${items.length} vidéo(s) sur YouTube ?`))) return;
        const auth = await A.auth();
        if (!items[0].thumb) {
          await MT.store.update('bulkBackups', (l) =>
            [
              { id: MT.uid(), t: Date.now(), label, items: items.map((x) => ({ videoId: x.v.videoId, title: x.v.title, description: x.v.description, tags: x.v.tags })) },
              ...(l || []),
            ].slice(0, 20)
          );
        }
        const prog2 = W.progress();
        const log = el('div', { class: 'mt-col', style: 'gap:2px;max-height:240px;overflow:auto;margin-top:8px' });
        MT.fill(previewBox, A.card('4. Application en cours…', prog2, log));
        let ok = 0;
        for (let i = 0; i < items.length; i++) {
          const { v, next, thumb } = items[i];
          try {
            if (thumb) await MT.ytapi.setThumbnail(v.videoId, await overlayThumb(v.videoId, op), auth);
            else
              await MT.ytapi.updateVideo(
                v.raw,
                {
                  snippet: { title: next.title, description: next.description, tags: next.tags },
                  ...(next.privacyStatus ? { status: { privacyStatus: next.privacyStatus } } : {}),
                },
                auth
              );
            ok++;
            log.appendChild(el('div', { class: 'mt-small' }, '✅ ', v.title));
          } catch (e) {
            log.appendChild(el('div', { class: 'mt-small', style: 'color:var(--mt-bad)' }, '❌ ', v.title, ' — ', e.message));
            if (/quota/i.test(e.message)) break;
          }
          prog2.set(i + 1, items.length);
          await MT.sleep(300);
        }
        A.invalidateMyVideos();
        previewBox.firstChild.querySelector('h3').textContent = `4. Terminé : ${ok}/${items.length} vidéo(s) mise(s) à jour`;
        W.toast(`${ok} vidéo(s) mise(s) à jour`, ok === items.length ? 'success' : 'error');
      }
    },
  });

  /* --------------------------------------------------------------- tests A/B */

  function testCard(t) {
    const st = { draft: 'Brouillon', running: 'En cours', paused: 'En pause', done: 'Terminé', error: 'Erreur' }[t.status] || t.status;
    const rates = t.variants.map((v) => (v.hours > 0 ? v.views / v.hours : null));
    const best = Math.max(...rates.filter((r) => r != null), 0);
    const elapsed = t.startedAt ? Math.min(1, (Date.now() - t.startedAt) / (t.endsAt - t.startedAt)) : 0;
    return A.card(
      el(
        'span',
        { class: 'mt-row', style: 'justify-content:space-between;width:100%' },
        el('span', null, `${{ title: 'Titre', thumbnail: 'Miniature', description: 'Description' }[t.type]} — ${t.videoTitle}`),
        el('span', { class: 'mt-chip' }, st)
      ),
      t.needsAuth ? W.alert('Reconnexion Google nécessaire pour poursuivre la rotation.', 'warn') : null,
      t.error ? W.alert(t.error, 'error') : null,
      el('div', { style: 'margin:6px 0 10px' }, W.meter('Progression', elapsed * 100, { text: t.status === 'done' ? 'Terminé' : `fin le ${fmt.datetime(t.endsAt)}` })),
      W.table(
        [
          {
            key: 'label',
            label: 'Variante',
            render: (v) =>
              el('strong', null, v.label, t.status !== 'done' && t.variants.indexOf(v) === t.currentIndex ? ' (active)' : '', t.winnerIndex === t.variants.indexOf(v) ? ' 🏆' : ''),
          },
          {
            key: 'value',
            label: 'Contenu',
            sortable: false,
            render: (v) =>
              t.type === 'thumbnail' ? el('img', { src: v.image, style: 'width:120px;border-radius:6px' }) : el('span', { class: 'mt-small' }, String(v.value).slice(0, 120)),
          },
          { key: 'views', label: 'Vues', num: true, render: (v) => fmt.int(v.views || 0) },
          { key: 'hours', label: 'Heures actives', num: true, render: (v) => fmt.dec(v.hours || 0) },
          {
            key: 'rate',
            label: 'Vues / heure',
            num: true,
            sort: (v) => (v.hours ? v.views / v.hours : null),
            render: (v) => {
              const r = v.hours ? v.views / v.hours : null;
              return r == null ? '—' : el('strong', { style: { color: r === best && best > 0 ? 'var(--mt-great)' : 'inherit' } }, fmt.dec(r, 2));
            },
          },
        ],
        t.variants
      ),
      el(
        'div',
        { class: 'mt-row', style: 'margin-top:10px' },
        t.status === 'running' ? el('span', { class: 'mt-muted mt-small' }, `Prochaine rotation : ${fmt.datetime(t.nextSwitchAt)}`) : null,
        t.status === 'running'
          ? W.button(
              'Rotation maintenant',
              async () => {
                await A.auth();
                await MT.send('ab.advance', { id: t.id });
                A.render();
              },
              { size: 'sm', icon: 'refresh' }
            )
          : null,
        t.status === 'running'
          ? W.button(
              'Terminer et appliquer le gagnant',
              async () => {
                if (await W.confirm('Terminer le test et appliquer la meilleure variante ?')) {
                  await A.auth();
                  await MT.send('ab.advance', { id: t.id, finish: true });
                  A.render();
                }
              },
              { size: 'sm', icon: 'trophy' }
            )
          : null,
        t.status === 'running'
          ? W.button(
              'Pause',
              async () => {
                await MT.store.update('abTests', (l) => l.map((x) => (x.id === t.id ? { ...x, status: 'paused', pausedAt: Date.now() } : x)));
                A.render();
              },
              { size: 'sm', variant: 'ghost', busy: false }
            )
          : null,
        t.status === 'paused'
          ? W.button(
              'Reprendre',
              async () => {
                await MT.store.update('abTests', (l) =>
                  l.map((x) =>
                    x.id === t.id
                      ? {
                          ...x,
                          status: 'running',
                          lastSwitchAt: Date.now(),
                          endsAt: x.endsAt + (Date.now() - (x.pausedAt || Date.now())),
                          nextSwitchAt: Date.now() + x.intervalHours * HOUR,
                        }
                      : x
                  )
                );
                A.render();
              },
              { size: 'sm', busy: false }
            )
          : null,
        W.button(
          'Supprimer',
          async () => {
            if (await W.confirm('Supprimer ce test ? (la vidéo garde sa variante actuelle)', { danger: true })) {
              await MT.store.remove('abTests', t.id);
              A.render();
            }
          },
          { size: 'sm', variant: 'ghost danger', icon: 'trash', busy: false }
        )
      ),
      t.log && t.log.length
        ? el(
            'details',
            { style: 'margin-top:8px' },
            el('summary', { class: 'mt-small' }, 'Journal'),
            el(
              'div',
              { class: 'mt-small mt-muted' },
              [...t.log].reverse().map((l) => el('div', null, `${fmt.datetime(l.t)} — ${l.msg}`))
            )
          )
        : null
    );
  }

  A.register('abtests', {
    title: 'Tests A/B',
    icon: 'flask',
    group: 'manage',
    order: 2,
    oauth: true,
    description: 'Comparer titres, miniatures ou descriptions',
    async render(c) {
      c.appendChild(
        A.pageHead(
          'Tests A/B',
          'Alternez automatiquement plusieurs titres, miniatures ou descriptions sur une vidéo et mesurez laquelle génère le plus de vues par heure. Le gagnant est appliqué à la fin du test.',
          'flask'
        )
      );
      if (!(await A.oauthGate(c))) return;
      const tests = await MT.store.list('abTests');
      const draftImages = (await MT.store.get('abDraftImages', [])) || [];
      const form = el('div');
      const newTest = async () => {
        const videos = await A.loadMyVideos();
        let picked = null;
        const type = A.select(
          [
            ['title', 'Titre'],
            ['thumbnail', 'Miniature'],
            ['description', 'Description'],
          ],
          draftImages.length ? 'thumbnail' : 'title'
        );
        const interval = A.select(
          [
            ['12', 'Toutes les 12 h'],
            ['24', 'Toutes les 24 h (recommandé)'],
            ['48', 'Toutes les 48 h'],
          ],
          '24'
        );
        const duration = A.select(
          [
            ['7', '7 jours'],
            ['14', '14 jours (recommandé)'],
            ['21', '21 jours'],
            ['28', '28 jours'],
          ],
          '14'
        );
        const variantsBox = el('div');
        let variantInputs = [];
        const drawVariants = () => {
          variantInputs = [];
          const t = type.value;
          const rows = [];
          for (const label of ['B', 'C', 'D']) {
            if (t === 'thumbnail') {
              const holder = { label, image: draftImages[['B', 'C', 'D'].indexOf(label)] || null };
              const preview = el(
                'div',
                null,
                holder.image ? el('img', { src: holder.image, style: 'width:160px;border-radius:6px' }) : el('span', { class: 'mt-muted mt-small' }, 'aucune image')
              );
              rows.push(
                el(
                  'div',
                  { class: 'mt-row', style: 'margin-bottom:8px' },
                  el('strong', { style: 'width:20px' }, label),
                  preview,
                  W.button(
                    'Image…',
                    async () => {
                      const d = await MT.thumbs.pickFile();
                      if (d) {
                        holder.image = d;
                        MT.fill(preview, el('img', { src: d, style: 'width:160px;border-radius:6px' }));
                      }
                    },
                    { size: 'sm', icon: 'upload' }
                  )
                )
              );
              variantInputs.push(holder);
            } else {
              const inp =
                t === 'title'
                  ? A.input({ placeholder: `Variante ${label}${label === 'B' ? '' : ' (facultative)'}`, maxlength: 100 })
                  : A.textarea({ rows: 4, placeholder: `Description ${label}${label === 'B' ? '' : ' (facultative)'}` });
              rows.push(A.field('Variante ' + label, inp));
              variantInputs.push({ label, input: inp });
            }
          }
          MT.fill(
            variantsBox,
            el('p', { class: 'mt-small mt-muted', style: 'margin-top:0' }, 'La variante A est la version actuelle de la vidéo.'),
            rows,
            t === 'thumbnail' ? el('p', { class: 'mt-small mt-muted' }, 'Astuce : créez vos variantes dans l’éditeur de miniatures (bouton « Variante de test A/B »).') : null
          );
        };
        type.addEventListener('change', drawVariants);
        drawVariants();
        MT.fill(
          form,
          A.card(
            'Nouveau test',
            A.field(
              'Vidéo',
              A.videoSelector(
                videos.filter((v) => v.privacyStatus === 'public'),
                { multi: false, onChange: (v) => (picked = v[0] || null) }
              )
            ),
            el('div', { class: 'grid cols-3' }, A.field('Élément testé', type), A.field('Rotation', interval), A.field('Durée', duration)),
            variantsBox,
            W.button(
              'Démarrer le test',
              async () => {
                if (!picked) return W.toast('Choisissez une vidéo', 'error');
                const t = type.value;
                const auth = await A.auth();
                const [fresh] = await MT.ytapi.videos([picked.videoId], auth, 'snippet,statistics,status');
                let original;
                if (t === 'thumbnail') original = await A.imageToDataUrl(fresh.thumbnail || MT.thumbUrl(picked.videoId, 'hqdefault')).catch(() => null);
                else original = t === 'title' ? fresh.title : fresh.description;
                if (t === 'thumbnail' && !original) throw new Error('Impossible de récupérer la miniature actuelle.');
                const others = variantInputs
                  .map((x) => (t === 'thumbnail' ? x.image && { label: x.label, image: x.image } : x.input.value.trim() && { label: x.label, value: x.input.value.trim() }))
                  .filter(Boolean);
                if (!others.length) return W.toast('Ajoutez au moins une variante B', 'error');
                const now = Date.now();
                const test = {
                  id: MT.uid(),
                  videoId: picked.videoId,
                  videoTitle: fresh.title,
                  type: t,
                  variants: [
                    { label: 'A', ...(t === 'thumbnail' ? { image: original } : { value: original }), views: 0, hours: 0, periods: 0 },
                    ...others.map((o) => ({ ...o, views: 0, hours: 0, periods: 0 })),
                  ],
                  intervalHours: Number(interval.value),
                  status: 'running',
                  currentIndex: 0,
                  startedAt: now,
                  endsAt: now + Number(duration.value) * 86400000,
                  lastSwitchAt: now,
                  nextSwitchAt: now + Number(interval.value) * HOUR,
                  lastViews: fresh.views || 0,
                  log: [{ t: now, msg: `Test démarré (variante A active, ${fmt.int(fresh.views)} vues).` }],
                };
                await MT.store.upsert('abTests', test);
                if (t === 'thumbnail') await MT.store.set('abDraftImages', []);
                W.toast('Test démarré', 'success');
                A.render();
              },
              { variant: 'primary', icon: 'play' }
            )
          )
        );
      };
      MT.add(
        c,
        el('div', { class: 'mt-row', style: 'margin-bottom:12px' }, W.button('Nouveau test', newTest, { variant: 'primary', icon: 'plus' })),
        form,
        el(
          'div',
          { class: 'stack', style: 'margin-top:16px' },
          tests.length ? [...tests].sort((a, b) => b.startedAt - a.startedAt).map(testCard) : A.card(null, W.empty('Aucun test pour le moment.'))
        ),
        A.card(
          'Comment ça marche ?',
          el(
            'ul',
            { class: 'help-list' },
            el('li', null, 'Les variantes sont activées à tour de rôle (même durée pour chacune) ; les vues gagnées pendant chaque période sont attribuées à la variante active.'),
            el(
              'li',
              null,
              'Le gagnant est la variante avec le plus de vues par heure. L’API YouTube ne fournit pas le taux de clics des impressions : préférez des tests de 14 jours pour lisser les variations selon le jour.'
            ),
            el('li', null, 'Les rotations s’effectuent quand Firefox est ouvert (vérification toutes les 15 minutes). Coût : 50 unités de quota par rotation.')
          )
        )
      );
      if (draftImages.length) newTest();
    },
  });

  /* ------------------------------------------------ mises à jour programmées */

  A.register('scheduled', {
    title: 'Mises à jour programmées',
    icon: 'calendar',
    group: 'manage',
    order: 3,
    oauth: true,
    description: 'Changer titre, description, tags ou visibilité à une date',
    async render(c) {
      c.appendChild(
        A.pageHead(
          'Mises à jour programmées',
          'Programmez un changement de titre, de description, de tags, de miniature ou de visibilité (ex. retirer « EN DIRECT » du titre, ajouter un lien vers la suite, passer en public).',
          'calendar'
        )
      );
      if (!(await A.oauthGate(c))) return;
      const items = await MT.store.list('scheduled');
      const form = el('div');
      const open = async () => {
        const videos = await A.loadMyVideos();
        let picked = null;
        const when = A.input({ type: 'datetime-local', value: new Date(Date.now() + 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) });
        const title = A.input({ placeholder: 'Nouveau titre (vide = inchangé)', maxlength: 100 });
        const descMode = A.select(
          [
            ['none', 'Inchangée'],
            ['replace', 'Remplacer'],
            ['append', 'Ajouter à la fin'],
          ],
          'none'
        );
        const desc = A.textarea({ rows: 4, placeholder: 'Texte de la description' });
        const tags = A.tagEditor([]);
        const privacy = A.select(
          [
            ['', 'Inchangée'],
            ['public', 'Publique'],
            ['unlisted', 'Non répertoriée'],
            ['private', 'Privée'],
          ],
          ''
        );
        let thumb = null;
        const thumbLbl = el('span', { class: 'mt-muted mt-small' }, 'aucune');
        MT.fill(
          form,
          A.card(
            'Nouvelle mise à jour',
            A.field('Vidéo', A.videoSelector(videos, { multi: false, onChange: (v) => (picked = v[0] || null) })),
            el('div', { class: 'grid cols-2' }, A.field('Date et heure', when), A.field('Visibilité', privacy)),
            A.field('Titre', title),
            el('div', { class: 'grid cols-2' }, A.field('Description', descMode), el('div')),
            desc,
            A.field('Tags (remplacent les actuels si renseignés)', tags),
            A.field(
              'Miniature',
              el(
                'div',
                { class: 'mt-row' },
                W.button(
                  'Choisir…',
                  async () => {
                    thumb = await MT.thumbs.pickFile();
                    thumbLbl.textContent = thumb ? 'image choisie' : 'aucune';
                  },
                  { size: 'sm', icon: 'upload' }
                ),
                thumbLbl
              )
            ),
            W.button(
              'Programmer',
              async () => {
                if (!picked) return W.toast('Choisissez une vidéo', 'error');
                const at = new Date(when.value).getTime();
                if (!at || at < Date.now() - 60000) return W.toast('Date invalide ou passée', 'error');
                const changes = {
                  title: title.value.trim() || null,
                  description: descMode.value === 'replace' ? desc.value : null,
                  appendDescription: descMode.value === 'append' ? desc.value : null,
                  tags: tags.get().length ? tags.get() : null,
                  privacyStatus: privacy.value || null,
                  thumbnail: thumb,
                };
                if (!Object.values(changes).some(Boolean)) return W.toast('Aucun changement défini', 'error');
                await MT.store.upsert('scheduled', { id: MT.uid(), videoId: picked.videoId, videoTitle: picked.title, at, changes, status: 'pending', createdAt: Date.now() });
                W.toast('Mise à jour programmée', 'success');
                A.render();
              },
              { variant: 'primary', icon: 'clock' }
            )
          )
        );
      };
      const describe = (ch) =>
        [
          ch.title && `Titre → « ${ch.title} »`,
          ch.description != null && ch.description !== '' && 'Description remplacée',
          ch.appendDescription && 'Texte ajouté à la description',
          ch.tags && `${ch.tags.length} tags`,
          ch.privacyStatus && `Visibilité → ${A.PRIVACY[ch.privacyStatus]}`,
          ch.thumbnail && 'Nouvelle miniature',
        ]
          .filter(Boolean)
          .join(' · ');
      MT.add(
        c,
        el('div', { class: 'mt-row', style: 'margin-bottom:12px' }, W.button('Nouvelle mise à jour', open, { variant: 'primary', icon: 'plus' })),
        form,
        el('div', { style: 'height:16px' }),
        A.card(
          'Planning',
          W.table(
            [
              { key: 'at', label: 'Date', num: true, render: (u) => fmt.datetime(u.at) },
              { key: 'videoTitle', label: 'Vidéo', render: (u) => A.videoCell({ videoId: u.videoId, title: u.videoTitle }, { channel: false }) },
              { key: 'changes', label: 'Changements', sortable: false, render: (u) => el('span', { class: 'mt-small' }, describe(u.changes)) },
              {
                key: 'status',
                label: 'Statut',
                render: (u) =>
                  u.status === 'done'
                    ? `✅ ${fmt.datetime(u.doneAt)}`
                    : u.status === 'error'
                      ? el('span', { style: 'color:var(--mt-bad)', title: u.error }, '❌ ' + u.error)
                      : u.needsAuth
                        ? '🔑 reconnexion requise'
                        : '⏳ en attente',
              },
              {
                key: 'a',
                label: '',
                sortable: false,
                render: (u) =>
                  el(
                    'span',
                    { class: 'mt-row', style: 'gap:2px;flex-wrap:nowrap' },
                    u.status === 'pending'
                      ? W.button(
                          '',
                          async () => {
                            await MT.research.applyChanges(u.videoId, u.changes, await A.auth());
                            await MT.store.update('scheduled', (l) => l.map((x) => (x.id === u.id ? { ...x, status: 'done', doneAt: Date.now() } : x)));
                            W.toast('Appliquée', 'success');
                            A.render();
                          },
                          { size: 'sm', variant: 'ghost', icon: 'play', title: 'Appliquer maintenant' }
                        )
                      : null,
                    W.button(
                      '',
                      async () => {
                        await MT.store.remove('scheduled', u.id);
                        A.render();
                      },
                      { size: 'sm', variant: 'ghost danger', icon: 'trash', busy: false }
                    )
                  ),
              },
            ],
            items,
            { sortKey: 'at', sortDir: 'asc', empty: 'Aucune mise à jour programmée.' }
          ),
          el(
            'p',
            { class: 'mt-small mt-muted' },
            'Les mises à jour sont appliquées dans les 5 minutes suivant l’heure prévue, si Firefox est ouvert (sinon dès sa prochaine ouverture).'
          )
        )
      );
    },
  });
})();
