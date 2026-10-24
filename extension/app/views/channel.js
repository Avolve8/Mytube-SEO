/* MyTube SEO — vues : Channelytics, meilleur moment pour publier, audit de chaîne, démonétisation, export. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  function cur(s) {
    return s.currency === 'USD' ? '$' : '€';
  }

  /* ---------------------------------------------------------- Channelytics */

  A.register('channelytics', {
    title: 'Channelytics',
    icon: 'users',
    group: 'analysis',
    order: 2,
    description: 'Statistiques détaillées de n’importe quelle chaîne',
    async render(c, params) {
      const s = await MT.store.getSettings();
      MT.add(
        c,
        A.pageHead('Channelytics', 'Statistiques, rythme de publication, revenus estimés et meilleures vidéos d’une chaîne.', 'users'),
        A.card(null, A.channelInput({ value: params.c || '', onSubmit: (v) => A.navigate('channelytics', { c: v }) }))
      );
      if (!params.c) return;
      const out = el('div', { class: 'stack', style: 'margin-top:16px' });
      c.appendChild(out);
      const ch = await A.withLoading(out, 'Analyse de la chaîne…', () => MT.yt.getChannel(params.c, { videoLimit: 50 }));
      if (!ch) return;
      const st = ch.stats;
      const vids = st.videos.filter((v) => v.views != null);
      const earnings = MT.seo.estimateEarnings({ monthlyViews: st.monthlyViews, rpmMin: s.rpmMin, rpmMax: s.rpmMax });
      const valuation = MT.seo.channelValuation(earnings);
      const c$ = cur(s);
      const dated = vids.filter((v) => v.publishedAt);
      const weekdayCounts = DAYS.map((d, i) => ({ label: d, value: dated.filter((v) => (new Date(v.publishedAt).getDay() + 6) % 7 === i).length }));
      const isMine = s.myChannelId === ch.channelId;
      const tagsBox = el('div', null, el('p', { class: 'mt-muted', style: 'margin-top:0' }, 'Analysez les tags des 15 dernières vidéos.'));

      MT.fill(
        out,
        A.card(
          null,
          ch.banner ? el('img', { src: ch.banner, alt: '', style: 'width:100%;max-height:150px;object-fit:cover;border-radius:10px;margin-bottom:12px' }) : null,
          el(
            'div',
            { class: 'mt-row', style: 'gap:16px;flex-wrap:nowrap;align-items:flex-start' },
            ch.avatar ? el('img', { src: ch.avatar, width: 80, height: 80, style: 'border-radius:50%;flex:none' }) : null,
            el(
              'div',
              { class: 'mt-grow' },
              el(
                'h2',
                { style: 'margin:0' },
                el('a', { href: ch.url || `https://www.youtube.com/channel/${ch.channelId}`, target: '_blank', rel: 'noopener' }, ch.title),
                ch.verified ? ' ✓' : ''
              ),
              el('div', { class: 'mt-muted' }, [ch.handle, ch.country, ch.joinedAt ? 'créée le ' + fmt.date(ch.joinedAt) : null].filter(Boolean).join(' · ')),
              ch.description
                ? el('details', { style: 'margin-top:6px' }, el('summary', { class: 'mt-small' }, 'Description'), el('p', { style: 'white-space:pre-wrap' }, ch.description))
                : null,
              ch.links.length
                ? el(
                    'div',
                    { class: 'mt-row', style: 'margin-top:6px' },
                    ch.links.map((l) => el('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer', class: 'mt-chip clickable' }, l.title || l.url))
                  )
                : null
            ),
            el(
              'div',
              { class: 'mt-col' },
              W.button(
                'Ajouter aux concurrents',
                async () => {
                  await MT.research.addCompetitor(ch.channelId);
                  W.toast('Ajoutée aux concurrents', 'success');
                },
                { size: 'sm', icon: 'users' }
              ),
              !isMine
                ? W.button(
                    'C’est ma chaîne',
                    async () => {
                      await MT.store.setSettings({ myChannelId: ch.channelId, myChannelTitle: ch.title });
                      W.toast('Chaîne enregistrée comme la vôtre', 'success');
                    },
                    { size: 'sm', icon: 'user' }
                  )
                : null,
              W.button('Meilleur moment', () => A.navigate('besttime', { c: ch.channelId }), { size: 'sm', icon: 'clock', busy: false }),
              W.button('Audit', () => A.navigate('audit', { c: ch.channelId }), { size: 'sm', icon: 'shield', busy: false }),
              W.button('Exporter', () => A.navigate('export', { c: ch.channelId }), { size: 'sm', icon: 'download', busy: false })
            )
          )
        ),
        A.card(
          'Statistiques',
          W.stats([
            { label: 'Abonnés', value: fmt.num(ch.subscribers), title: fmt.int(ch.subscribers) },
            { label: 'Vues totales', value: fmt.num(ch.totalViews), title: fmt.int(ch.totalViews) },
            { label: 'Vidéos', value: fmt.num(ch.videoCount) },
            { label: 'Vues moyennes (récentes)', value: fmt.num(st.avgViews) },
            { label: 'Vues médianes (récentes)', value: fmt.num(st.medianViews) },
            { label: 'Meilleure vidéo récente', value: fmt.num(st.maxViews) },
            { label: 'Publications / semaine', value: st.uploadsPerWeek != null ? fmt.dec(st.uploadsPerWeek) : '—' },
            { label: 'Vidéos sur 30 jours', value: st.uploadsLast30 },
            { label: 'Dernière publication', value: st.lastUploadAt ? fmt.ago(st.lastUploadAt) : '—' },
            { label: 'Vues / abonné', value: st.viewsPerSub != null ? fmt.pct(st.viewsPerSub, 1) : '—' },
            { label: 'Vues totales / vidéo', value: ch.totalViews && ch.videoCount ? fmt.num(ch.totalViews / ch.videoCount) : '—' },
            { label: 'Âge de la chaîne', value: ch.joinedAt ? fmt.dec((Date.now() - ch.joinedAt) / (365 * 86400000)) + ' ans' : '—' },
          ])
        ),
        A.grid(
          2,
          A.card(
            'Revenus estimés',
            W.stats([
              { label: 'Vues / mois (est.)', value: fmt.num(st.monthlyViews) },
              { label: 'Revenus / mois', value: earnings ? `${fmt.num(earnings.monthly.min)} – ${fmt.num(earnings.monthly.max)} ${c$}` : '—' },
              { label: 'Revenus / an', value: earnings ? `${fmt.num(earnings.yearly.min)} – ${fmt.num(earnings.yearly.max)} ${c$}` : '—' },
              { label: 'Valorisation indicative', value: valuation ? `${fmt.num(valuation.min)} – ${fmt.num(valuation.max)} ${c$}` : '—' },
            ]),
            el(
              'p',
              { class: 'mt-small mt-muted' },
              `Hypothèse : RPM de ${s.rpmMin} à ${s.rpmMax} ${c$} pour 1 000 vues (modifiable dans les paramètres). Estimation indicative : le RPM réel dépend de la niche, du pays et du format.`
            )
          ),
          A.card('Jours de publication (vidéos récentes)', W.barChart(weekdayCounts, { format: (v) => String(v) }))
        ),
        A.card('Vues des vidéos récentes', W.lineChart([{ name: 'Vues', points: dated.map((v) => ({ x: v.publishedAt, y: v.views })) }], { height: 200, area: true })),
        A.card(
          'Vidéos récentes',
          W.table(
            [
              { key: 'title', label: 'Vidéo', render: (v) => A.videoCell(v, { channel: false }) },
              { key: 'publishedAt', label: 'Publiée', num: true, render: (v) => (v.publishedAt ? fmt.date(v.publishedAt) : v.publishedText || '—') },
              { key: 'views', label: 'Vues', num: true, render: (v) => fmt.num(v.views) },
              {
                key: 'vpd',
                label: 'Vues/jour',
                num: true,
                sort: (v) => (v.publishedAt ? v.views / Math.max(1, (Date.now() - v.publishedAt) / 86400000) : null),
                render: (v) => (v.publishedAt ? fmt.num(v.views / Math.max(1, (Date.now() - v.publishedAt) / 86400000)) : '—'),
              },
              {
                key: 'perf',
                label: 'vs médiane',
                num: true,
                sort: (v) => (st.medianViews ? v.views / st.medianViews : null),
                render: (v) => {
                  if (!st.medianViews) return '—';
                  const r = v.views / st.medianViews;
                  return el('span', { style: { color: r >= 1.5 ? 'var(--mt-great)' : r < 0.6 ? 'var(--mt-bad)' : 'inherit', fontWeight: '600' } }, '× ' + fmt.dec(r, 1));
                },
              },
              { key: 'durationSec', label: 'Durée', num: true, render: (v) => (v.isShort ? 'Short' : fmt.duration(v.durationSec)) },
              {
                key: 'a',
                label: '',
                sortable: false,
                render: (v) => W.button('', () => A.navigate('videolytics', { v: v.videoId }), { size: 'sm', variant: 'ghost', icon: 'chart', title: 'Videolytics', busy: false }),
              },
            ],
            vids,
            { sortKey: 'publishedAt', maxHeight: '520px' }
          )
        ),
        A.grid(
          2,
          A.card(
            `Mots-clés de la chaîne (${ch.keywords.length})`,
            ch.keywords.length ? W.chips(ch.keywords, { onClick: (k) => A.navigate('keywords', { q: k }) }) : W.alert('Aucun mot-clé de chaîne.', 'warn'),
            ch.keywords.length
              ? el(
                  'div',
                  { style: 'margin-top:8px' },
                  W.copyButton(() => ch.keywords.join(', '), 'Copier')
                )
              : null
          ),
          A.card(
            'Tags les plus utilisés',
            tagsBox,
            W.button(
              'Analyser',
              async () => {
                MT.fill(tagsBox, W.spinner('Lecture des tags…'));
                const r = await MT.research.topTags(
                  vids.filter((v) => !v.isShort),
                  { limit: 15 }
                );
                MT.fill(
                  tagsBox,
                  el('p', { class: 'mt-muted', style: 'margin-top:0' }, `${r.analyzed} vidéos · ${fmt.dec(r.avgTagCount)} tags en moyenne`),
                  W.chips(r.tags.slice(0, 50), { badge: (t) => t.count, onClick: (t) => A.navigate('keywords', { q: t.tag }) }),
                  el(
                    'div',
                    { style: 'margin-top:8px' },
                    W.copyButton(
                      () =>
                        r.tags
                          .slice(0, 40)
                          .map((t) => t.tag)
                          .join(', '),
                      'Copier'
                    )
                  )
                );
              },
              { size: 'sm', icon: 'tag' }
            )
          )
        )
      );
    },
  });

  /* ------------------------------------------------- meilleur moment */

  /** Régression log(vues) = a + b·log(âge) pour neutraliser l'effet de l'âge. */
  function performanceScores(videos) {
    const pts = videos
      .filter((v) => v.views > 0 && v.publishedAt && Date.now() - v.publishedAt > 2 * 86400000)
      .map((v) => ({ v, x: Math.log((Date.now() - v.publishedAt) / 86400000), y: Math.log(v.views) }));
    if (pts.length < 3) return [];
    const mx = MT.mean(pts.map((p) => p.x));
    const my = MT.mean(pts.map((p) => p.y));
    const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    const b = pts.length >= 5 && sxx > 0 ? pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx : 0;
    const a = my - b * mx;
    return pts.map((p) => ({ ...p.v, perf: Math.exp(p.y - (a + b * p.x)) }));
  }

  async function datedVideos(channelId, auth) {
    if (auth) {
      try {
        const vids = await MT.ytapi.channelVideos(channelId, auth, { limit: 120, parts: 'snippet,statistics,contentDetails' });
        return vids.map((v) => ({ videoId: v.videoId, title: v.title, publishedAt: v.publishedAt, views: v.views, isShort: v.durationSec != null && v.durationSec <= 60 }));
      } catch (e) {
        /* repli RSS */
      }
    }
    const rss = await MT.yt.getRss(channelId);
    return rss.entries.map((e) => ({ videoId: e.videoId, title: e.title, publishedAt: e.publishedAt, views: e.views, isShort: e.isShort }));
  }

  A.register('besttime', {
    title: 'Meilleur moment',
    icon: 'clock',
    group: 'analysis',
    order: 5,
    description: 'Jours et heures de publication les plus performants',
    async render(c, params) {
      const s = await MT.store.getSettings();
      const competitors = await MT.store.list('competitors');
      MT.add(
        c,
        A.pageHead(
          'Meilleur moment pour publier',
          'Analyse les dates exactes de publication et les performances (corrigées de l’âge des vidéos) pour repérer les créneaux qui fonctionnent le mieux, dans votre fuseau horaire.',
          'clock'
        )
      );
      const channel = params.c || s.myChannelId;
      const includeComp = new Set();
      const compBox = competitors.length
        ? el(
            'div',
            { class: 'mt-row' },
            competitors.map((cp) => A.checkbox(cp.title, false, (on) => (on ? includeComp.add(cp.channelId) : includeComp.delete(cp.channelId))))
          )
        : el('span', { class: 'mt-muted' }, 'Ajoutez des concurrents pour comparer leurs créneaux.');
      const ci = A.channelInput({ value: channel || '', label: 'Analyser', onSubmit: (v) => A.navigate('besttime', { c: v }) });
      const out = el('div', { class: 'stack', style: 'margin-top:16px' });
      const run = async () => {
        const target = params.c || s.myChannelId;
        if (!target) return W.toast('Indiquez une chaîne', 'error');
        let auth = null;
        try {
          auth = await A.readAuth();
        } catch (e) {
          auth = null;
        }
        await A.withLoading(out, 'Collecte des dates de publication…', async () => {
          const id = await MT.yt.resolveChannel(target);
          const main = performanceScores(await datedVideos(id, auth));
          const comps = [];
          for (const cid of includeComp) comps.push(...performanceScores(await datedVideos(cid, auth)));
          if (main.length < 3) throw new Error('Pas assez de vidéos datées pour une analyse fiable.');
          const all = [...main, ...comps];
          const blocks = 8;
          const matrix = DAYS.map(() => Array.from({ length: blocks }, () => ({ sum: 0, count: 0 })));
          for (const v of all) {
            const d = new Date(v.publishedAt);
            const day = (d.getDay() + 6) % 7;
            const b = Math.floor(d.getHours() / 3);
            matrix[day][b].sum += Math.log(v.perf);
            matrix[day][b].count++;
          }
          const cells = matrix.map((row) => row.map((cell) => (cell.count ? { value: Math.exp(cell.sum / cell.count), count: cell.count } : null)));
          const hours = Array.from({ length: blocks }, (_, i) => `${String(i * 3).padStart(2, '0')}h`);
          const byDay = DAYS.map((d, i) => {
            const vs = all.filter((v) => (new Date(v.publishedAt).getDay() + 6) % 7 === i);
            return { label: `${d} (${vs.length})`, value: vs.length ? Math.exp(MT.mean(vs.map((v) => Math.log(v.perf)))) : 0 };
          });
          const byHour = hours.map((h, i) => {
            const vs = all.filter((v) => Math.floor(new Date(v.publishedAt).getHours() / 3) === i);
            return { label: `${h}–${String(i * 3 + 3).padStart(2, '0')}h (${vs.length})`, value: vs.length ? Math.exp(MT.mean(vs.map((v) => Math.log(v.perf)))) : 0 };
          });
          const slots = [];
          cells.forEach((row, d) => row.forEach((cell, b) => cell && cell.count >= 2 && slots.push({ d, b, ...cell })));
          slots.sort((a, b) => b.value - a.value);
          // repli quand peu de vidéos : meilleur jour et meilleur créneau pris séparément (2 vidéos minimum)
          const countOf = (label) => Number((label.match(/\((\d+)\)$/) || [])[1] || 0);
          const bestDay = byDay
            .map((x, i) => ({ ...x, i }))
            .filter((x) => countOf(x.label) >= 2)
            .sort((a, b) => b.value - a.value)[0];
          const bestHour = byHour
            .map((x, i) => ({ ...x, i }))
            .filter((x) => countOf(x.label) >= 2)
            .sort((a, b) => b.value - a.value)[0];
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          MT.fill(
            out,
            A.card(
              'Recommandation',
              slots.length
                ? el(
                    'ol',
                    null,
                    slots
                      .slice(0, 3)
                      .map((x) =>
                        el(
                          'li',
                          null,
                          el('strong', null, `${DAYS[x.d]} entre ${hours[x.b]} et ${String(x.b * 3 + 3).padStart(2, '0')}h`),
                          ` — performance × ${fmt.dec(x.value, 2)} (${x.count} vidéos)`
                        )
                      )
                  )
                : bestDay || bestHour
                  ? el(
                      'ul',
                      null,
                      bestDay ? el('li', null, el('strong', null, `Meilleur jour : ${DAYS[bestDay.i]}`), ` — performance × ${fmt.dec(bestDay.value, 2)}`) : null,
                      bestHour
                        ? el(
                            'li',
                            null,
                            el('strong', null, `Meilleur créneau : ${hours[bestHour.i]}–${String(bestHour.i * 3 + 3).padStart(2, '0')}h`),
                            ` — performance × ${fmt.dec(bestHour.value, 2)}`
                          )
                        : null,
                      el('li', { class: 'mt-muted' }, 'Pas encore assez de vidéos par combinaison jour + heure : ajoutez une clé API ou des concurrents pour affiner.')
                    )
                  : W.alert(
                      'Pas encore assez de publications (2 minimum par jour ou créneau) : publiez à différents moments ou ajoutez une clé API pour analyser plus de vidéos.',
                      'warn'
                    ),
              el(
                'p',
                { class: 'mt-small mt-muted' },
                `${main.length} vidéo(s) de la chaîne${comps.length ? ` + ${comps.length} de concurrents` : ''} · fuseau ${tz}. Une performance de × 1 correspond aux vues attendues pour l’âge de la vidéo. ${auth ? '' : 'Sans clé API, seules les 15 dernières vidéos de chaque chaîne (flux RSS) sont analysées.'}`
              )
            ),
            A.card(
              'Carte de chaleur (performance moyenne, nombre de vidéos)',
              W.heatmap(cells, DAYS, hours, { title: (cell) => `Performance × ${fmt.dec(cell.value, 2)} — ${cell.count} vidéo(s)` })
            ),
            A.grid(
              2,
              A.card('Par jour', W.barChart(byDay, { format: (v) => '× ' + fmt.dec(v, 2) })),
              A.card('Par créneau horaire', W.barChart(byHour, { format: (v) => '× ' + fmt.dec(v, 2) }))
            ),
            A.card(
              'Vidéos analysées',
              W.table(
                [
                  { key: 'title', label: 'Vidéo', render: (v) => A.videoCell(v, { channel: false }) },
                  { key: 'publishedAt', label: 'Publiée le', num: true, render: (v) => fmt.datetime(v.publishedAt) },
                  { key: 'views', label: 'Vues', num: true, render: (v) => fmt.num(v.views) },
                  { key: 'perf', label: 'Performance', num: true, render: (v) => '× ' + fmt.dec(v.perf, 2) },
                ],
                main,
                { sortKey: 'perf', maxHeight: '420px' }
              )
            )
          );
        });
      };
      MT.add(
        c,
        A.card(
          null,
          ci,
          el('div', { style: 'margin-top:10px' }, el('div', { class: 'mt-small mt-muted', style: 'margin-bottom:4px' }, 'Inclure les concurrents :'), compBox),
          el('div', { style: 'margin-top:10px' }, W.button('Lancer l’analyse', run, { variant: 'primary', icon: 'clock' }))
        ),
        out
      );
      if (channel) run();
    },
  });

  /* ---------------------------------------------------------------- audit */

  A.register('audit', {
    title: 'Audit de chaîne',
    icon: 'shield',
    group: 'analysis',
    order: 6,
    description: 'Bonnes pratiques, santé, score de chaque vidéo',
    async render(c, params) {
      const s = await MT.store.getSettings();
      const channel = params.c || s.myChannelId;
      MT.add(
        c,
        A.pageHead(
          'Audit de chaîne',
          'Vérifie les bonnes pratiques de la chaîne et de ses 20 dernières vidéos (titres, descriptions, tags, chapitres, hashtags, régularité, tendance) et repère les termes sensibles.',
          'shield'
        ),
        A.card(null, A.channelInput({ value: channel || '', label: 'Auditer', onSubmit: (v) => A.navigate('audit', { c: v }) }))
      );
      if (!channel) return;
      const out = el('div', { class: 'stack', style: 'margin-top:16px' });
      c.appendChild(out);
      const prog = W.progress();
      const res = await A.withLoading(out, 'Audit en cours (lecture des métadonnées de chaque vidéo)…', async () => {
        out.appendChild(prog);
        const ch = await MT.yt.getChannel(channel, { videoLimit: 25 });
        const list = ch.stats.videos.slice(0, 20);
        const details = await MT.pool(
          list,
          4,
          async (v) => {
            const d = await MT.yt.getVideo(v.videoId, { withNext: false });
            return { ...d, views: d.views != null ? d.views : v.views, publishedAt: d.publishedAt || v.publishedAt, isShort: v.isShort || d.isShort };
          },
          (d, t) => prog.set(d, t)
        );
        const videos = details.filter((d) => d && !d.error);
        const audit = MT.seo.channelAudit({ channel: { description: ch.description, keywords: ch.keywords, links: ch.links, banner: ch.banner }, videos });
        return { ch, videos, audit };
      });
      if (!res) return;
      const { ch, videos, audit } = res;
      const demo = videos.map((v) => ({ v, d: MT.seo.demonetizationAudit(v) })).filter((x) => x.d.findings.length);
      const label = MT.seo.scoreLabel(audit.score);
      const groups = [...new Set(audit.checks.map((x) => x.group))];
      MT.fill(
        out,
        A.card(
          null,
          el(
            'div',
            { class: 'mt-row', style: 'gap:20px' },
            W.gauge(audit.score, { size: 110, label: 'Santé' }),
            el(
              'div',
              null,
              el('h2', { style: 'margin:0' }, ch.title),
              el('div', { style: 'font-size:16px;font-weight:600' }, label.label),
              el(
                'div',
                { class: 'mt-muted' },
                `${videos.length} vidéos analysées · ${audit.checks.filter((x) => x.status === 'ok').length}/${audit.checks.length} vérifications réussies`
              )
            )
          )
        ),
        A.grid(2, ...groups.map((g) => A.card(g, W.checklist(audit.checks.filter((x) => x.group === g))))),
        A.card(
          'Score SEO de chaque vidéo',
          W.table(
            [
              { key: 'title', label: 'Vidéo', sort: (x) => x.video.title, render: (x) => A.videoCell(x.video, { channel: false }) },
              { key: 'score', label: 'Score', num: true, sort: (x) => x.seo.score, render: (x) => W.pill(x.seo.score) },
              { key: 'tags', label: 'Tags', num: true, sort: (x) => x.video.tags.length, render: (x) => String(x.video.tags.length) },
              { key: 'words', label: 'Mots desc.', num: true, sort: (x) => x.seo.stats.descriptionWords, render: (x) => String(x.seo.stats.descriptionWords) },
              {
                key: 'issues',
                label: 'Points à corriger',
                sortable: false,
                render: (x) =>
                  el(
                    'span',
                    { class: 'mt-small' },
                    x.seo.checks
                      .filter((k) => k.status === 'bad')
                      .slice(0, 3)
                      .map((k) => k.label)
                      .join(' · ') || '✓'
                  ),
              },
              {
                key: 'a',
                label: '',
                sortable: false,
                render: (x) =>
                  el(
                    'span',
                    { class: 'mt-row', style: 'gap:2px;flex-wrap:nowrap' },
                    W.button('', () => A.navigate('videolytics', { v: x.video.videoId }), { size: 'sm', variant: 'ghost', icon: 'chart', title: 'Videolytics', busy: false }),
                    W.button(
                      '',
                      async () => {
                        await MT.store.set('seoStudioDraft', { keyword: x.video.tags[0] || '', title: x.video.title, description: x.video.description, tags: x.video.tags });
                        A.navigate('seo-studio');
                      },
                      { size: 'sm', variant: 'ghost', icon: 'edit', title: 'Optimiser dans SEO Studio', busy: false }
                    )
                  ),
              },
            ],
            audit.videos,
            { sortKey: 'score', sortDir: 'asc' }
          )
        ),
        A.card(
          'Termes sensibles (démonétisation)',
          demo.length
            ? W.table(
                [
                  { key: 't', label: 'Vidéo', render: (x) => A.videoCell(x.v, { channel: false }) },
                  { key: 'r', label: 'Risque', num: true, sort: (x) => x.d.risk, render: (x) => `${x.d.level} (${x.d.risk})` },
                  { key: 'w', label: 'Termes', render: (x) => [...new Set(x.d.findings.map((f) => f.word))].join(', ') },
                ],
                demo,
                { sortKey: 'r' }
              )
            : W.alert('Aucun terme sensible détecté.', 'success')
        )
      );
    },
  });

  /* ------------------------------------------------------- démonétisation */

  function highlight(text, words) {
    if (!words.length) return el('span', null, text);
    // normalisation caractère par caractère : les indices restent alignés sur le texte d'origine
    const norm = [...text]
      .map((ch) => {
        const n = MT.stripAccents(ch).toLowerCase();
        return n.length === ch.length ? n : ch.toLowerCase();
      })
      .join('');
    const marks = [];
    for (const w of words) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^\\p{L}\\p{N}])`, 'gu');
      let m;
      while ((m = re.exec(norm))) marks.push([m.index + m[1].length, m.index + m[1].length + m[2].length]);
    }
    marks.sort((a, b) => a[0] - b[0]);
    const parts = [];
    let pos = 0;
    for (const [a, b] of marks) {
      if (a < pos) continue;
      parts.push(text.slice(pos, a), el('mark', { style: 'background:color-mix(in srgb,var(--mt-bad) 30%,transparent);color:inherit;border-radius:3px' }, text.slice(a, b)));
      pos = b;
    }
    parts.push(text.slice(pos));
    return el('span', { style: 'white-space:pre-wrap' }, parts);
  }

  A.register('demonetization', {
    title: 'Démonétisation',
    icon: 'money',
    group: 'analysis',
    order: 7,
    description: 'Repérer les termes à risque pour les annonceurs',
    render(c, params) {
      const title = A.input({ placeholder: 'Titre' });
      const desc = A.textarea({ rows: 8, placeholder: 'Description' });
      const tags = A.textarea({ rows: 3, placeholder: 'Tags (séparés par des virgules)' });
      const out = el('div', { class: 'stack', style: 'margin-top:16px' });
      const run = () => {
        const data = { title: title.value, description: desc.value, tags: MT.seo.parseTagInput(tags.value) };
        const r = MT.seo.demonetizationAudit(data);
        const words = [...new Set(r.findings.map((f) => f.word))];
        MT.fill(
          out,
          A.card(
            null,
            el(
              'div',
              { class: 'mt-row', style: 'gap:16px' },
              W.gauge(100 - r.risk, { size: 90, label: 'Sûreté' }),
              el(
                'div',
                null,
                el('div', { style: 'font-size:17px;font-weight:700' }, `Risque ${r.level}`),
                el('div', { class: 'mt-muted' }, r.findings.length ? `${words.length} terme(s) sensible(s) détecté(s)` : 'Aucun terme sensible détecté')
              )
            )
          ),
          r.findings.length
            ? A.card(
                'Termes détectés',
                W.table(
                  [
                    { key: 'word', label: 'Terme' },
                    { key: 'label', label: 'Catégorie' },
                    { key: 'severity', label: 'Gravité', render: (f) => ({ high: 'Élevée', medium: 'Moyenne', low: 'Faible' })[f.severity] },
                    { key: 'field', label: 'Champ' },
                    { key: 'count', label: 'Occurrences', num: true },
                  ],
                  r.findings,
                  { sortKey: 'severity', sortDir: 'asc' }
                )
              )
            : null,
          r.findings.length
            ? A.card(
                'Texte annoté',
                el('div', null, el('strong', null, 'Titre : '), highlight(data.title, words)),
                el('div', { style: 'margin-top:8px' }, el('strong', null, 'Description : '), highlight(data.description, words)),
                el('div', { style: 'margin-top:8px' }, el('strong', null, 'Tags : '), highlight(data.tags.join(', '), words))
              )
            : null,
          A.card(
            'Conseils',
            el(
              'ul',
              { class: 'help-list' },
              el('li', null, 'Le titre et la miniature pèsent le plus : évitez-y les mots sensibles.'),
              el('li', null, 'Les sujets d’actualité tragiques, la violence, les drogues et le contenu sexuel limitent souvent les annonces (icône jaune).'),
              el('li', null, 'Cet audit porte sur les métadonnées ; le contenu audio/visuel est aussi analysé par YouTube.'),
              el('li', null, 'En cas de démonétisation injustifiée, demandez un examen manuel dans YouTube Studio.')
            )
          )
        );
      };
      const load = async (id) => {
        const v = await MT.yt.getVideo(id, { withNext: false });
        title.value = v.title;
        desc.value = v.description;
        tags.value = v.tags.join(', ');
        run();
      };
      MT.add(
        c,
        A.pageHead(
          'Audit de démonétisation',
          'Vérifiez qu’aucun terme du titre, de la description ou des tags ne risque de limiter la publicité sur votre vidéo.',
          'money',
          W.button('Auditer toute une chaîne', () => A.navigate('audit'), { icon: 'shield', busy: false })
        ),
        A.card('Charger une vidéo', A.videoInput({ label: 'Charger', onSubmit: load })),
        A.card(
          'Ou saisir les métadonnées',
          A.field('Titre', title),
          A.field('Description', desc),
          A.field('Tags', tags),
          W.button('Analyser', run, { variant: 'primary', icon: 'shield', busy: false })
        ),
        out
      );
      if (params.v) load(params.v);
    },
  });

  /* ---------------------------------------------------------------- export */

  A.register('export', {
    title: 'Export de données',
    icon: 'download',
    group: 'manage',
    order: 10,
    description: 'Exporter les vidéos d’une chaîne en CSV/JSON',
    async render(c, params) {
      const s = await MT.store.getSettings();
      const st = await MT.oauth.status();
      const source = A.select(
        [
          ['public', 'Chaîne publique (sans connexion)'],
          ['mine', 'Mes vidéos via Google (y compris privées)'],
        ],
        st.connected && !params.c ? 'mine' : 'public'
      );
      const ci = A.input({ value: params.c || s.myChannelId || '', placeholder: 'URL, @handle ou UC…' });
      const limit = A.select(
        [
          ['30', '30 vidéos'],
          ['100', '100 vidéos'],
          ['300', '300 vidéos'],
          ['1000', 'Toutes (≤ 1000)'],
        ],
        '100'
      );
      const details = A.checkbox('Inclure tags et descriptions (plus lent sans clé API)', true);
      const out = el('div', { style: 'margin-top:16px' });
      let rows = [];
      const COLS = [
        { key: 'videoId', label: 'ID' },
        { label: 'URL', get: (r) => `https://www.youtube.com/watch?v=${r.videoId}` },
        { key: 'title', label: 'Titre' },
        { label: 'Publiée', get: (r) => (r.publishedAt ? new Date(r.publishedAt).toISOString() : '') },
        { key: 'views', label: 'Vues' },
        { key: 'likes', label: 'J’aime' },
        { key: 'comments', label: 'Commentaires' },
        { key: 'durationSec', label: 'Durée (s)' },
        { key: 'privacyStatus', label: 'Visibilité' },
        { label: 'Tags', get: (r) => (r.tags || []).join(', ') },
        { key: 'description', label: 'Description' },
      ];
      const run = async () => {
        const prog = W.progress();
        MT.fill(out, W.spinner('Récupération des vidéos…'), prog);
        const max = Number(limit.value);
        const withDetails = details.querySelector('input').checked;
        if (source.value === 'mine') {
          const list = await MT.ytapi.myVideos(await A.auth(), { limit: max, onProgress: (phase, d, t) => prog.set(d, t || max) });
          rows = list.map((v) => ({ ...v }));
        } else {
          const id = await MT.yt.resolveChannel(ci.value);
          if (s.apiKey) {
            rows = await MT.ytapi.channelVideos(id, { apiKey: s.apiKey }, { limit: max, onProgress: (phase, d, t) => prog.set(d, t || max) });
          } else {
            const vids = await MT.yt.getChannelVideos(id, { limit: max });
            rows = vids.map((v) => ({ ...v, publishedAt: v.ageSec != null ? Date.now() - v.ageSec * 1000 : null }));
            if (withDetails) {
              const det = await MT.pool(
                rows,
                4,
                (r) => MT.yt.player(r.videoId),
                (d, t) => prog.set(d, t)
              );
              det.forEach((d, i) => {
                if (d && !d.error)
                  Object.assign(rows[i], { tags: d.tags, description: d.description, publishedAt: d.publishedAt || rows[i].publishedAt, durationSec: d.durationSec });
              });
            }
          }
        }
        MT.fill(
          out,
          A.card(
            `${rows.length} vidéos`,
            el(
              'div',
              { class: 'mt-row', style: 'margin-bottom:10px' },
              W.button('Télécharger CSV', () => MT.download(`videos-${MT.today()}.csv`, MT.toCSV(rows, COLS), 'text/csv;charset=utf-8'), {
                variant: 'primary',
                icon: 'download',
                busy: false,
              }),
              W.button(
                'Télécharger JSON',
                () =>
                  MT.download(
                    `videos-${MT.today()}.json`,
                    JSON.stringify(
                      rows.map(({ raw, ...r }) => r),
                      null,
                      2
                    ),
                    'application/json'
                  ),
                { icon: 'download', busy: false }
              )
            ),
            W.table(
              [
                { key: 'title', label: 'Vidéo', render: (v) => A.videoCell(v, { channel: false }) },
                { key: 'publishedAt', label: 'Publiée', num: true, render: (v) => fmt.date(v.publishedAt) },
                { key: 'views', label: 'Vues', num: true, render: (v) => fmt.num(v.views) },
                { key: 'tags', label: 'Tags', num: true, sort: (v) => (v.tags || []).length, render: (v) => String((v.tags || []).length) },
              ],
              rows,
              { sortKey: 'publishedAt', maxHeight: '480px' }
            )
          )
        );
      };
      MT.add(
        c,
        A.pageHead('Export de données', 'Exportez les métadonnées et statistiques des vidéos d’une chaîne (sauvegarde, analyse dans un tableur).', 'download'),
        A.card(
          null,
          el('div', { class: 'grid cols-3' }, A.field('Source', source), A.field('Chaîne', ci), A.field('Nombre', limit)),
          details,
          el('div', { style: 'margin-top:10px' }, W.button('Récupérer', run, { variant: 'primary', icon: 'download' }))
        ),
        out
      );
    },
  });
})();
