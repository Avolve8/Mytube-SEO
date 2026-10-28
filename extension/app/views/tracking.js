/* MyTube SEO — vues : suivi de classement, concurrents (scorecard), objectifs & projections, alertes de marque. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  /* ---------------------------------------------------- suivi de classement */

  A.register('rank', {
    title: 'Suivi de classement',
    icon: 'trophy',
    group: 'analysis',
    order: 3,
    description: 'Position de vos vidéos sur des mots-clés, dans le temps',
    async render(c) {
      const s = await MT.store.getSettings();
      const items = await MT.store.list('rankTracking');
      const video = A.input({ placeholder: 'URL ou ID de la vidéo' });
      const kw = A.input({ placeholder: 'Mot-clé (plusieurs : séparés par des virgules)' });
      const depth = A.select(
        [
          ['50', 'Top 50'],
          ['100', 'Top 100'],
          ['200', 'Top 200'],
        ],
        '100'
      );
      const add = async () => {
        const id = MT.videoIdFromUrl(video.value);
        if (!id) return W.toast('Vidéo invalide', 'error');
        const keywords = MT.seo.parseTagInput(kw.value);
        if (!keywords.length) return W.toast('Saisissez au moins un mot-clé', 'error');
        const v = await MT.yt.player(id).catch(() => ({ title: id }));
        for (const k of keywords) {
          const item = await MT.research.trackRank({ videoId: id, keyword: k, title: v.title, depth: Number(depth.value) });
          await MT.research.checkRank(item.id).catch(() => {});
        }
        W.toast(`${keywords.length} suivi(s) ajouté(s)`, 'success');
        A.render();
      };
      const detail = el('div');
      const showHistory = (item) => {
        const pts = (item.history || []).map((h) => ({ x: h.t, y: h.rank }));
        MT.fill(
          detail,
          A.card(
            `Historique : « ${item.keyword} »`,
            el('div', { class: 'mt-muted', style: 'margin-bottom:8px' }, item.title),
            pts.some((p) => p.y != null)
              ? W.lineChart([{ name: 'Position', points: pts }], { invert: true, yFormat: (v) => '#' + Math.round(v), xTipFormat: fmt.datetime, height: 220 })
              : W.empty('Pas encore classé dans le top suivi.'),
            item.top && item.top.length
              ? el(
                  'div',
                  { style: 'margin-top:10px' },
                  el('div', { class: 'mt-section-title' }, 'Top 3 actuel'),
                  el(
                    'ol',
                    null,
                    item.top.map((t) =>
                      el(
                        'li',
                        null,
                        el('a', { href: `https://www.youtube.com/watch?v=${t.videoId}`, target: '_blank', rel: 'noopener' }, t.title),
                        el('span', { class: 'mt-muted' }, ` — ${t.channelName || ''} · ${fmt.num(t.views)} vues`)
                      )
                    )
                  )
                )
              : null
          )
        );
        detail.scrollIntoView({ behavior: 'smooth' });
      };
      const rows = items.map((i) => {
        const h = i.history || [];
        const prev = h.length > 1 ? h[h.length - 2].rank : null;
        const weekAgo = h.filter((x) => x.t <= Date.now() - 6.5 * 86400000).pop();
        return {
          ...i,
          change: i.lastRank != null && prev != null ? prev - i.lastRank : null,
          week: i.lastRank != null && weekAgo && weekAgo.rank != null ? weekAgo.rank - i.lastRank : null,
        };
      });
      const arrow = (d) =>
        d == null || d === 0
          ? el('span', { class: 'mt-muted' }, d === 0 ? '=' : '—')
          : el('span', { style: { color: d > 0 ? 'var(--mt-great)' : 'var(--mt-bad)', fontWeight: '600' } }, (d > 0 ? '▲ ' : '▼ ') + Math.abs(d));
      MT.add(
        c,
        A.pageHead(
          'Suivi de classement',
          `Position de vos vidéos dans la recherche YouTube (non personnalisée, région ${s.region}). Vérification automatique toutes les ${s.rankFrequencyHours} h quand Firefox est ouvert.`,
          'trophy',
          W.button(
            'Tout vérifier maintenant',
            async () => {
              const prog = W.progress();
              const m = W.modal('Vérification des classements', el('div', null, prog));
              for (let i = 0; i < items.length; i++) {
                await MT.research.checkRank(items[i].id).catch(() => {});
                prog.set(i + 1, items.length);
              }
              m.close();
              A.render();
            },
            { icon: 'refresh' }
          )
        ),
        A.card(
          'Ajouter un suivi',
          el('div', { class: 'grid cols-3' }, A.field('Vidéo', video), A.field('Mots-clés', kw), A.field('Profondeur', depth)),
          W.button('Ajouter', add, { variant: 'primary', icon: 'plus' })
        ),
        el('div', { style: 'height:16px' }),
        A.card(
          `${items.length} suivi(s)`,
          W.table(
            [
              { key: 'keyword', label: 'Mot-clé', render: (r) => el('a', { href: '#/keywords?q=' + encodeURIComponent(r.keyword) }, r.keyword) },
              { key: 'title', label: 'Vidéo', render: (r) => A.videoCell({ videoId: r.videoId, title: r.title }, { channel: false }) },
              {
                key: 'lastRank',
                label: 'Position',
                num: true,
                render: (r) =>
                  r.error
                    ? el('span', { title: r.error, style: 'color:var(--mt-bad)' }, 'erreur')
                    : r.lastRank != null
                      ? el('strong', null, '#' + r.lastRank)
                      : r.lastChecked
                        ? `>${r.depth || 100}`
                        : '…',
              },
              { key: 'change', label: 'Dernière évol.', num: true, render: (r) => arrow(r.change) },
              { key: 'week', label: '7 jours', num: true, render: (r) => arrow(r.week) },
              { key: 'bestRank', label: 'Meilleure', num: true, render: (r) => (r.bestRank != null ? '#' + r.bestRank : '—') },
              {
                key: 'spark',
                label: 'Tendance',
                sortable: false,
                render: (r) => {
                  const hist = (r.history || []).slice(-30);
                  return W.sparkline(
                    hist.map((h) => (h.rank != null ? -h.rank : null)),
                    { labels: hist.map((h) => `${fmt.datetime(h.t)} : #${h.rank}`) }
                  );
                },
              },
              { key: 'lastChecked', label: 'Vérifié', num: true, render: (r) => (r.lastChecked ? fmt.ago(r.lastChecked) : '—') },
              {
                key: 'a',
                label: '',
                sortable: false,
                render: (r) =>
                  el(
                    'span',
                    { class: 'mt-row', style: 'gap:2px;flex-wrap:nowrap' },
                    W.button('', () => showHistory(items.find((i) => i.id === r.id)), { size: 'sm', variant: 'ghost', icon: 'chart', title: 'Historique', busy: false }),
                    W.button(
                      '',
                      async () => {
                        await MT.research.checkRank(r.id);
                        A.render();
                      },
                      { size: 'sm', variant: 'ghost', icon: 'refresh', title: 'Vérifier maintenant' }
                    ),
                    W.button(
                      '',
                      async () => {
                        await MT.store.update('rankTracking', (l) => {
                          const x = l.find((y) => y.id === r.id);
                          if (x) x.paused = !x.paused;
                          return l;
                        });
                        A.render();
                      },
                      { size: 'sm', variant: 'ghost', icon: r.paused ? 'play' : 'clock', title: r.paused ? 'Reprendre' : 'Mettre en pause', busy: false }
                    ),
                    W.button(
                      '',
                      async () => {
                        if (await W.confirm(`Supprimer le suivi « ${r.keyword} » ?`, { danger: true })) {
                          await MT.store.remove('rankTracking', r.id);
                          A.render();
                        }
                      },
                      { size: 'sm', variant: 'ghost danger', icon: 'trash', title: 'Supprimer', busy: false }
                    )
                  ),
              },
            ],
            rows,
            { sortKey: 'lastRank', sortDir: 'asc', empty: 'Aucun suivi. Ajoutez-en ci-dessus ou depuis Videolytics.' }
          ),
          items.length
            ? el(
                'div',
                { class: 'mt-row', style: 'margin-top:8px' },
                W.button(
                  'Exporter CSV',
                  () =>
                    MT.download(
                      `classements-${MT.today()}.csv`,
                      MT.toCSV(
                        items.flatMap((i) =>
                          (i.history || []).map((h) => ({ keyword: i.keyword, videoId: i.videoId, title: i.title, date: new Date(h.t).toISOString(), rank: h.rank ?? '' }))
                        )
                      ),
                      'text/csv;charset=utf-8'
                    ),
                  { size: 'sm', icon: 'download', busy: false }
                )
              )
            : null
        ),
        el('div', { style: 'height:16px' }),
        detail
      );
    },
  });

  /* ------------------------------------------------------------ concurrents */

  function deltaOver(history, key, days) {
    if (!history || !history.length) return null;
    const last = history[history.length - 1];
    const ref = history.filter((h) => h.t <= last.t - (days - 0.5) * 86400000).pop();
    if (!ref || last[key] == null || ref[key] == null) return null;
    return last[key] - ref[key];
  }

  A.register('competitors', {
    title: 'Concurrents',
    icon: 'users',
    group: 'analysis',
    order: 4,
    description: 'Scorecard et évolution des chaînes concurrentes',
    async render(c) {
      const s = await MT.store.getSettings();
      const list = await MT.store.list('competitors');
      const mine = s.myChannelId ? await MT.yt.getChannel(s.myChannelId, { videoLimit: 20 }).catch(() => null) : null;
      const rows = list.map((cp) => {
        const h = cp.history || [];
        const last = h[h.length - 1] || {};
        return {
          ...cp,
          subscribers: last.subscribers,
          views: last.views,
          videos: last.videos,
          avgViews: last.avgViews,
          uploadsPerWeek: last.uploadsPerWeek,
          subs7: deltaOver(h, 'subscribers', 7),
          subs30: deltaOver(h, 'subscribers', 30),
          views30: deltaOver(h, 'views', 30),
        };
      });
      if (mine)
        rows.unshift({
          id: 'me',
          channelId: mine.channelId,
          title: mine.title + ' (vous)',
          avatar: mine.avatar,
          subscribers: mine.subscribers,
          views: mine.totalViews,
          videos: mine.videoCount,
          avgViews: mine.stats.medianViews,
          uploadsPerWeek: mine.stats.uploadsPerWeek,
          me: true,
          history: await MT.store.list('mySnapshots'),
        });
      const signed = (v) => (v == null ? '—' : el('span', { style: { color: v >= 0 ? 'var(--mt-great)' : 'var(--mt-bad)' } }, fmt.signed(v)));
      const ci = A.channelInput({
        label: 'Ajouter',
        placeholder: 'Chaîne concurrente : @handle ou URL',
        onSubmit: async (v) => {
          await MT.research.addCompetitor(v);
          W.toast('Concurrent ajouté', 'success');
          A.render();
        },
      });
      const metric = A.select(
        [
          ['subscribers', 'Abonnés'],
          ['views', 'Vues totales'],
          ['videos', 'Vidéos'],
          ['avgViews', 'Vues médianes récentes'],
        ],
        'subscribers'
      );
      const chartBox = el('div');
      const drawChart = () =>
        MT.fill(
          chartBox,
          W.lineChart(
            rows.map((r) => ({ name: r.title, points: (r.history || []).map((h) => ({ x: h.t, y: h[metric.value] })) })),
            { height: 240 }
          )
        );
      metric.addEventListener('change', drawChart);
      MT.add(
        c,
        A.pageHead(
          'Concurrents',
          'Comparez votre chaîne à vos concurrents et suivez leur croissance. Un instantané est pris automatiquement chaque jour quand Firefox est ouvert.',
          'users',
          list.length
            ? W.button(
                'Mettre à jour maintenant',
                async () => {
                  for (const cp of list) await MT.research.snapshotCompetitor(cp.id).catch(() => {});
                  if (s.myChannelId) await MT.research.snapshotMyChannel().catch(() => {});
                  A.render();
                },
                { icon: 'refresh' }
              )
            : null
        ),
        A.card('Ajouter un concurrent', ci),
        el('div', { style: 'height:16px' }),
        A.card(
          'Tableau comparatif',
          W.table(
            [
              {
                key: 'title',
                label: 'Chaîne',
                render: (r) =>
                  el(
                    'span',
                    { class: 'mt-row', style: 'flex-wrap:nowrap' },
                    r.avatar ? el('img', { src: r.avatar, width: 26, height: 26, style: 'border-radius:50%' }) : null,
                    el('a', { href: '#/channelytics?c=' + r.channelId, style: r.me ? 'font-weight:700' : '' }, r.title)
                  ),
              },
              { key: 'subscribers', label: 'Abonnés', num: true, render: (r) => fmt.num(r.subscribers) },
              { key: 'subs7', label: '7 j', num: true, render: (r) => signed(r.subs7) },
              { key: 'subs30', label: '30 j', num: true, render: (r) => signed(r.subs30) },
              { key: 'views', label: 'Vues totales', num: true, render: (r) => fmt.num(r.views) },
              { key: 'views30', label: 'Vues 30 j', num: true, render: (r) => signed(r.views30) },
              { key: 'videos', label: 'Vidéos', num: true, render: (r) => fmt.num(r.videos) },
              { key: 'avgViews', label: 'Vues médianes', num: true, render: (r) => fmt.num(r.avgViews) },
              { key: 'uploadsPerWeek', label: 'Vidéos / sem.', num: true, render: (r) => (r.uploadsPerWeek != null ? fmt.dec(r.uploadsPerWeek) : '—') },
              {
                key: 'a',
                label: '',
                sortable: false,
                render: (r) =>
                  r.me
                    ? ''
                    : W.button(
                        '',
                        async () => {
                          if (await W.confirm(`Retirer ${r.title} ?`, { danger: true })) {
                            await MT.store.remove('competitors', r.id);
                            A.render();
                          }
                        },
                        { size: 'sm', variant: 'ghost danger', icon: 'trash', busy: false }
                      ),
              },
            ],
            rows,
            { sortKey: 'subscribers', empty: 'Ajoutez des chaînes concurrentes pour les comparer.' }
          )
        ),
        el('div', { style: 'height:16px' }),
        rows.length
          ? A.card(el('span', { class: 'mt-row', style: 'justify-content:space-between;width:100%' }, 'Évolution', el('span', { style: 'width:220px' }, metric)), chartBox)
          : null,
        list.length ? el('div', { style: 'height:16px' }) : null,
        list.length
          ? A.card(
              'Dernières vidéos des concurrents',
              W.table(
                [
                  { key: 'title', label: 'Vidéo', render: (v) => A.videoCell(v) },
                  { key: 'publishedAt', label: 'Publiée', num: true, render: (v) => (v.publishedAt ? fmt.ago(v.publishedAt) : '—') },
                  { key: 'views', label: 'Vues', num: true, render: (v) => fmt.num(v.views) },
                ],
                list.flatMap((cp) => ((cp.latest && cp.latest.recent) || []).map((v) => ({ ...v, channelName: cp.title }))),
                { sortKey: 'publishedAt', maxHeight: '420px', empty: 'Les vidéos apparaîtront après la prochaine mise à jour.' }
              )
            )
          : null
      );
      if (rows.length) drawChart();
    },
  });

  /* ------------------------------------------------- objectifs & projections */

  A.register('milestones', {
    title: 'Objectifs',
    icon: 'star',
    group: 'analysis',
    order: 9,
    description: 'Progression et projection des abonnés et des vues',
    async render(c) {
      const s = await MT.store.getSettings();
      MT.add(c, A.pageHead('Objectifs & projections', 'Suivez la croissance de votre chaîne et estimez la date d’atteinte de vos prochains paliers.', 'star'));
      if (!s.myChannelId) {
        c.appendChild(A.card(null, W.alert('Indiquez votre chaîne dans le tableau de bord ou les paramètres pour activer le suivi des objectifs.', 'warn')));
        return;
      }
      const out = el('div', { class: 'stack' });
      c.appendChild(out);
      await A.withLoading(out, 'Chargement…', async () => {
        await MT.research.snapshotMyChannel();
        const snaps = await MT.store.list('mySnapshots');
        const goals = (await MT.store.get('goals', null)) || {};
        const last = snaps[snaps.length - 1];
        const rate = (key, days) => {
          const ref = snaps.filter((x) => x.t <= last.t - days * 86400000).pop() || snaps[0];
          if (!ref || ref === last || last[key] == null || ref[key] == null) return null;
          return (last[key] - ref[key]) / Math.max(1, (last.t - ref.t) / 86400000);
        };
        const subsRate = rate('subscribers', 30) ?? rate('subscribers', 7);
        const viewsRate = rate('views', 30) ?? rate('views', 7);
        const eta = (current, target, perDay) => (perDay && perDay > 0 ? Date.now() + ((target - current) / perDay) * 86400000 : null);
        const next = MT.home.nextMilestone(last.subscribers);
        const subGoal = A.input({ type: 'number', value: goals.subscribers || next || '', placeholder: 'ex. 10000' });
        const viewGoal = A.input({ type: 'number', value: goals.views || '', placeholder: 'ex. 1000000' });
        const goalCard = (label, current, target, perDay) => {
          if (!target) return null;
          const pct = Math.min(100, (current / target) * 100);
          const when = eta(current, target, perDay);
          return el(
            'div',
            { style: 'margin-bottom:14px' },
            W.meter(label, pct, { text: `${fmt.num(current)} / ${fmt.num(target)}` }),
            el(
              'div',
              { class: 'mt-small mt-muted', style: 'margin-top:4px' },
              current >= target
                ? 'Objectif atteint 🎉'
                : when
                  ? `Au rythme actuel (${fmt.signed(perDay)}/jour) : ${fmt.date(when)}`
                  : 'Pas assez de données de croissance (revenez dans quelques jours).'
            )
          );
        };
        MT.fill(
          out,
          A.card(
            'Mes objectifs',
            el('div', { class: 'grid cols-2' }, A.field('Objectif d’abonnés', subGoal), A.field('Objectif de vues totales', viewGoal)),
            W.button(
              'Enregistrer',
              async () => {
                await MT.store.set('goals', { subscribers: Number(subGoal.value) || null, views: Number(viewGoal.value) || null });
                A.render();
              },
              { variant: 'primary', icon: 'check' }
            ),
            el(
              'div',
              { style: 'margin-top:16px' },
              goalCard('Abonnés', last.subscribers, Number(subGoal.value) || next, subsRate),
              goalCard('Vues totales', last.views, Number(viewGoal.value) || null, viewsRate)
            )
          ),
          A.card(
            'Paliers d’abonnés',
            W.table(
              [
                { key: 'm', label: 'Palier', num: true, render: (r) => fmt.num(r.m) },
                { key: 'status', label: 'Statut', render: (r) => (last.subscribers >= r.m ? '✅ Atteint' : r.eta ? `Prévu le ${fmt.date(r.eta)}` : '—') },
              ],
              MT.home.MILESTONES.filter((m) => m <= Math.max(1000, (last.subscribers || 0) * 20)).map((m) => ({
                m,
                eta: last.subscribers < m ? eta(last.subscribers, m, subsRate) : null,
              })),
              { sortKey: 'm', sortDir: 'asc' }
            )
          ),
          A.grid(
            2,
            A.card('Abonnés', W.lineChart([{ name: 'Abonnés', points: snaps.map((x) => ({ x: x.t, y: x.subscribers })) }], { area: true })),
            A.card('Vues totales', W.lineChart([{ name: 'Vues', points: snaps.map((x) => ({ x: x.t, y: x.views })) }], { area: true }))
          ),
          el(
            'p',
            { class: 'mt-small mt-muted' },
            `${snaps.length} instantané(s) enregistré(s). YouTube arrondit les abonnés publics (3 chiffres significatifs) : les petites variations peuvent ne pas apparaître.`
          )
        );
      });
    },
  });

  /* ---------------------------------------------------------------- alertes */

  A.register('alerts', {
    title: 'Alertes',
    icon: 'bell',
    group: 'community',
    order: 4,
    description: 'Nouvelles vidéos sur une marque ou un sujet',
    async render(c) {
      const s = await MT.store.getSettings();
      const alerts = await MT.store.list('alerts');
      const term = A.input({ placeholder: 'Nom de marque, de chaîne ou sujet (ex. « MaMarque »)' });
      const excl = A.checkbox('Ignorer les vidéos de ma chaîne', true);
      const add = async () => {
        if (!term.value.trim()) return W.toast('Saisissez un terme', 'error');
        const a = await MT.store.upsert('alerts', {
          id: MT.uid(),
          term: term.value.trim(),
          excludeChannel: excl.querySelector('input').checked ? s.myChannelId : null,
          createdAt: Date.now(),
        });
        await MT.research.checkAlert(a.id);
        W.toast('Alerte créée', 'success');
        A.render();
      };
      const hits = alerts.flatMap((a) => (a.hits || []).map((h) => ({ ...h, term: a.term }))).sort((a, b) => b.foundAt - a.foundAt);
      MT.add(
        c,
        A.pageHead(
          'Alertes de marque',
          `Soyez notifié lorsqu’une nouvelle vidéo mentionne votre marque, votre chaîne ou un sujet (vérification toutes les ${s.alertFrequencyHours} h).`,
          'bell',
          alerts.length
            ? W.button(
                'Vérifier maintenant',
                async () => {
                  for (const a of alerts) await MT.research.checkAlert(a.id).catch(() => {});
                  A.render();
                },
                { icon: 'refresh' }
              )
            : null
        ),
        A.card(
          'Nouvelle alerte',
          el('div', { class: 'field-row' }, term, W.button('Créer', add, { variant: 'primary', icon: 'plus' })),
          el('div', { style: 'margin-top:8px' }, excl)
        ),
        el('div', { style: 'height:16px' }),
        A.grid(
          2,
          A.card(
            'Alertes actives',
            W.table(
              [
                { key: 'term', label: 'Terme' },
                { key: 'unread', label: 'Nouvelles', num: true, render: (a) => (a.unread ? el('span', { class: 'nav-badge', style: 'margin:0' }, String(a.unread)) : '0') },
                { key: 'lastChecked', label: 'Vérifiée', num: true, render: (a) => (a.lastChecked ? fmt.ago(a.lastChecked) : '—') },
                {
                  key: 'x',
                  label: '',
                  sortable: false,
                  render: (a) =>
                    W.button(
                      '',
                      async () => {
                        await MT.store.remove('alerts', a.id);
                        A.render();
                      },
                      { size: 'sm', variant: 'ghost danger', icon: 'trash', busy: false }
                    ),
                },
              ],
              alerts,
              { empty: 'Aucune alerte' }
            ),
            alerts.some((a) => a.unread)
              ? el(
                  'div',
                  { style: 'margin-top:8px' },
                  W.button(
                    'Tout marquer comme lu',
                    async () => {
                      await MT.store.update('alerts', (l) => l.map((a) => ({ ...a, unread: 0 })));
                      A.render();
                    },
                    { size: 'sm', busy: false }
                  )
                )
              : null
          ),
          A.card(
            'Vidéos détectées',
            hits.length
              ? el(
                  'div',
                  { class: 'mt-col', style: 'gap:10px' },
                  hits
                    .slice(0, 60)
                    .map((h) =>
                      el(
                        'div',
                        { class: 'mt-row', style: 'flex-wrap:nowrap' },
                        W.thumb(h.videoId, 'sm'),
                        el(
                          'div',
                          { style: 'min-width:0' },
                          el('a', { href: `https://www.youtube.com/watch?v=${h.videoId}`, target: '_blank', rel: 'noopener' }, h.title),
                          el('div', { class: 'mt-small mt-muted' }, `« ${h.term} » · ${h.channelName || ''} · détectée ${fmt.ago(h.foundAt)}`)
                        )
                      )
                    )
                )
              : W.empty('Les nouvelles vidéos apparaîtront ici (la première vérification sert de référence).')
          )
        )
      );
    },
  });
})();
