/* MyTube SEO — vues : tableau de bord, bienvenue (configuration initiale), aide. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  const STUDIO_LINKS = [
    ['Tableau de bord Studio', 'https://studio.youtube.com/', 'home'],
    ['Contenu', 'https://studio.youtube.com/channel/UC/videos', 'list'],
    ['Statistiques', 'https://studio.youtube.com/channel/UC/analytics', 'chart'],
    ['Commentaires', 'https://studio.youtube.com/channel/UC/comments', 'comment'],
    ['Sous-titres', 'https://studio.youtube.com/channel/UC/translations', 'translate'],
    ['Monétisation', 'https://studio.youtube.com/channel/UC/monetization', 'money'],
    ['Personnalisation', 'https://studio.youtube.com/channel/UC/editing', 'edit'],
    ['Mettre en ligne', 'https://www.youtube.com/upload', 'upload'],
  ];

  function studioLinks(channelId) {
    return el(
      'div',
      { class: 'mt-row' },
      STUDIO_LINKS.map(([label, url, icon]) =>
        el(
          'a',
          { class: 'mt-btn sm', href: channelId ? url.replace('/channel/UC/', `/channel/${channelId}/`) : url.replace('/channel/UC', ''), target: '_blank', rel: 'noopener' },
          W.icon(icon),
          label
        )
      )
    );
  }

  const MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1e6, 5e6, 1e7, 5e7, 1e8];
  function nextMilestone(n) {
    return MILESTONES.find((m) => m > (n || 0)) || null;
  }

  async function myChannelCard() {
    const s = await MT.store.getSettings();
    const box = el('div');
    if (!s.myChannelId) {
      const ci = A.channelInput({
        label: 'Définir',
        placeholder: 'Votre chaîne : @handle ou URL',
        onSubmit: async (v) => {
          const id = await MT.yt.resolveChannel(v);
          const ch = await MT.yt.getChannel(id, { withVideos: false });
          await MT.store.setSettings({ myChannelId: id, myChannelTitle: ch.title });
          W.toast('Chaîne enregistrée', 'success');
          A.render();
        },
      });
      return A.card(
        'Ma chaîne',
        el('p', { class: 'mt-muted', style: 'margin-top:0' }, 'Indiquez votre chaîne pour des scores pondérés, le suivi de vos objectifs et des raccourcis personnalisés.'),
        ci
      );
    }
    A.withLoading(box, 'Chargement de votre chaîne…', async () => {
      const ch = await MT.yt.getChannel(s.myChannelId, { videoLimit: 15 });
      await MT.store.set('myChannelCache', {
        channelId: ch.channelId,
        title: ch.title,
        avatar: ch.avatar,
        subscribers: ch.subscribers,
        avgViews: ch.stats.medianViews,
        t: Date.now(),
      });
      const next = nextMilestone(ch.subscribers);
      const prev = MILESTONES.filter((m) => m <= (ch.subscribers || 0)).pop() || 0;
      MT.fill(
        box,
        el(
          'div',
          { class: 'mt-row', style: 'gap:14px;flex-wrap:nowrap;margin-bottom:12px' },
          ch.avatar ? el('img', { src: ch.avatar, width: 56, height: 56, style: 'border-radius:50%' }) : null,
          el('div', { class: 'mt-grow' }, el('div', { style: 'font-size:17px;font-weight:700' }, ch.title), el('div', { class: 'mt-muted' }, ch.handle || ch.channelId))
        ),
        W.stats([
          { label: 'Abonnés', value: fmt.num(ch.subscribers) },
          { label: 'Vues totales', value: fmt.num(ch.totalViews) },
          { label: 'Vidéos', value: fmt.num(ch.videoCount) },
          { label: 'Vues médianes', value: fmt.num(ch.stats.medianViews) },
          { label: 'Publications / sem.', value: ch.stats.uploadsPerWeek != null ? fmt.dec(ch.stats.uploadsPerWeek) : '—' },
          { label: 'Vues / mois (est.)', value: fmt.num(ch.stats.monthlyViews) },
        ]),
        next
          ? el(
              'div',
              { style: 'margin-top:12px' },
              W.meter(`Prochain objectif : ${fmt.num(next)} abonnés`, ((ch.subscribers - prev) / (next - prev)) * 100, { text: `${fmt.num(ch.subscribers)} / ${fmt.num(next)}` })
            )
          : null,
        el(
          'div',
          { class: 'mt-row', style: 'margin-top:12px' },
          W.button('Channelytics', () => A.navigate('channelytics', { c: ch.channelId }), { size: 'sm', icon: 'chart', busy: false }),
          W.button('Audit', () => A.navigate('audit', { c: ch.channelId }), { size: 'sm', icon: 'shield', busy: false }),
          W.button('Objectifs', () => A.navigate('milestones'), { size: 'sm', icon: 'trophy', busy: false })
        )
      );
    });
    return A.card('Ma chaîne', box);
  }

  async function rankCard() {
    const items = await MT.store.list('rankTracking');
    if (!items.length)
      return A.card(
        'Suivi de classement',
        W.empty('Aucun mot-clé suivi.'),
        W.button('Ajouter un suivi', () => A.navigate('rank'), { size: 'sm', icon: 'plus', busy: false })
      );
    const rows = items.map((i) => {
      const h = i.history || [];
      const prev = h.length > 1 ? h[h.length - 2].rank : null;
      return { ...i, delta: i.lastRank != null && prev != null ? prev - i.lastRank : null };
    });
    return A.card(
      `Suivi de classement (${items.length})`,
      W.table(
        [
          { key: 'keyword', label: 'Mot-clé' },
          { key: 'lastRank', label: 'Rang', num: true, render: (r) => (r.lastRank != null ? '#' + r.lastRank : r.lastChecked ? '—' : '…') },
          {
            key: 'delta',
            label: 'Évol.',
            num: true,
            render: (r) => (r.delta ? el('span', { style: { color: r.delta > 0 ? 'var(--mt-great)' : 'var(--mt-bad)' } }, (r.delta > 0 ? '▲' : '▼') + Math.abs(r.delta)) : '—'),
          },
        ],
        rows.slice(0, 8),
        { sortKey: 'lastRank', sortDir: 'asc' }
      ),
      el(
        'div',
        { style: 'margin-top:8px' },
        W.button('Tout voir', () => A.navigate('rank'), { size: 'sm', variant: 'ghost', busy: false })
      )
    );
  }

  async function competitorsCard() {
    const list = await MT.store.list('competitors');
    if (!list.length)
      return A.card(
        'Concurrents',
        W.empty('Aucun concurrent suivi.'),
        W.button('Ajouter', () => A.navigate('competitors'), { size: 'sm', icon: 'plus', busy: false })
      );
    return A.card(
      `Concurrents (${list.length})`,
      el(
        'div',
        { class: 'mt-col' },
        list.slice(0, 6).map((c) => {
          const h = c.history || [];
          const last = h[h.length - 1] || {};
          const week = h.filter((x) => x.t <= Date.now() - 6 * 86400000).pop();
          const delta = week && last.subscribers != null && week.subscribers != null ? last.subscribers - week.subscribers : null;
          return el(
            'div',
            { class: 'mt-row', style: 'flex-wrap:nowrap' },
            c.avatar ? el('img', { src: c.avatar, width: 28, height: 28, style: 'border-radius:50%' }) : null,
            el('a', { class: 'mt-grow mt-ellipsis', href: '#/channelytics?c=' + c.channelId }, c.title),
            el('span', { class: 'mt-muted' }, fmt.num(last.subscribers)),
            delta != null ? el('span', { style: { color: delta >= 0 ? 'var(--mt-great)' : 'var(--mt-bad)' } }, fmt.signed(delta)) : null
          );
        })
      ),
      el(
        'div',
        { style: 'margin-top:8px' },
        W.button('Tableau comparatif', () => A.navigate('competitors'), { size: 'sm', variant: 'ghost', busy: false })
      )
    );
  }

  async function keywordsCard() {
    const hist = await MT.store.list('keywordHistory');
    const ki = A.keywordInput({ onSubmit: (q) => A.navigate('keywords', { q }) });
    return A.card(
      'Explorer un mot-clé',
      ki,
      hist.length
        ? el(
            'div',
            { style: 'margin-top:12px' },
            el('div', { class: 'mt-small mt-muted', style: 'margin-bottom:6px' }, 'Recherches récentes'),
            W.chips(hist.slice(0, 14), {
              badge: (h) => h.overall,
              tone: (h) => W.toneOf(h.overall),
              onClick: (h) => A.navigate('keywords', { q: h.keyword }),
              title: (h) => `${h.keyword} — score ${h.overall}`,
            })
          )
        : null
    );
  }

  async function plannerCard() {
    const ideas = await MT.store.list('ideas');
    const by = (s) => ideas.filter((i) => i.status === s).length;
    return A.card(
      'Planificateur',
      W.stats([
        { label: 'Idées', value: by('idea') },
        { label: 'En production', value: by('research') + by('script') + by('filming') + by('editing') },
        { label: 'Programmées', value: by('scheduled') },
        { label: 'Publiées', value: by('published') },
      ]),
      el(
        'div',
        { style: 'margin-top:8px' },
        W.button('Ouvrir', () => A.navigate('planner'), { size: 'sm', variant: 'ghost', busy: false })
      )
    );
  }

  async function alertsCard() {
    const alerts = await MT.store.list('alerts');
    const hits = alerts
      .flatMap((a) => (a.hits || []).map((h) => ({ ...h, term: a.term })))
      .sort((a, b) => b.foundAt - a.foundAt)
      .slice(0, 5);
    return A.card(
      'Alertes',
      hits.length
        ? el(
            'div',
            { class: 'mt-col' },
            hits.map((h) =>
              el(
                'div',
                null,
                el('a', { href: `https://www.youtube.com/watch?v=${h.videoId}`, target: '_blank', rel: 'noopener' }, h.title),
                el('div', { class: 'mt-small mt-muted' }, `« ${h.term} » · ${h.channelName || ''} · ${fmt.ago(h.foundAt)}`)
              )
            )
          )
        : W.empty(alerts.length ? 'Aucune nouvelle vidéo détectée' : 'Aucune alerte configurée'),
      el(
        'div',
        { style: 'margin-top:8px' },
        W.button('Gérer les alertes', () => A.navigate('alerts'), { size: 'sm', variant: 'ghost', busy: false })
      )
    );
  }

  function toolsGrid() {
    const groups = ['research', 'analysis', 'create', 'community', 'manage'];
    const tools = [...A.views.values()].filter((v) => groups.includes(v.group) && !v.hidden);
    return A.card(
      'Tous les outils',
      el(
        'div',
        { class: 'grid cols-4' },
        tools.map((v) =>
          el(
            'a',
            { href: '#/' + v.id, class: 'mt-card', style: 'box-shadow:none;display:flex;gap:10px;align-items:flex-start;color:var(--mt-fg);padding:10px' },
            el('span', { style: 'color:var(--mt-accent)' }, W.icon(v.icon, 20)),
            el('span', null, el('strong', null, v.title, v.oauth ? ' 🔑' : ''), el('div', { class: 'mt-small mt-muted' }, v.description || ''))
          )
        )
      )
    );
  }

  A.register('home', {
    title: 'Tableau de bord',
    icon: 'home',
    group: 'home',
    order: 1,
    async render(c) {
      const s = await MT.store.getSettings();
      c.appendChild(A.pageHead('Tableau de bord', 'Vue d’ensemble de votre chaîne, de vos recherches et de vos suivis.', 'home'));
      const [mine, kw, rank, comp, plan, alerts] = await Promise.all([myChannelCard(), keywordsCard(), rankCard(), competitorsCard(), plannerCard(), alertsCard()]);
      c.appendChild(
        el(
          'div',
          { class: 'stack' },
          A.grid(2, mine, kw),
          A.card('Raccourcis YouTube Studio', studioLinks(s.myChannelId)),
          A.grid(3, rank, comp, el('div', { class: 'stack' }, plan, alerts)),
          toolsGrid()
        )
      );
    },
  });

  /* ------------------------------------------------------------ bienvenue */

  const REQUIRED_ORIGINS = ['*://*.youtube.com/*', 'https://suggestqueries.google.com/*'];

  A.register('welcome', {
    title: 'Bienvenue',
    icon: 'star',
    group: 'home',
    hidden: true,
    async render(c) {
      const granted = await browser.permissions.contains({ origins: REQUIRED_ORIGINS }).catch(() => true);
      const s = await MT.store.getSettings();
      c.appendChild(A.pageHead('Bienvenue dans MyTube SEO 👋', 'Quelques étapes pour profiter de tous les outils. Seule la première est indispensable.', 'star'));
      const steps = el('div', { class: 'stack' });
      steps.appendChild(
        A.card(
          '1. Autoriser l’accès à YouTube ' + (granted ? '✅' : ''),
          el(
            'p',
            null,
            'L’extension lit les pages publiques de YouTube (recherche, vidéos, chaînes) et l’autocomplétion pour calculer les scores. Aucune donnée n’est envoyée à un serveur tiers.'
          ),
          granted
            ? W.alert('Accès accordé.', 'success')
            : W.button(
                'Autoriser l’accès',
                async () => {
                  const ok = await browser.permissions.request({
                    origins: [
                      ...REQUIRED_ORIGINS,
                      'https://www.googleapis.com/*',
                      'https://youtubeanalytics.googleapis.com/*',
                      'https://oauth2.googleapis.com/*',
                      'https://i.ytimg.com/*',
                      'https://yt3.ggpht.com/*',
                      'https://translate.googleapis.com/*',
                      'https://api.anthropic.com/*',
                    ],
                  });
                  W.toast(ok ? 'Accès accordé' : 'Accès refusé', ok ? 'success' : 'error');
                  A.render();
                },
                { variant: 'primary', icon: 'check' }
              )
        )
      );
      steps.appendChild(
        A.card(
          '2. Indiquer votre chaîne ' + (s.myChannelId ? '✅' : '(recommandé)'),
          s.myChannelId
            ? el('p', null, `Chaîne : ${s.myChannelTitle || s.myChannelId}`)
            : A.channelInput({
                label: 'Enregistrer',
                placeholder: '@votre-handle ou URL de votre chaîne',
                onSubmit: async (v) => {
                  const id = await MT.yt.resolveChannel(v);
                  const ch = await MT.yt.getChannel(id, { withVideos: false });
                  await MT.store.setSettings({ myChannelId: id, myChannelTitle: ch.title });
                  A.render();
                },
              })
        )
      );
      steps.appendChild(
        A.card(
          '3. Options avancées (facultatif)',
          el(
            'ul',
            { class: 'help-list' },
            el('li', null, el('strong', null, 'Clé API YouTube'), ' : statistiques exactes (j’aime, commentaires), dates précises pour « Meilleur moment pour publier ».'),
            el(
              'li',
              null,
              el('strong', null, 'Connexion Google (OAuth)'),
              ' : traitement en masse, tests A/B, mises à jour programmées, traductions appliquées, Analytics et rétention.'
            ),
            el('li', null, el('strong', null, 'Clé API Claude'), ' : génération de titres, descriptions, tags, idées et réponses aux commentaires.')
          ),
          W.button('Configurer dans les paramètres', () => A.navigate('settings'), { busy: false, icon: 'settings' })
        )
      );
      steps.appendChild(
        A.card(
          '4. Sur YouTube',
          el(
            'p',
            null,
            'Ouvrez une vidéo, une recherche ou une chaîne : les panneaux MyTube SEO apparaissent automatiquement. Dans YouTube Studio, l’assistant SEO s’affiche à droite lors de la modification d’une vidéo.'
          ),
          el('a', { class: 'mt-btn primary', href: 'https://www.youtube.com/', target: '_blank', rel: 'noopener' }, 'Ouvrir YouTube')
        )
      );
      c.appendChild(steps);
    },
  });

  /* ---------------------------------------------------------------- aide */

  A.register('help', {
    title: 'Aide & raccourcis',
    icon: 'help',
    group: 'system',
    order: 90,
    description: 'Fonctionnalités, raccourcis, limites',
    render(c) {
      const li = (title, text) => el('li', null, el('strong', null, title), ' — ', text);
      c.append(
        A.pageHead('Aide', 'Toutes les fonctionnalités de MyTube SEO et comment les utiliser.', 'help'),
        el(
          'div',
          { class: 'stack' },
          A.card(
            'Sur YouTube',
            el(
              'ul',
              { class: 'help-list' },
              li('Videolytics', 'panneau à droite de chaque vidéo : statistiques, tags (copie, classement par tag), score SEO, audit de démonétisation, capture d’image, export.'),
              li(
                'Explorateur de recherche',
                'sur les résultats de recherche : score du mot-clé, recherches associées, tags les plus utilisés, badges « vues/jour », rang et tags sur chaque résultat.'
              ),
              li('Channelytics', 'sur les pages de chaîne : abonnés, vues, rythme de publication, revenus estimés, mots-clés de chaîne.'),
              li('Commentaires', 'barre d’outils sous les zones de réponse : réponses types (variables {auteur}, {chaine}, {date}), émojis, suggestions IA.'),
              li(
                'YouTube Studio',
                'assistant SEO en direct pendant la modification ou la mise en ligne : score, mot-clé, suggestions et insertion de tags, profils, checklist, IA.'
              )
            )
          ),
          A.card(
            'Raccourcis clavier',
            el(
              'ul',
              { class: 'help-list' },
              el('li', null, el('kbd', null, 'Alt'), '+', el('kbd', null, 'Maj'), '+', el('kbd', null, 'Y'), ' : ouvrir le tableau de bord (partout)'),
              el('li', null, el('kbd', null, 'Alt'), '+', el('kbd', null, 'Maj'), '+', el('kbd', null, 'K'), ' : explorateur de mots-clés (partout)'),
              el('li', null, el('kbd', null, 'Alt'), '+', el('kbd', null, 'Maj'), '+', el('kbd', null, 'T'), ' : copier les tags de la vidéo'),
              el('li', null, el('kbd', null, 'Alt'), '+', el('kbd', null, 'Maj'), '+', el('kbd', null, 'V'), ' : Videolytics complet'),
              el('li', null, el('kbd', null, 'Alt'), '+', el('kbd', null, 'Maj'), '+', el('kbd', null, 'E'), ' : modifier la vidéo dans Studio'),
              el('li', null, el('kbd', null, 'Alt'), '+', el('kbd', null, 'Maj'), '+', el('kbd', null, 'C'), ' : capturer l’image pour une miniature'),
              el('li', null, el('kbd', null, 'Alt'), '+', el('kbd', null, 'Maj'), '+', el('kbd', null, 'P'), ' : masquer / afficher les panneaux'),
              el('li', null, 'Les raccourcis globaux sont modifiables dans Firefox : about:addons → ⚙️ → Gérer les raccourcis.')
            )
          ),
          A.card(
            'Données et limites',
            el(
              'ul',
              { class: 'help-list' },
              li(
                'Sans clé',
                'les données publiques proviennent des pages YouTube et de l’autocomplétion. Les volumes de recherche sont des estimations relatives (YouTube ne publie pas de volumes exacts).'
              ),
              li('Quota API', 'la clé API YouTube offre 10 000 unités/jour : lecture = 1 unité, modification d’une vidéo = 50 unités, miniature = 50 unités.'),
              li('Tâches automatiques', 'suivi de classement, concurrents, alertes, tests A/B et mises à jour programmées s’exécutent quand Firefox est ouvert.'),
              li('Non disponible via l’API', 'cartes, écrans de fin et taux de clics des impressions ne sont pas accessibles par l’API publique de YouTube.'),
              li('Confidentialité', 'tout est stocké localement dans Firefox. Les clés et jetons ne quittent votre navigateur que vers Google ou Anthropic.')
            )
          )
        )
      );
    },
  });

  MT.home = { studioLinks, nextMilestone, MILESTONES };
})();
