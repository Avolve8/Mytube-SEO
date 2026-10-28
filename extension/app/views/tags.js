/* MyTube SEO — vues : outils de tags (générateur, trieur, listes, traduction, compteur), traducteur de métadonnées. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  /* ----------------------------------------------------------- générateur */

  function generatorTab(c) {
    const kw = A.input({ placeholder: 'Mot-clé principal' });
    const title = A.input({ placeholder: 'Titre de la vidéo (facultatif)' });
    const out = el('div', { style: 'margin-top:12px' });
    const generate = async () => {
      const k = kw.value.trim();
      if (!k) return W.toast('Saisissez un mot-clé', 'error');
      const prog = W.progress();
      MT.fill(out, W.spinner('Recherche des tags (autocomplétion, longue traîne, concurrents)…'), prog);
      const [analysis, longTail] = await Promise.all([MT.research.analyzeKeyword(k), MT.research.longTail(k, { onProgress: (d, t) => prog.set(d, t) })]);
      const top = await MT.research.topTags(analysis.videos, { limit: 10 });
      const sug = MT.seo.suggestTags({
        title: title.value,
        keyword: k,
        related: [...analysis.related, ...longTail.slice(0, 25).map((x) => x.keyword)],
        competitorTags: top.tags,
        limit: 60,
      });
      const selected = new Set(MT.seo.fitTags(sug.map((x) => x.tag)));
      const listBox = el('div');
      const counter = el('div', { class: 'counter' });
      const draw = () => {
        const chosen = sug.filter((x) => selected.has(x.tag)).map((x) => x.tag);
        const len = MT.seo.tagsLength(chosen);
        counter.textContent = `${chosen.length} sélectionnés · ${len}/500 caractères`;
        counter.classList.toggle('over', len > 500);
        MT.fill(
          listBox,
          W.table(
            [
              {
                key: 'sel',
                label: '',
                sortable: false,
                width: '30px',
                render: (x) =>
                  el('input', {
                    type: 'checkbox',
                    checked: selected.has(x.tag),
                    onchange: (e) => {
                      e.target.checked ? selected.add(x.tag) : selected.delete(x.tag);
                      draw();
                    },
                  }),
              },
              { key: 'tag', label: 'Tag' },
              { key: 'score', label: 'Pertinence', num: true, render: (x) => String(Math.round(x.score)) },
              { key: 'sources', label: 'Sources', render: (x) => x.sources.join(', ') },
            ],
            sug,
            { sortKey: 'score', maxHeight: '480px' }
          )
        );
      };
      draw();
      MT.fill(
        out,
        listBox,
        counter,
        el(
          'div',
          { class: 'mt-row', style: 'margin-top:8px' },
          W.copyButton(
            () =>
              sug
                .filter((x) => selected.has(x.tag))
                .map((x) => x.tag)
                .join(', '),
            'Copier la sélection',
            { size: 'md' }
          ),
          W.button(
            'Enregistrer en liste',
            async () => {
              await MT.store.upsert('tagLists', { id: MT.uid(), name: k, tags: sug.filter((x) => selected.has(x.tag)).map((x) => x.tag), createdAt: Date.now() });
              W.toast('Liste enregistrée', 'success');
            },
            { icon: 'list' }
          )
        )
      );
    };
    kw.addEventListener('keydown', (e) => e.key === 'Enter' && generate());
    MT.add(
      c,
      el('div', { class: 'grid cols-2' }, A.field('Mot-clé', kw), A.field('Titre', title)),
      W.button('Générer des tags', generate, { variant: 'primary', icon: 'bolt' }),
      out
    );
  }

  /* -------------------------------------------------------------- trieur */

  function sorterTab(c) {
    const input = A.textarea({ rows: 6, placeholder: 'Collez vos tags séparés par des virgules ou des retours à la ligne' });
    const kw = A.input({ placeholder: 'Mot-clé principal' });
    const title = A.input({ placeholder: 'Titre (facultatif, améliore le tri)' });
    const mode = A.select(
      [
        ['relevance', 'Pertinence (recommandé)'],
        ['length', 'Longueur'],
        ['alpha', 'Alphabétique'],
        ['reverse', 'Inverser'],
      ],
      'relevance'
    );
    const out = el('div');
    const run = () => {
      const sorted = MT.seo.sortTags(MT.seo.parseTagInput(input.value), { keyword: kw.value, title: title.value }, mode.value);
      MT.fill(
        out,
        el(
          'ol',
          { style: 'columns:2;margin:10px 0' },
          sorted.map((t) => el('li', null, t))
        ),
        el(
          'div',
          { class: 'mt-row' },
          W.copyButton(() => sorted.join(', '), 'Copier les tags triés', { size: 'md' }),
          el('span', { class: 'mt-muted' }, `${sorted.length} tags · ${MT.seo.tagsLength(sorted)}/500`)
        )
      );
    };
    MT.add(
      c,
      A.field('Tags', input),
      el('div', { class: 'grid cols-3' }, A.field('Mot-clé', kw), A.field('Titre', title), A.field('Tri', mode)),
      W.button('Trier', run, { variant: 'primary', icon: 'sort', busy: false }),
      out
    );
  }

  /* -------------------------------------------------------------- listes */

  async function listsTab(c) {
    const lists = await MT.store.list('tagLists');
    const edit = (list) => {
      const name = A.input({ value: list ? list.name : '', placeholder: 'Nom de la liste' });
      const editor = A.tagEditor(list ? list.tags : []);
      W.modal(list ? 'Modifier la liste' : 'Nouvelle liste de tags', el('div', null, A.field('Nom', name), A.field('Tags', editor)), {
        actions: [
          { label: 'Annuler', onClick: () => true },
          {
            label: 'Enregistrer',
            variant: 'primary',
            onClick: async () => {
              if (!name.value.trim()) {
                W.toast('Donnez un nom à la liste', 'error');
                return false;
              }
              await MT.store.upsert('tagLists', { id: list ? list.id : MT.uid(), name: name.value.trim(), tags: editor.get(), createdAt: list ? list.createdAt : Date.now() });
              A.render();
              return true;
            },
          },
        ],
      });
    };
    MT.add(
      c,
      el(
        'div',
        { class: 'mt-row', style: 'margin-bottom:10px' },
        W.button('Nouvelle liste', () => edit(null), { variant: 'primary', icon: 'plus', busy: false })
      ),
      W.table(
        [
          { key: 'name', label: 'Liste' },
          { key: 'count', label: 'Tags', num: true, sort: (l) => l.tags.length, render: (l) => String(l.tags.length) },
          { key: 'chars', label: 'Caractères', num: true, sort: (l) => MT.seo.tagsLength(l.tags), render: (l) => `${MT.seo.tagsLength(l.tags)}/500` },
          { key: 'preview', label: 'Aperçu', render: (l) => el('span', { class: 'mt-small mt-muted' }, l.tags.slice(0, 6).join(', ') + (l.tags.length > 6 ? '…' : '')) },
          {
            key: 'act',
            label: '',
            sortable: false,
            render: (l) =>
              el(
                'span',
                { class: 'mt-row', style: 'gap:4px;flex-wrap:nowrap' },
                W.copyButton(() => l.tags.join(', '), '', { variant: 'ghost', title: 'Copier' }),
                W.button('', () => edit(l), { size: 'sm', variant: 'ghost', icon: 'edit', title: 'Modifier', busy: false }),
                W.button(
                  '',
                  async () => {
                    if (await W.confirm(`Supprimer « ${l.name} » ?`, { danger: true })) {
                      await MT.store.remove('tagLists', l.id);
                      A.render();
                    }
                  },
                  { size: 'sm', variant: 'ghost danger', icon: 'trash', title: 'Supprimer', busy: false }
                )
              ),
          },
        ],
        lists,
        { sortKey: 'name', sortDir: 'asc', empty: 'Aucune liste. Enregistrez des tags depuis Videolytics, l’explorateur ou le générateur.' }
      )
    );
  }

  /* ----------------------------------------------------------- traduction */

  function languagePicker(selected = ['en', 'es', 'de']) {
    const set = new Set(selected);
    const box = el(
      'div',
      { class: 'mt-row', style: 'gap:10px 16px' },
      MT.translate.LANGUAGES.filter((l) => l.code !== 'fr').map((l) => A.checkbox(l.name, set.has(l.code), (on) => (on ? set.add(l.code) : set.delete(l.code))))
    );
    box.get = () => MT.translate.LANGUAGES.filter((l) => set.has(l.code));
    return box;
  }

  function tagTranslatorTab(c) {
    const input = A.textarea({ rows: 5, placeholder: 'Tags à traduire (virgules ou retours à la ligne)' });
    const langs = languagePicker();
    const out = el('div', { class: 'stack', style: 'margin-top:12px' });
    MT.add(
      c,
      A.field('Tags', input),
      A.field('Langues', langs),
      W.button(
        'Traduire',
        async () => {
          const tags = MT.seo.parseTagInput(input.value);
          if (!tags.length) return W.toast('Saisissez des tags', 'error');
          MT.fill(out, W.spinner('Traduction…'));
          const results = [];
          for (const l of langs.get()) results.push({ lang: l, tags: await MT.translate.translateTags(tags, l.code) });
          const all = [...new Set([...tags, ...results.flatMap((r) => r.tags)])];
          MT.fill(
            out,
            results.map((r) =>
              A.card(
                r.lang.name,
                W.chips(r.tags),
                el(
                  'div',
                  { style: 'margin-top:6px' },
                  W.copyButton(() => r.tags.join(', '), 'Copier')
                )
              )
            ),
            A.card(
              'Toutes langues (≤ 500 caractères)',
              W.chips(MT.seo.fitTags(all)),
              el(
                'div',
                { style: 'margin-top:6px' },
                W.copyButton(() => MT.seo.fitTags(all).join(', '), 'Copier')
              )
            )
          );
        },
        { variant: 'primary', icon: 'translate' }
      ),
      out
    );
  }

  function counterTab(c) {
    const input = A.textarea({ rows: 6, placeholder: 'Collez vos tags (séparés par des virgules)' });
    const out = el('div', { style: 'margin-top:10px' });
    const run = () => {
      const raw = String(input.value)
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const uniq = MT.seo.parseTagInput(input.value);
      const len = MT.seo.tagsLength(uniq);
      const tooLong = uniq.filter((t) => t.length > 100);
      MT.fill(
        out,
        W.stats([
          { label: 'Tags', value: uniq.length },
          { label: 'Caractères (méthode YouTube)', value: `${len}/500` },
          { label: 'Doublons retirés', value: raw.length - uniq.length },
          { label: 'Restant', value: Math.max(0, 500 - len) },
        ]),
        len > 500 ? el('div', { style: 'margin-top:8px' }, W.alert('Limite dépassée : YouTube refusera l’enregistrement.', 'error')) : null,
        tooLong.length ? el('div', { style: 'margin-top:8px' }, W.alert(`Tags de plus de 100 caractères : ${tooLong.join(', ')}`, 'warn')) : null,
        el(
          'div',
          { class: 'mt-row', style: 'margin-top:8px' },
          W.copyButton(() => uniq.join(', '), 'Copier sans doublons'),
          W.copyButton(() => MT.seo.fitTags(uniq).join(', '), 'Copier (≤ 500 car.)')
        )
      );
    };
    input.addEventListener('input', MT.debounce(run, 200));
    MT.add(c, input, el('p', { class: 'mt-small mt-muted' }, 'YouTube compte les guillemets ajoutés autour des tags contenant des espaces ainsi que les virgules.'), out);
    run();
  }

  A.register('tags', {
    title: 'Outils de tags',
    icon: 'tag',
    group: 'research',
    order: 3,
    description: 'Générateur, trieur, listes, traduction, compteur',
    render(c, params) {
      MT.add(
        c,
        A.pageHead('Outils de tags', 'Générez, triez, traduisez et organisez vos tags en listes réutilisables.', 'tag'),
        A.card(
          null,
          W.tabs(
            [
              { id: 'gen', label: 'Générateur', render: generatorTab },
              { id: 'sort', label: 'Trieur', render: sorterTab },
              { id: 'lists', label: 'Listes de tags', render: listsTab },
              { id: 'translate', label: 'Traduction', render: tagTranslatorTab },
              { id: 'count', label: 'Compteur', render: counterTab },
            ],
            { initial: params.tab || 'gen' }
          )
        )
      );
    },
  });

  /* --------------------------------------------- traducteur de métadonnées */

  A.register('translator', {
    title: 'Traducteur',
    icon: 'translate',
    group: 'research',
    order: 5,
    description: 'Traduire titre et description, appliquer les localisations',
    async render(c) {
      const s = await MT.store.getSettings();
      const title = A.input({ placeholder: 'Titre original' });
      const desc = A.textarea({ rows: 8, placeholder: 'Description originale' });
      const srcLang = A.select(
        MT.translate.LANGUAGES.map((l) => [l.yt, l.name]),
        'fr'
      );
      const engine = A.select(
        [
          ['google', 'Google Traduction (gratuit)'],
          ['claude', 'Claude (clé API requise)'],
        ],
        s.translateEngine || 'google'
      );
      const langs = languagePicker();
      const out = el('div', { class: 'stack', style: 'margin-top:16px' });
      let video = null;
      const videoLabel = el('span', { class: 'mt-muted' }, 'Saisie manuelle');
      let results = [];

      const pick = async () => {
        if (!(await MT.oauth.status()).connected) return W.toast('Connectez votre compte Google pour charger vos vidéos', 'error');
        const videos = await A.loadMyVideos();
        let picked = [];
        W.modal('Choisir une vidéo', A.videoSelector(videos, { multi: false, onChange: (v) => (picked = v) }), {
          width: '900px',
          actions: [
            { label: 'Annuler', onClick: () => true },
            {
              label: 'Choisir',
              variant: 'primary',
              onClick: () => {
                video = picked[0];
                if (!video) return false;
                title.value = video.title;
                desc.value = video.description;
                if (video.defaultLanguage) srcLang.value = video.defaultLanguage;
                videoLabel.textContent = `Vidéo : ${video.title}`;
                return true;
              },
            },
          ],
        });
      };

      const run = async () => {
        if (!title.value.trim()) return W.toast('Saisissez au moins un titre', 'error');
        results = [];
        const prog = W.progress();
        MT.fill(out, W.spinner('Traduction en cours…'), prog);
        const list = langs.get();
        for (let i = 0; i < list.length; i++) {
          const l = list[i];
          const [t, d] = await Promise.all([
            MT.translate.translate(title.value, l.code, { engine: engine.value }),
            desc.value.trim() ? MT.translate.translate(desc.value, l.code, { engine: engine.value }) : '',
          ]);
          results.push({ lang: l, title: A.input({ value: t.slice(0, 100) }), desc: A.textarea({ rows: 6, value: d.slice(0, 5000) }) });
          prog.set(i + 1, list.length);
        }
        MT.fill(
          out,
          results.map((r) => A.card(`${r.lang.name} (${r.lang.yt})`, A.field('Titre', r.title), A.counter(r.title, 100), A.field('Description', r.desc))),
          A.card(
            'Appliquer',
            el(
              'div',
              { class: 'mt-row' },
              W.button(
                'Appliquer à la vidéo YouTube',
                async () => {
                  if (!video) return W.toast('Choisissez d’abord une de vos vidéos (bouton « Mes vidéos »)', 'error');
                  const localizations = {};
                  for (const r of results) localizations[r.lang.yt] = { title: r.title.value, description: r.desc.value };
                  await MT.ytapi.updateVideo(video.raw, { snippet: { defaultLanguage: srcLang.value }, localizations, defaultLanguage: srcLang.value }, await A.auth());
                  A.invalidateMyVideos();
                  W.toast(`${results.length} traduction(s) publiée(s) sur YouTube`, 'success');
                },
                { variant: 'primary', icon: 'upload' }
              ),
              W.button(
                'Exporter JSON',
                () =>
                  MT.download(
                    'traductions.json',
                    JSON.stringify(Object.fromEntries(results.map((r) => [r.lang.yt, { title: r.title.value, description: r.desc.value }])), null, 2),
                    'application/json'
                  ),
                { icon: 'download', busy: false }
              )
            ),
            el(
              'p',
              { class: 'mt-small mt-muted' },
              'Les spectateurs dont YouTube est réglé dans ces langues verront le titre et la description traduits (coût : 50 unités de quota).'
            )
          )
        );
      };

      MT.add(
        c,
        A.pageHead(
          'Traducteur de métadonnées',
          'Traduisez titre et description dans plusieurs langues et publiez-les comme localisations YouTube pour toucher une audience internationale.',
          'translate',
          W.button('Mes vidéos', pick, { icon: 'list' })
        ),
        A.card(
          null,
          el('div', { style: 'margin-bottom:8px' }, videoLabel),
          A.field('Titre', title),
          A.field('Description', desc),
          el('div', { class: 'grid cols-2' }, A.field('Langue d’origine', srcLang), A.field('Moteur', engine)),
          A.field('Traduire vers', langs),
          W.button('Traduire', run, { variant: 'primary', icon: 'translate' })
        ),
        out
      );
    },
  });
})();
