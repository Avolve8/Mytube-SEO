/* MyTube SEO — vue Analytics & rétention (YouTube Analytics API, connexion Google requise). */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  const TRAFFIC = {
    YT_SEARCH: 'Recherche YouTube',
    RELATED_VIDEO: 'Vidéos suggérées',
    SUBSCRIBER: 'Fil d’abonnements',
    BROWSE: 'Accueil / fonctionnalités de navigation',
    EXT_URL: 'Sites externes',
    NO_LINK_OTHER: 'Accès direct / inconnu',
    PLAYLIST: 'Playlists',
    YT_CHANNEL: 'Pages de chaînes',
    YT_OTHER_PAGE: 'Autres pages YouTube',
    NOTIFICATION: 'Notifications',
    SHORTS: 'Flux Shorts',
    END_SCREEN: 'Écrans de fin',
    ANNOTATION: 'Fiches / annotations',
    HASHTAGS: 'Pages de hashtags',
    CAMPAIGN_CARD: 'Cartes de campagne',
    ADVERTISING: 'Publicité YouTube',
    SOUND_PAGE: 'Pages de sons',
    LIVE_REDIRECT: 'Redirections de live',
    VIDEO_REMIXES: 'Remix',
    IMMERSIVE_LIVE: 'Live immersif',
    PRODUCT_PAGE: 'Pages produits',
  };
  const DEVICES = { DESKTOP: 'Ordinateur', MOBILE: 'Mobile', TABLET: 'Tablette', TV: 'Télévision', GAME_CONSOLE: 'Console', UNKNOWN_PLATFORM: 'Autre' };

  function range(days) {
    const end = Date.now() - 2 * 86400000; // les données Analytics ont ~48 h de retard
    return { startDate: MT.ytapi.isoDate(end - days * 86400000), endDate: MT.ytapi.isoDate(end) };
  }

  async function retention(container, video, auth, period) {
    await A.withLoading(container, 'Chargement de la courbe de rétention…', async () => {
      const rows = await MT.ytapi.analytics(
        {
          ...range(period),
          metrics: 'audienceWatchRatio,relativeRetentionPerformance',
          dimensions: 'elapsedVideoTimeRatio',
          filters: `video==${video.videoId}`,
          sort: 'elapsedVideoTimeRatio',
        },
        auth
      );
      if (!rows.length) throw new Error('Pas assez de données de rétention pour cette vidéo sur la période.');
      const dur = video.durationSec || 0;
      const pts = rows.map((r) => ({ x: r.elapsedVideoTimeRatio * 100, y: r.audienceWatchRatio * 100 }));
      const rel = rows.map((r) => ({ x: r.elapsedVideoTimeRatio * 100, y: r.relativeRetentionPerformance * 100 }));
      const drops = [];
      for (let i = 1; i < rows.length; i++) drops.push({ at: rows[i].elapsedVideoTimeRatio, drop: (rows[i - 1].audienceWatchRatio - rows[i].audienceWatchRatio) * 100 });
      drops.sort((a, b) => b.drop - a.drop);
      const at30 = rows.find((r) => r.elapsedVideoTimeRatio >= Math.min(0.99, 30 / Math.max(30, dur))) || rows[0];
      const end = rows[rows.length - 1];
      MT.fill(
        container,
        W.stats([
          { label: 'Spectateurs restants après 30 s', value: fmt.pct(at30.audienceWatchRatio, 0) },
          { label: 'Spectateurs restants à la fin', value: fmt.pct(end.audienceWatchRatio, 0) },
          { label: 'Durée', value: fmt.duration(dur) },
        ]),
        el(
          'div',
          { style: 'margin-top:12px' },
          W.lineChart(
            [
              { name: 'Audience restante (%)', points: pts },
              { name: 'Rétention relative (50 % = moyenne des vidéos de durée similaire)', points: rel },
            ],
            { height: 240, xFormat: (x) => (dur ? fmt.duration((x / 100) * dur) : Math.round(x) + ' %'), yFormat: (y) => Math.round(y) + ' %' }
          )
        ),
        el('div', { class: 'mt-section-title', style: 'margin-top:12px' }, 'Plus fortes chutes d’audience'),
        el(
          'ol',
          null,
          drops
            .slice(0, 5)
            .filter((d) => d.drop > 0)
            .map((d) =>
              el(
                'li',
                null,
                el(
                  'a',
                  { href: `https://www.youtube.com/watch?v=${video.videoId}&t=${Math.floor(d.at * dur)}s`, target: '_blank', rel: 'noopener' },
                  dur ? fmt.duration(d.at * dur) : fmt.pct(d.at, 0)
                ),
                ` — perte de ${fmt.dec(d.drop, 1)} points d’audience`
              )
            )
        ),
        el(
          'p',
          { class: 'mt-small mt-muted' },
          'Au-delà de 100 % en début de vidéo : relectures. Rétention relative : 50 % correspond à la moyenne des vidéos YouTube de durée similaire, au-dessus c’est mieux. Examinez les passages des plus fortes chutes (intro trop longue, temps mort, promesse non tenue).'
        )
      );
    });
  }

  A.register('analytics', {
    title: 'Analytics & rétention',
    icon: 'chart',
    group: 'analysis',
    order: 8,
    oauth: true,
    description: 'Statistiques privées, sources de trafic, rétention',
    async render(c, params) {
      c.appendChild(
        A.pageHead(
          'Analytics & rétention',
          'Vos statistiques privées YouTube Analytics : vues, durée de visionnage, sources de trafic, termes de recherche, pays, appareils et courbe de rétention de chaque vidéo.',
          'chart'
        )
      );
      if (!(await A.oauthGate(c, 'L’accès aux statistiques privées de votre chaîne nécessite la connexion Google (YouTube Analytics API).'))) return;
      const period = A.select(
        [
          ['7', '7 derniers jours'],
          ['28', '28 derniers jours'],
          ['90', '90 derniers jours'],
          ['365', '365 derniers jours'],
        ],
        params.p || '28'
      );
      period.addEventListener('change', () => A.navigate('analytics', { p: period.value }));
      const days = Number(period.value);
      c.appendChild(
        A.card(
          null,
          el(
            'div',
            { class: 'mt-row' },
            el('strong', null, 'Période'),
            el('div', { style: 'width:240px' }, period),
            el('span', { class: 'mt-muted mt-small' }, 'Les données ont environ 48 h de retard.')
          )
        )
      );
      const out = el('div', { class: 'stack', style: 'margin-top:16px' });
      c.appendChild(out);
      await A.withLoading(out, 'Chargement des statistiques…', async () => {
        const auth = await A.auth();
        const r = range(days);
        const q = (p) => MT.ytapi.analytics({ ...r, ...p }, auth).catch((e) => ({ error: e.message }));
        const [totals, daily, top, traffic, terms, countries, devices] = await Promise.all([
          q({ metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares' }),
          q({ metrics: 'views,estimatedMinutesWatched,subscribersGained', dimensions: 'day', sort: 'day' }),
          q({ metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained', dimensions: 'video', sort: '-views', maxResults: 25 }),
          q({ metrics: 'views', dimensions: 'insightTrafficSourceType', sort: '-views' }),
          q({ metrics: 'views', dimensions: 'insightTrafficSourceDetail', filters: 'insightTrafficSourceType==YT_SEARCH', sort: '-views', maxResults: 25 }),
          q({ metrics: 'views', dimensions: 'country', sort: '-views', maxResults: 10 }),
          q({ metrics: 'views', dimensions: 'deviceType', sort: '-views' }),
        ]);
        if (totals.error) throw new Error(totals.error);
        const t = totals[0] || {};
        const myVideos = await A.loadMyVideos().catch(() => []);
        const byId = new Map(myVideos.map((v) => [v.videoId, v]));
        const errBox = (x) => (x && x.error ? W.alert(x.error, 'warn') : null);
        const retentionBox = el(
          'div',
          null,
          el('p', { class: 'mt-muted', style: 'margin-top:0' }, 'Choisissez une vidéo dans le tableau « Meilleures vidéos » (icône courbe) ou ci-dessous.')
        );
        const pickVideo = A.select(
          [
            ['', '— Choisir une vidéo —'],
            ...myVideos
              .filter((v) => v.privacyStatus === 'public')
              .slice(0, 200)
              .map((v) => [v.videoId, v.title]),
          ],
          params.v || ''
        );
        pickVideo.addEventListener('change', () => pickVideo.value && retention(retentionBox, byId.get(pickVideo.value), auth, days));
        MT.fill(
          out,
          A.card(
            'Vue d’ensemble',
            W.stats([
              { label: 'Vues', value: fmt.num(t.views) },
              { label: 'Heures de visionnage', value: fmt.num((t.estimatedMinutesWatched || 0) / 60) },
              { label: 'Durée moyenne de visionnage', value: fmt.duration(t.averageViewDuration) },
              { label: 'Pourcentage moyen regardé', value: t.averageViewPercentage != null ? fmt.dec(t.averageViewPercentage, 1) + ' %' : '—' },
              { label: 'Abonnés gagnés', value: fmt.num(t.subscribersGained) },
              { label: 'Abonnés perdus', value: fmt.num(t.subscribersLost) },
              { label: 'Solde abonnés', value: fmt.signed((t.subscribersGained || 0) - (t.subscribersLost || 0)) },
              { label: 'J’aime', value: fmt.num(t.likes) },
              { label: 'Commentaires', value: fmt.num(t.comments) },
              { label: 'Partages', value: fmt.num(t.shares) },
            ])
          ),
          daily.error
            ? errBox(daily)
            : A.grid(
                2,
                A.card('Vues par jour', W.lineChart([{ name: 'Vues', points: daily.map((d) => ({ x: Date.parse(d.day), y: d.views })) }], { area: true })),
                A.card('Abonnés gagnés par jour', W.lineChart([{ name: 'Abonnés', points: daily.map((d) => ({ x: Date.parse(d.day), y: d.subscribersGained })) }], { area: true }))
              ),
          A.card(
            'Meilleures vidéos de la période',
            top.error
              ? errBox(top)
              : W.table(
                  [
                    { key: 'video', label: 'Vidéo', render: (r) => A.videoCell({ videoId: r.video, title: (byId.get(r.video) || {}).title || r.video }, { channel: false }) },
                    { key: 'views', label: 'Vues', num: true, render: (r) => fmt.num(r.views) },
                    { key: 'estimatedMinutesWatched', label: 'Heures', num: true, render: (r) => fmt.num(r.estimatedMinutesWatched / 60) },
                    { key: 'averageViewDuration', label: 'Durée moy.', num: true, render: (r) => fmt.duration(r.averageViewDuration) },
                    { key: 'averageViewPercentage', label: '% regardé', num: true, render: (r) => fmt.dec(r.averageViewPercentage, 1) + ' %' },
                    { key: 'subscribersGained', label: 'Abonnés', num: true, render: (r) => fmt.num(r.subscribersGained) },
                    {
                      key: 'a',
                      label: '',
                      sortable: false,
                      render: (r) =>
                        W.button(
                          '',
                          () => {
                            if (![...pickVideo.options].some((o) => o.value === r.video))
                              pickVideo.appendChild(el('option', { value: r.video }, (byId.get(r.video) || {}).title || r.video));
                            pickVideo.value = r.video;
                            retention(retentionBox, byId.get(r.video) || { videoId: r.video }, auth, days);
                            retentionBox.scrollIntoView({ behavior: 'smooth' });
                          },
                          { size: 'sm', variant: 'ghost', icon: 'chart', title: 'Courbe de rétention', busy: false }
                        ),
                    },
                  ],
                  top,
                  { sortKey: 'views' }
                )
          ),
          A.card('Analyse de la rétention', A.field('Vidéo', pickVideo), retentionBox),
          A.grid(
            2,
            A.card(
              'Sources de trafic',
              traffic.error
                ? errBox(traffic)
                : W.barChart(
                    traffic.map((x) => ({ label: TRAFFIC[x.insightTrafficSourceType] || x.insightTrafficSourceType, value: x.views })),
                    { valueLabel: 'Vues' }
                  )
            ),
            A.card(
              'Termes de recherche YouTube',
              terms.error
                ? errBox(terms)
                : terms.length
                  ? W.table(
                      [
                        {
                          key: 'insightTrafficSourceDetail',
                          label: 'Recherche',
                          render: (x) => el('a', { href: '#/keywords?q=' + encodeURIComponent(x.insightTrafficSourceDetail) }, x.insightTrafficSourceDetail),
                        },
                        { key: 'views', label: 'Vues', num: true, render: (x) => fmt.num(x.views) },
                      ],
                      terms,
                      { sortKey: 'views', maxHeight: '360px' }
                    )
                  : W.empty('Aucun terme de recherche sur la période.')
            )
          ),
          A.grid(
            2,
            A.card(
              'Pays',
              countries.error
                ? errBox(countries)
                : W.barChart(
                    countries.map((x) => ({ label: x.country, value: x.views })),
                    { valueLabel: 'Vues' }
                  )
            ),
            A.card(
              'Appareils',
              devices.error
                ? errBox(devices)
                : W.barChart(
                    devices.map((x) => ({ label: DEVICES[x.deviceType] || x.deviceType, value: x.views })),
                    { valueLabel: 'Vues' }
                  )
            )
          )
        );
        if (params.v && byId.get(params.v)) retention(retentionBox, byId.get(params.v), auth, days);
      });
    },
  });
})();
