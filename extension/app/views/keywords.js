/* MyTube SEO — vues : explorateur de mots-clés, opportunités (search insights). */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  function gaugeBox(score, label, hint, inverse) {
    const l = MT.keyword.label(score || 0, inverse);
    return el(
      'div',
      { class: 'mt-col', style: 'align-items:center;gap:4px;text-align:center', title: hint || '' },
      W.gauge(score, { size: 86, inverse }),
      el('strong', null, label),
      el('span', { class: 'mt-small mt-muted' }, score == null ? '—' : l.label)
    );
  }

  function resultsTable(videos, keyword, tagMap) {
    return W.table(
      [
        { key: 'rank', label: '#', num: true, width: '40px' },
        { key: 'title', label: 'Vidéo', render: (v) => A.videoCell(v) },
        { key: 'views', label: 'Vues', num: true, render: (v) => fmt.num(v.views) },
        { key: 'ageSec', label: 'Âge', num: true, render: (v) => (v.ageSec != null ? fmt.ageSec(v.ageSec).replace('il y a ', '') : v.isLive ? 'En direct' : '—') },
        {
          key: 'vpd',
          label: 'Vues/jour',
          num: true,
          sort: (v) => (v.views != null && v.ageSec ? v.views / Math.max(1, v.ageSec / 86400) : null),
          render: (v) => (v.views != null && v.ageSec ? fmt.num(v.views / Math.max(1, v.ageSec / 86400)) : '—'),
        },
        { key: 'durationSec', label: 'Durée', num: true, render: (v) => (v.isShort ? 'Short' : fmt.duration(v.durationSec)) },
        {
          key: 'kw',
          label: 'Mot-clé au titre',
          sort: (v) => (MT.text.containsPhrase(v.title, keyword) ? 1 : 0),
          render: (v) => (MT.text.containsPhrase(v.title, keyword) ? '✓' : '—'),
        },
        {
          key: 'tags',
          label: 'Tags',
          num: true,
          sort: (v) => (tagMap.get(v.videoId) || []).length,
          render: (v) => (tagMap.has(v.videoId) ? el('span', { title: tagMap.get(v.videoId).join(', ') }, String(tagMap.get(v.videoId).length)) : '…'),
        },
      ],
      videos.filter((v) => !v.inShelf).slice(0, 25),
      { sortKey: 'rank', sortDir: 'asc' }
    );
  }

  async function explorer(c, params) {
    const q = (params.q || '').trim();
    c.appendChild(
      A.pageHead('Explorateur de mots-clés', 'Évaluez le volume de recherche, la concurrence et l’optimisation d’un mot-clé, puis trouvez les tags et requêtes associés.', 'search')
    );
    const ki = A.keywordInput({ value: q, onSubmit: (v) => A.navigate('keywords', { q: v }) });
    c.appendChild(A.card(null, ki));
    const out = el('div', { class: 'stack', style: 'margin-top:16px' });
    c.appendChild(out);
    if (!q) {
      const hist = await MT.store.list('keywordHistory');
      out.appendChild(
        A.card(
          'Historique',
          hist.length
            ? W.table(
                [
                  { key: 'keyword', label: 'Mot-clé', render: (h) => el('a', { href: '#/keywords?q=' + encodeURIComponent(h.keyword) }, h.keyword) },
                  { key: 'overall', label: 'Global', num: true, render: (h) => W.pill(h.overall) },
                  { key: 'volume', label: 'Volume', num: true },
                  { key: 'competition', label: 'Concurrence', num: true },
                  { key: 't', label: 'Date', num: true, render: (h) => fmt.datetime(h.t) },
                ],
                hist,
                { sortKey: 't' }
              )
            : W.empty('Vos recherches apparaîtront ici.'),
          hist.length
            ? el(
                'div',
                { style: 'margin-top:8px' },
                W.button(
                  'Effacer l’historique',
                  async () => {
                    await MT.store.set('keywordHistory', []);
                    A.render();
                  },
                  { size: 'sm', variant: 'ghost danger', icon: 'trash' }
                )
              )
            : null
        )
      );
      return;
    }
    const analysis = await A.withLoading(out, `Analyse de « ${q} »…`, () => MT.research.analyzeKeyword(q));
    if (!analysis) return;
    const s = analysis.score;
    const m = s.metrics;
    const tagMap = new Map();
    const resultsBox = el('div');
    const drawResults = () => MT.fill(resultsBox, resultsTable(analysis.videos, q, tagMap));
    drawResults();

    const tagsBox = el('div', null, el('p', { class: 'mt-muted', style: 'margin-top:0' }, 'Lisez les tags des 15 vidéos les mieux classées pour découvrir ceux qui fonctionnent.'));
    const tagsBtn = W.button(
      'Analyser les tags des concurrents',
      async () => {
        const prog = W.progress();
        MT.fill(tagsBox, W.spinner('Lecture des tags…'), prog);
        const r = await MT.research.topTags(analysis.videos, { limit: 15, onProgress: (d, t) => prog.set(d, t) });
        for (const v of r.perVideo) tagMap.set(v.videoId, v.tags);
        drawResults();
        const top = r.tags.slice(0, 60);
        MT.fill(
          tagsBox,
          W.stats([
            { label: 'Vidéos analysées', value: r.analyzed },
            { label: 'Tags moyens / vidéo', value: fmt.dec(r.avgTagCount) },
            { label: 'Vidéos sans tag', value: r.withoutTags },
            { label: 'Tags distincts', value: r.tags.length },
          ]),
          el(
            'div',
            { style: 'margin-top:10px' },
            W.chips(top, { badge: (t) => t.count, onClick: (t) => A.navigate('keywords', { q: t.tag }), title: (t) => `${t.tag} — ${t.count} vidéo(s), ${fmt.pct(t.pct, 0)}` })
          ),
          el(
            'div',
            { class: 'mt-row', style: 'margin-top:10px' },
            W.copyButton(() => MT.seo.fitTags(top.map((t) => t.tag)).join(', '), 'Copier (≤ 500 car.)', { size: 'sm' }),
            W.button(
              'Enregistrer en liste',
              async () => {
                await MT.store.upsert('tagLists', { id: MT.uid(), name: 'Concurrents : ' + q, tags: MT.seo.fitTags(top.map((t) => t.tag)), createdAt: Date.now() });
                W.toast('Liste enregistrée', 'success');
              },
              { size: 'sm', icon: 'list' }
            ),
            W.button(
              'Exporter CSV',
              () =>
                MT.download(
                  `tags-${MT.slug(q)}.csv`,
                  MT.toCSV(r.tags, [
                    { key: 'tag', label: 'Tag' },
                    { key: 'count', label: 'Vidéos' },
                    { label: '%', get: (t) => Math.round(t.pct * 100) },
                  ])
                ),
              { size: 'sm', icon: 'download', busy: false }
            )
          )
        );
      },
      { icon: 'tag' }
    );

    const relatedBox = el('div');
    const drawRelated = (rows) => {
      MT.fill(
        relatedBox,
        W.table(
          [
            { key: 'keyword', label: 'Mot-clé', width: '42%', render: (r) => el('a', { href: '#/keywords?q=' + encodeURIComponent(r.keyword) }, r.keyword) },
            { key: 'words', label: 'Mots', num: true },
            { key: 'hits', label: 'Occurrences', num: true },
            {
              key: 'overall',
              label: 'Score',
              num: true,
              render: (r) =>
                r.overall != null
                  ? W.pill(r.overall)
                  : el(
                      'button',
                      {
                        class: 'mt-btn sm',
                        onclick: async (e) => {
                          e.target.disabled = true;
                          const sc = await MT.research.quickScore(r.keyword).catch(() => null);
                          r.overall = sc ? sc.overall : null;
                          r.volume = sc ? sc.volume : null;
                          r.competition = sc ? sc.competition : null;
                          drawRelated(rows);
                        },
                      },
                      'Évaluer'
                    ),
            },
            { key: 'volume', label: 'Volume', num: true },
            { key: 'competition', label: 'Concurrence', num: true },
          ],
          rows,
          { sortKey: 'hits', maxHeight: '460px' }
        ),
        el(
          'div',
          { class: 'mt-row', style: 'margin-top:8px' },
          W.button(
            'Évaluer les 20 premiers',
            async () => {
              const todo = rows.filter((r) => r.overall == null).slice(0, 20);
              await MT.pool(todo, 2, async (r) => {
                const sc = await MT.research.quickScore(r.keyword);
                Object.assign(r, { overall: sc.overall, volume: sc.volume, competition: sc.competition });
              });
              drawRelated(rows);
            },
            { size: 'sm', icon: 'bolt' }
          ),
          W.copyButton(() => rows.map((r) => r.keyword).join('\n'), 'Copier la liste', { size: 'sm' }),
          W.button(
            'Exporter CSV',
            () =>
              MT.download(
                `mots-cles-${MT.slug(q)}.csv`,
                MT.toCSV(rows, [
                  { key: 'keyword', label: 'Mot-clé' },
                  { key: 'hits', label: 'Occurrences' },
                  { key: 'overall', label: 'Score' },
                  { key: 'volume', label: 'Volume' },
                  { key: 'competition', label: 'Concurrence' },
                ])
              ),
            { size: 'sm', icon: 'download', busy: false }
          )
        )
      );
    };
    drawRelated(analysis.related.map((k, i) => ({ keyword: k, words: k.split(/\s+/).length, hits: analysis.related.length - i })));
    const longTailBtn = W.button(
      'Trouver la longue traîne (a → z)',
      async () => {
        const prog = W.progress();
        MT.fill(relatedBox, W.spinner('Interrogation de l’autocomplétion YouTube…'), prog);
        const rows = await MT.research.longTail(q, { onProgress: (d, t) => prog.set(d, t) });
        drawRelated(rows);
      },
      { size: 'sm', icon: 'list' }
    );

    const ideasBox = el('div');
    const drawIdeas = (list) =>
      MT.fill(
        ideasBox,
        el(
          'div',
          { class: 'mt-col', style: 'gap:6px' },
          list.map((t) =>
            el(
              'div',
              { class: 'mt-row', style: 'justify-content:space-between;flex-wrap:nowrap' },
              el('span', null, typeof t === 'string' ? t : t.title),
              el(
                'span',
                { class: 'mt-row', style: 'gap:4px;flex-wrap:nowrap' },
                el('span', { class: 'mt-small mt-muted' }, `${[...(typeof t === 'string' ? t : t.title)].length} car.`),
                W.copyButton(typeof t === 'string' ? t : t.title, '', { size: 'sm', variant: 'ghost' })
              )
            )
          )
        )
      );
    drawIdeas(MT.seo.titleIdeas(q, 10));

    MT.fill(
      out,
      A.card(
        null,
        el(
          'div',
          { class: 'mt-row', style: 'justify-content:space-between;align-items:flex-start' },
          el(
            'div',
            null,
            el('h2', { style: 'margin:0 0 4px' }, `« ${q} »`),
            analysis.correctedQuery ? el('div', { class: 'mt-small', style: 'color:var(--mt-fair)' }, `YouTube suggère : « ${analysis.correctedQuery} »`) : null
          ),
          el(
            'div',
            { class: 'mt-row' },
            W.button('SEO Studio', () => A.navigate('seo-studio', { k: q }), { size: 'sm', icon: 'edit', busy: false }),
            W.button(
              'Planificateur',
              async () => {
                await MT.store.upsert('ideas', { id: MT.uid(), title: q, keyword: q, score: s.overall, status: 'idea', createdAt: Date.now() });
                W.toast('Ajouté au planificateur', 'success');
              },
              { size: 'sm', icon: 'star' }
            ),
            W.button(
              'Alerte',
              async () => {
                await MT.store.upsert('alerts', { id: MT.uid(), term: q, createdAt: Date.now() });
                W.toast('Alerte créée : vous serez notifié des nouvelles vidéos', 'success');
              },
              { size: 'sm', icon: 'bell' }
            )
          )
        ),
        el(
          'div',
          { class: 'grid cols-4', style: 'grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin:12px 0' },
          gaugeBox(s.overall, 'Score global', 'Combinaison du volume et de la concurrence'),
          gaugeBox(s.volume, 'Volume de recherche', 'Présence dans l’autocomplétion et vues quotidiennes des meilleurs résultats'),
          gaugeBox(s.competition, 'Concurrence', 'Vues, optimisation et notoriété des vidéos classées', true),
          gaugeBox(s.optimization, 'Optimisation concurrente', 'Part des meilleurs résultats ciblant exactement ce mot-clé', true),
          s.weighted != null ? gaugeBox(s.weighted, 'Pour votre chaîne', 'Tient compte des vues habituelles de votre chaîne') : null
        ),
        W.stats([
          { label: 'Résultats estimés', value: fmt.num(m.estimatedResults) },
          { label: 'Vues médianes (top 10)', value: fmt.num(m.medianViews) },
          { label: 'Vues/jour moyennes (top 10)', value: fmt.num(m.avgViewsPerDay) },
          { label: 'Titres avec le mot-clé', value: fmt.pct(m.titleMatchPct, 0) },
          { label: 'Chaînes vérifiées (top 10)', value: fmt.pct(m.verifiedPct, 0) },
          { label: 'Vidéos < 30 jours', value: fmt.pct(m.recentPct, 0) },
          { label: 'Âge moyen', value: m.avgAgeDays != null ? fmt.int(m.avgAgeDays) + ' j' : '—' },
          { label: 'Shorts dans le top 20', value: fmt.pct(m.shortsPct, 0) },
          {
            label: 'Autocomplétion',
            value: s.autocomplete.found ? `dès « ${s.autocomplete.found.prefix} »` : 'non suggéré',
            title: 'Préfixe le plus court pour lequel YouTube suggère ce mot-clé',
          },
        ])
      ),
      A.card(el('span', null, 'Meilleurs résultats ', el('span', { class: 'mt-muted mt-small' }, '(recherche non personnalisée)')), resultsBox),
      A.grid(
        2,
        A.card('Tags les plus utilisés', tagsBox, el('div', { style: 'margin-top:8px' }, tagsBtn)),
        A.card(el('span', null, 'Mots-clés associés'), el('div', { style: 'margin-bottom:8px' }, longTailBtn), relatedBox)
      ),
      A.card(
        'Idées de titres',
        ideasBox,
        el(
          'div',
          { class: 'mt-row', style: 'margin-top:10px' },
          W.button(
            'Générer avec l’IA',
            async () => {
              const titles = await MT.ai.titles({ keyword: q, topic: q });
              drawIdeas(titles);
            },
            { size: 'sm', icon: 'bolt' }
          )
        )
      )
    );
  }

  A.register('keywords', {
    title: 'Explorateur de mots-clés',
    icon: 'search',
    group: 'research',
    order: 1,
    description: 'Volume, concurrence, longue traîne, tags',
    render: explorer,
  });

  /* ---------------------------------------------------------- opportunités */

  async function scoreWithRank(keyword, channelId) {
    const [search, probes] = await Promise.all([
      MT.yt.search(keyword, { limit: 20 }),
      Promise.all(MT.keyword.probePrefixes(keyword).map(async (p) => ({ prefix: p, suggestions: await MT.yt.suggest(p).catch(() => []) }))),
    ]);
    const score = MT.keyword.scoreKeyword({ keyword, search, probes });
    const organic = search.videos.filter((v) => !v.inShelf);
    const idx = organic.findIndex((v) => v.channelId === channelId);
    return { score, myRank: idx >= 0 ? idx + 1 : null };
  }

  function opportunityOf(row) {
    if (row.overall == null) return null;
    let o = row.overall;
    if (row.myRank != null && row.myRank <= 3) o *= 0.4;
    else if (row.myRank != null && row.myRank <= 10) o *= 0.8;
    else o *= 1.1;
    return Math.round(MT.clamp(o));
  }

  A.register('opportunities', {
    title: 'Opportunités',
    icon: 'target',
    group: 'research',
    order: 6,
    description: 'Mots-clés à fort potentiel pour votre chaîne',
    async render(c, params) {
      const s = await MT.store.getSettings();
      c.appendChild(
        A.pageHead(
          'Opportunités de mots-clés',
          'Repère les mots-clés liés à votre chaîne (tags, mots-clés de chaîne, termes de recherche YouTube) ayant un bon score mais sur lesquels vous n’êtes pas encore bien classé.',
          'target'
        )
      );
      const channel = params.c || s.myChannelId;
      if (!channel) {
        c.appendChild(A.card('Quelle chaîne ?', A.channelInput({ onSubmit: (v) => A.navigate('opportunities', { c: v }) })));
        return;
      }
      const out = el('div', { class: 'stack' });
      c.appendChild(out);
      const data = await A.withLoading(out, 'Collecte des mots-clés de la chaîne…', async () => {
        const ch = await MT.yt.getChannel(channel, { videoLimit: 15 });
        const candidates = new Map();
        const addCand = (k, source) => {
          k = String(k || '').trim();
          if (!k || k.length < 3 || k.length > 60) return;
          const n = MT.text.normalize(k);
          const cur = candidates.get(n) || { keyword: k, sources: new Set(), count: 0 };
          cur.sources.add(source);
          cur.count++;
          candidates.set(n, cur);
        };
        (ch.keywords || []).forEach((k) => addCand(k, 'Chaîne'));
        const vids = (ch.videos || []).slice(0, 12);
        const tagRes = await MT.pool(vids, 4, async (v) => MT.yt.getVideoTags(v.videoId));
        tagRes.forEach((tags) => Array.isArray(tags) && tags.forEach((t) => addCand(t, 'Tags')));
        const st = await MT.oauth.status();
        if (st.connected && st.channel && st.channel.channelId === ch.channelId) {
          try {
            const a = await MT.oauth.auth({ interactive: false });
            const end = MT.ytapi.isoDate(Date.now());
            const start = MT.ytapi.isoDate(Date.now() - 90 * 86400000);
            const rows = await MT.ytapi.analytics(
              {
                startDate: start,
                endDate: end,
                metrics: 'views',
                dimensions: 'insightTrafficSourceDetail',
                filters: 'insightTrafficSourceType==YT_SEARCH',
                sort: '-views',
                maxResults: 25,
              },
              a
            );
            rows.forEach((r) => addCand(r.insightTrafficSourceDetail, 'Recherches YouTube'));
          } catch (e) {
            /* Analytics facultatif */
          }
        }
        const list = [...candidates.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 40)
          .map((x) => ({ keyword: x.keyword, source: [...x.sources].join(', '), count: x.count }));
        return { ch, list };
      });
      if (!data) return;
      const { ch, list } = data;
      const tableBox = el('div');
      const prog = W.progress();
      const draw = () =>
        MT.fill(
          tableBox,
          W.table(
            [
              { key: 'keyword', label: 'Mot-clé', render: (r) => el('a', { href: '#/keywords?q=' + encodeURIComponent(r.keyword) }, r.keyword) },
              { key: 'source', label: 'Source' },
              { key: 'opportunity', label: 'Opportunité', num: true, sort: (r) => opportunityOf(r), render: (r) => (r.overall != null ? W.pill(opportunityOf(r)) : '…') },
              { key: 'overall', label: 'Global', num: true },
              { key: 'volume', label: 'Volume', num: true },
              { key: 'competition', label: 'Concurrence', num: true },
              { key: 'myRank', label: 'Votre position (top 20)', num: true, render: (r) => (r.overall == null ? '…' : r.myRank ? '#' + r.myRank : 'absent') },
              {
                key: 'act',
                label: '',
                sortable: false,
                render: (r) =>
                  W.button(
                    '',
                    async () => {
                      await MT.store.upsert('ideas', { id: MT.uid(), title: r.keyword, keyword: r.keyword, score: r.overall, status: 'idea', createdAt: Date.now() });
                      W.toast('Ajouté au planificateur', 'success');
                    },
                    { size: 'sm', variant: 'ghost', icon: 'star', title: 'Ajouter au planificateur' }
                  ),
              },
            ],
            list,
            { sortKey: 'opportunity' }
          )
        );
      draw();
      MT.fill(out, A.card(`${list.length} mots-clés liés à ${ch.title}`, el('div', { style: 'margin-bottom:10px' }, prog), tableBox));
      await MT.pool(
        list,
        2,
        async (r) => {
          const res = await scoreWithRank(r.keyword, ch.channelId);
          Object.assign(r, { overall: res.score.overall, volume: res.score.volume, competition: res.score.competition, myRank: res.myRank });
        },
        (d, t) => {
          prog.set(d, t);
          if (d % 4 === 0 || d === t) draw();
        }
      );
      draw();
    },
  });
})();
