/*
 * MyTube SEO — panneau « Channelytics » sur les pages de chaînes :
 * statistiques, rythme de publication, revenus estimés, mots-clés de chaîne, liens, raccourcis.
 */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const P = MT.page;

  const CHANNEL_PATH = /^\/(@[^/]+|channel\/UC[\w-]{22}|c\/[^/]+|user\/[^/]+)/;

  function channelInput(loc) {
    const m = loc.pathname.match(CHANNEL_PATH);
    return m ? 'https://www.youtube.com/' + m[1] : null;
  }

  function render(panel, input, settings) {
    const body = panel.body;
    MT.fill(body, W.spinner('Analyse de la chaîne…'));
    P.yt('getChannel', input, { videoLimit: 30 })
      .then((ch) => {
        const s = ch.stats || {};
        const earnings = MT.seo.estimateEarnings({ monthlyViews: s.monthlyViews, rpmMin: settings.rpmMin, rpmMax: settings.rpmMax });
        const cur = settings.currency === 'USD' ? '$' : '€';
        panel.setSub(`${ch.title} · ${fmt.num(ch.subscribers)} abonnés`);
        const ageYears = ch.joinedAt ? (Date.now() - ch.joinedAt) / (365 * 86400000) : null;
        MT.fill(
          body,
          W.stats([
            { label: 'Abonnés', value: fmt.num(ch.subscribers), title: fmt.int(ch.subscribers) },
            { label: 'Vues totales', value: fmt.num(ch.totalViews), title: fmt.int(ch.totalViews) },
            { label: 'Vidéos', value: fmt.num(ch.videoCount) },
            { label: 'Vues médianes (récentes)', value: fmt.num(s.medianViews) },
            { label: 'Publications / semaine', value: s.uploadsPerWeek != null ? fmt.dec(s.uploadsPerWeek) : '—' },
            { label: 'Dernière vidéo', value: s.lastUploadAt ? fmt.ago(s.lastUploadAt).replace('il y a ', '') : '—' },
            { label: 'Vues / mois (est.)', value: fmt.num(s.monthlyViews) },
            {
              label: 'Revenus / mois (est.)',
              value: earnings ? `${fmt.num(earnings.monthly.min)}–${fmt.num(earnings.monthly.max)} ${cur}` : '—',
              title: `Hypothèse RPM ${settings.rpmMin}–${settings.rpmMax} ${cur} (modifiable dans les paramètres)`,
            },
          ]),
          el(
            'dl',
            { class: 'mt-kv', style: 'margin-top:10px' },
            el('dt', null, 'Création'),
            el('dd', null, ch.joinedAt ? `${fmt.date(ch.joinedAt)}${ageYears ? ` (${fmt.dec(ageYears)} ans)` : ''}` : '—'),
            el('dt', null, 'Pays'),
            el('dd', null, ch.country || '—'),
            el('dt', null, 'Vues / abonné'),
            el('dd', null, s.viewsPerSub != null ? fmt.pct(s.viewsPerSub, 1) + ' des abonnés regardent une vidéo (médiane)' : '—'),
            el('dt', null, 'Identifiant'),
            el('dd', null, ch.channelId)
          ),
          ch.keywords && ch.keywords.length
            ? P.section(
                el('span', null, `Mots-clés de la chaîne (${ch.keywords.length})`),
                W.chips(ch.keywords, { onClick: (k) => MT.openApp('keywords?q=' + encodeURIComponent(k)) }),
                el(
                  'div',
                  { style: 'margin-top:6px' },
                  W.copyButton(() => ch.keywords.join(', '), 'Copier les mots-clés')
                )
              )
            : P.section('Mots-clés de la chaîne', W.alert('Aucun mot-clé de chaîne défini.', 'warn')),
          ch.links && ch.links.length
            ? P.section(
                'Liens',
                el(
                  'div',
                  { class: 'mt-col', style: 'gap:3px' },
                  ch.links.map((l) => el('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.title || l.url))
                )
              )
            : null,
          el(
            'div',
            { class: 'mt-row', style: 'margin-top:12px' },
            W.button('Analyse complète', () => MT.openApp('channelytics?c=' + encodeURIComponent(ch.channelId)), { size: 'sm', icon: 'chart' }),
            W.button(
              'Ajouter aux concurrents',
              async () => {
                await MT.send('competitor.add', { input: ch.channelId });
                W.toast('Chaîne ajoutée aux concurrents', 'success');
              },
              { size: 'sm', icon: 'users' }
            ),
            W.button('Meilleur moment', () => MT.openApp('besttime?c=' + encodeURIComponent(ch.channelId)), { size: 'sm', icon: 'clock' }),
            W.button('Audit', () => MT.openApp('audit?c=' + encodeURIComponent(ch.channelId)), { size: 'sm', icon: 'shield' }),
            W.button('Exporter (CSV)', () => MT.openApp('export?c=' + encodeURIComponent(ch.channelId)), { size: 'sm', icon: 'download' }),
            settings.myChannelId !== ch.channelId
              ? W.button(
                  'C’est ma chaîne',
                  async () => {
                    await MT.store.setSettings({ myChannelId: ch.channelId, myChannelTitle: ch.title });
                    W.toast('Chaîne définie comme la vôtre', 'success');
                  },
                  { size: 'sm', variant: 'ghost', icon: 'user' }
                )
              : null
          )
        );
      })
      .catch((e) => {
        MT.fill(body, W.alert('Analyse impossible : ' + e.message, 'error'));
      });
  }

  P.register({
    name: 'channel',
    enabled: (s) => s.panels.channel,
    match: (loc) => CHANNEL_PATH.test(loc.pathname),
    async start(loc, settings) {
      const input = channelInput(loc);
      // Un seul panneau par chaîne : la navigation entre onglets (/videos, /shorts…) ne recharge pas les données
      const key = input.toLowerCase();
      const panel = P.createPanel({ id: 'channel', title: 'Channelytics' });
      await P.mountPanel(panel, [
        { selector: 'ytd-browse[page-subtype="channels"]:not([hidden]) #page-header', where: 'after' },
        { selector: 'ytd-browse[page-subtype="channels"]:not([hidden]) #tabs-container', where: 'before' },
        { selector: 'ytd-browse[page-subtype="channels"]:not([hidden]) #contents', where: 'prepend' },
      ]);
      panel.host.dataset.channel = key;
      render(panel, input, settings);
      return () => panel.destroy();
    },
  });
})();
