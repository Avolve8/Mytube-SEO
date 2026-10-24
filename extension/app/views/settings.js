/* MyTube SEO — vue Paramètres : général, panneaux, clés API, connexion Google, IA, tâches automatiques, données. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  const REGIONS = [
    ['FR', 'France'],
    ['BE', 'Belgique'],
    ['CH', 'Suisse'],
    ['CA', 'Canada'],
    ['LU', 'Luxembourg'],
    ['MA', 'Maroc'],
    ['DZ', 'Algérie'],
    ['TN', 'Tunisie'],
    ['SN', 'Sénégal'],
    ['CI', 'Côte d’Ivoire'],
    ['US', 'États-Unis'],
    ['GB', 'Royaume-Uni'],
    ['DE', 'Allemagne'],
    ['ES', 'Espagne'],
    ['IT', 'Italie'],
    ['PT', 'Portugal'],
    ['BR', 'Brésil'],
    ['MX', 'Mexique'],
    ['IN', 'Inde'],
    ['JP', 'Japon'],
  ];
  const LANGS = [
    ['fr', 'Français'],
    ['en', 'Anglais'],
    ['es', 'Espagnol'],
    ['de', 'Allemand'],
    ['it', 'Italien'],
    ['pt', 'Portugais'],
  ];

  function section(id, title, ...children) {
    return el('section', { class: 'mt-card', id: 'section-' + id, style: 'scroll-margin-top:80px' }, el('h3', null, title), children);
  }

  A.register('settings', {
    title: 'Paramètres',
    icon: 'settings',
    group: 'system',
    order: 1,
    async render(c, params) {
      const s = await MT.store.getSettings();
      const st = await MT.oauth.status();
      const save = async (patch, msg = 'Enregistré') => {
        await MT.store.setSettings(patch);
        W.toast(msg, 'success');
      };

      /* général */
      const region = A.select(REGIONS, s.region);
      const lang = A.select(LANGS, s.language);
      const theme = A.select(
        [
          ['auto', 'Automatique (système)'],
          ['light', 'Clair'],
          ['dark', 'Sombre'],
        ],
        s.theme
      );
      region.addEventListener('change', () => save({ region: region.value }));
      lang.addEventListener('change', () => save({ language: lang.value }));
      theme.addEventListener('change', () => save({ theme: theme.value }));
      const notif = A.checkbox('Notifications (classements, alertes, tests A/B, mises à jour programmées)', s.notifications, (on) => save({ notifications: on }));

      /* chaîne */
      const myChannel = A.channelInput({
        value: s.myChannelId || '',
        label: 'Enregistrer',
        placeholder: '@handle, URL ou identifiant UC… de votre chaîne',
        onSubmit: async (v) => {
          const id = await MT.yt.resolveChannel(v);
          const ch = await MT.yt.getChannel(id, { withVideos: false });
          await MT.store.setSettings({ myChannelId: id, myChannelTitle: ch.title });
          await MT.store.set('myChannelCache', null);
          W.toast(`Chaîne enregistrée : ${ch.title}`, 'success');
          A.render();
        },
      });

      /* panneaux */
      const PANELS = [
        ['watch', 'Videolytics sur les vidéos'],
        ['search', 'Explorateur sur les résultats de recherche'],
        ['searchBadges', 'Badges sur chaque résultat de recherche'],
        ['channel', 'Channelytics sur les chaînes'],
        ['studio', 'Assistant YouTube Studio'],
        ['comments', 'Barre de réponses types / émojis'],
        ['shortcuts', 'Raccourcis clavier sur YouTube'],
      ];
      const panels = el(
        'div',
        { class: 'grid cols-2' },
        PANELS.map(([k, label]) => A.checkbox(label, s.panels[k] !== false, (on) => save({ panels: { [k]: on } })))
      );

      /* clé API YouTube */
      const apiKey = A.input({ value: s.apiKey, placeholder: 'AIza…', type: 'password', autocomplete: 'off' });
      const testKey = async () => {
        const key = apiKey.value.trim();
        if (!key) return W.toast('Saisissez une clé', 'error');
        await MT.ytapi.videos(['dQw4w9WgXcQ'], { apiKey: key }, 'statistics');
        W.toast('Clé API valide ✅', 'success');
      };

      /* OAuth */
      const clientId = A.input({ value: s.oauthClientId, placeholder: 'xxxxxxxx.apps.googleusercontent.com' });
      const redirect = MT.oauth.redirectUri();

      /* Claude */
      const claudeKey = A.input({ value: s.claudeApiKey, placeholder: 'sk-ant-…', type: 'password', autocomplete: 'off' });
      const model = A.select(
        MT.ai.MODELS.map((m) => [m.id, m.name]),
        s.claudeModel
      );
      const effort = A.select(
        [
          ['low', 'Rapide (effort faible)'],
          ['medium', 'Équilibré'],
          ['high', 'Approfondi'],
        ],
        s.claudeEffort
      );
      const engine = A.select(
        [
          ['google', 'Google Traduction (gratuit)'],
          ['claude', 'Claude'],
        ],
        s.translateEngine
      );
      engine.addEventListener('change', () => save({ translateEngine: engine.value }));

      /* tâches */
      const rankFreq = A.select(
        [
          ['6', 'Toutes les 6 h'],
          ['12', 'Toutes les 12 h'],
          ['24', 'Tous les jours'],
          ['72', 'Tous les 3 jours'],
          ['168', 'Chaque semaine'],
        ],
        String(s.rankFrequencyHours)
      );
      const compFreq = A.select(
        [
          ['12', 'Toutes les 12 h'],
          ['24', 'Tous les jours'],
          ['168', 'Chaque semaine'],
        ],
        String(s.competitorFrequencyHours)
      );
      const alertFreq = A.select(
        [
          ['1', 'Toutes les heures'],
          ['6', 'Toutes les 6 h'],
          ['12', 'Toutes les 12 h'],
          ['24', 'Tous les jours'],
        ],
        String(s.alertFrequencyHours)
      );
      rankFreq.addEventListener('change', () => save({ rankFrequencyHours: Number(rankFreq.value) }));
      compFreq.addEventListener('change', () => save({ competitorFrequencyHours: Number(compFreq.value) }));
      alertFreq.addEventListener('change', () => save({ alertFrequencyHours: Number(alertFreq.value) }));
      const log = await MT.store.list('jobLog');

      /* revenus */
      const rpmMin = A.input({ type: 'number', step: '0.1', min: 0, value: s.rpmMin });
      const rpmMax = A.input({ type: 'number', step: '0.1', min: 0, value: s.rpmMax });
      const currency = A.select(
        [
          ['EUR', 'Euro (€)'],
          ['USD', 'Dollar ($)'],
        ],
        s.currency
      );

      /* données */
      const importInput = el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
      importInput.addEventListener('change', async () => {
        const f = importInput.files[0];
        if (!f) return;
        try {
          await MT.store.importAll(JSON.parse(await f.text()));
          W.toast('Sauvegarde restaurée', 'success');
          A.render();
        } catch (e) {
          W.toast(e.message, 'error');
        }
      });
      let usage = null;
      try {
        usage = browser.storage.local.getBytesInUse ? await browser.storage.local.getBytesInUse(null) : null;
      } catch (e) {
        usage = null;
      }
      const granted = await browser.permissions.contains({ origins: ['*://*.youtube.com/*', 'https://suggestqueries.google.com/*'] }).catch(() => true);

      const nav = el(
        'div',
        { class: 'mt-row', style: 'margin-bottom:14px' },
        [
          ['general', 'Général'],
          ['channel', 'Ma chaîne'],
          ['panels', 'Panneaux'],
          ['apikey', 'Clé API YouTube'],
          ['google', 'Connexion Google'],
          ['ai', 'IA Claude'],
          ['jobs', 'Tâches automatiques'],
          ['money', 'Revenus'],
          ['data', 'Données'],
        ].map(([id, label]) =>
          el(
            'a',
            {
              class: 'mt-chip clickable',
              href: '#',
              onclick: (e) => {
                e.preventDefault();
                document.getElementById('section-' + id).scrollIntoView({ behavior: 'smooth' });
              },
            },
            label
          )
        )
      );

      MT.add(
        c,
        A.pageHead('Paramètres', 'Toutes les données restent dans votre navigateur. Les clés ne sont envoyées qu’aux services concernés (Google, Anthropic).', 'settings'),
        nav,
        el(
          'div',
          { class: 'stack' },
          !granted ? W.alert(el('span', null, 'L’accès à YouTube n’est pas encore autorisé. ', el('a', { href: '#/welcome' }, 'Autoriser maintenant')), 'error') : null,
          section(
            'general',
            'Général',
            el(
              'div',
              { class: 'grid cols-3' },
              A.field('Région des recherches', region, 'Classements et résultats non personnalisés de ce pays'),
              A.field('Langue de YouTube', lang),
              A.field('Thème', theme)
            ),
            notif
          ),
          section(
            'channel',
            'Ma chaîne',
            s.myChannelId ? el('p', null, 'Chaîne actuelle : ', el('a', { href: '#/channelytics?c=' + s.myChannelId }, s.myChannelTitle || s.myChannelId)) : null,
            myChannel
          ),
          section('panels', 'Panneaux sur YouTube', panels),
          section(
            'apikey',
            'Clé API YouTube (facultatif)',
            el(
              'p',
              { class: 'mt-muted', style: 'margin-top:0' },
              'Améliore la précision (j’aime et commentaires exacts, dates de publication précises, export complet) et permet d’analyser plus de vidéos pour le meilleur moment de publication. Gratuit : 10 000 unités/jour.'
            ),
            el(
              'div',
              { class: 'field-row' },
              apiKey,
              W.button('Tester', testKey, { icon: 'check' }),
              W.button('Enregistrer', () => save({ apiKey: apiKey.value.trim() }), { variant: 'primary', busy: false })
            ),
            el(
              'details',
              { style: 'margin-top:10px' },
              el('summary', null, 'Comment obtenir une clé ?'),
              el(
                'ol',
                { class: 'help-list' },
                el(
                  'li',
                  null,
                  'Ouvrez ',
                  el('a', { href: 'https://console.cloud.google.com/', target: '_blank', rel: 'noopener' }, 'Google Cloud Console'),
                  ' et créez un projet.'
                ),
                el('li', null, 'Menu « API et services » → « Bibliothèque » → activez « YouTube Data API v3 ».'),
                el('li', null, '« Identifiants » → « Créer des identifiants » → « Clé API ».'),
                el('li', null, 'Collez la clé ci-dessus (vous pouvez la restreindre à « YouTube Data API v3 »).')
              )
            )
          ),
          section(
            'google',
            'Connexion Google (OAuth) — gestion de votre chaîne',
            el(
              'p',
              { class: 'mt-muted', style: 'margin-top:0' },
              'Nécessaire pour : traitement en masse, tests A/B, mises à jour programmées, application des traductions et des miniatures, Analytics et rétention. Vous utilisez votre propre identifiant client : aucun serveur intermédiaire.'
            ),
            st.connected
              ? el(
                  'div',
                  { class: 'mt-row', style: 'margin-bottom:10px' },
                  st.channel && st.channel.avatar ? el('img', { src: st.channel.avatar, width: 32, height: 32, style: 'border-radius:50%' }) : null,
                  el('strong', null, st.channel ? st.channel.title : 'Compte connecté'),
                  el(
                    'span',
                    { class: 'mt-muted mt-small' },
                    st.valid ? `jeton valide jusqu’à ${fmt.datetime(st.expiresAt)}` : 'jeton expiré (renouvelé automatiquement si possible)'
                  ),
                  W.button(
                    'Déconnecter',
                    async () => {
                      await MT.oauth.logout();
                      A.render();
                    },
                    { size: 'sm', variant: 'ghost danger' }
                  )
                )
              : null,
            A.field(
              'Identifiant client OAuth',
              el(
                'div',
                { class: 'field-row' },
                clientId,
                W.button('Enregistrer', () => save({ oauthClientId: clientId.value.trim() }), { busy: false })
              )
            ),
            A.field('URI de redirection à autoriser', el('div', { class: 'field-row' }, A.input({ value: redirect, readOnly: true }), W.copyButton(redirect, 'Copier'))),
            W.button(
              st.connected ? 'Reconnecter / changer de chaîne' : 'Se connecter avec Google',
              async () => {
                await MT.store.setSettings({ oauthClientId: clientId.value.trim() });
                await MT.oauth.login({ interactive: true });
                W.toast('Compte Google connecté', 'success');
                A.render();
              },
              { variant: 'primary', icon: 'user' }
            ),
            el(
              'details',
              { style: 'margin-top:10px', open: params.section === 'google' && !s.oauthClientId },
              el('summary', null, 'Guide : créer votre identifiant client (5 minutes)'),
              el(
                'ol',
                { class: 'help-list' },
                el(
                  'li',
                  null,
                  'Dans ',
                  el('a', { href: 'https://console.cloud.google.com/', target: '_blank', rel: 'noopener' }, 'Google Cloud Console'),
                  ', créez (ou choisissez) un projet.'
                ),
                el('li', null, '« API et services » → « Bibliothèque » : activez « YouTube Data API v3 » et « YouTube Analytics API ».'),
                el('li', null, '« Écran de consentement OAuth » : type « Externe », renseignez le nom de l’application, ajoutez votre adresse comme utilisateur test.'),
                el('li', null, '« Identifiants » → « Créer des identifiants » → « ID client OAuth » → type « Application Web ».'),
                el('li', null, 'Dans « URI de redirection autorisés », collez l’URI ci-dessus, puis créez.'),
                el('li', null, 'Copiez l’« ID client » dans le champ ci-dessus et cliquez sur « Se connecter avec Google ». Choisissez la chaîne (compte de marque) à gérer.')
              )
            )
          ),
          section(
            'ai',
            'Assistant IA (Claude) — facultatif',
            el(
              'p',
              { class: 'mt-muted', style: 'margin-top:0' },
              'Génère des titres, descriptions, tags, idées de vidéos, textes de miniature, réponses aux commentaires et traductions. Clé à créer sur ',
              el('a', { href: 'https://console.anthropic.com/', target: '_blank', rel: 'noopener' }, 'console.anthropic.com'),
              ' (facturation à l’usage par Anthropic).'
            ),
            A.field('Clé API Claude', claudeKey),
            el('div', { class: 'grid cols-2' }, A.field('Modèle', model), A.field('Niveau de réflexion', effort)),
            el(
              'div',
              { class: 'mt-row' },
              W.button('Enregistrer', () => save({ claudeApiKey: claudeKey.value.trim(), claudeModel: model.value, claudeEffort: effort.value }), {
                variant: 'primary',
                busy: false,
              }),
              W.button(
                'Tester',
                async () => {
                  await MT.store.setSettings({ claudeApiKey: claudeKey.value.trim(), claudeModel: model.value, claudeEffort: effort.value });
                  const t = await MT.ai.titles({ keyword: 'recette de crêpes', topic: 'recette de crêpes facile', count: 2 });
                  W.toast('Claude répond ✅ : ' + t[0].title, 'success', 6000);
                },
                { icon: 'bolt' }
              )
            ),
            A.field('Moteur de traduction', engine)
          ),
          section(
            'jobs',
            'Tâches automatiques',
            el(
              'div',
              { class: 'grid cols-3' },
              A.field('Suivi de classement', rankFreq),
              A.field('Instantanés des concurrents', compFreq),
              A.field('Alertes de marque', alertFreq)
            ),
            el(
              'p',
              { class: 'mt-small mt-muted' },
              'Les tâches s’exécutent en arrière-plan lorsque Firefox est ouvert. Tests A/B : vérification toutes les 15 min ; mises à jour programmées : toutes les 5 min.'
            ),
            el(
              'div',
              { class: 'mt-row' },
              ['mt-rank', 'mt-competitors', 'mt-alerts', 'mt-ab', 'mt-scheduled'].map((name) =>
                W.button(
                  { 'mt-rank': 'Classements', 'mt-competitors': 'Concurrents', 'mt-alerts': 'Alertes', 'mt-ab': 'Tests A/B', 'mt-scheduled': 'Programmées' }[name],
                  async () => {
                    await MT.send('jobs.run', { name });
                    W.toast('Tâche exécutée', 'success');
                  },
                  { size: 'sm', icon: 'play' }
                )
              )
            ),
            log.length
              ? el(
                  'details',
                  { style: 'margin-top:10px' },
                  el('summary', null, `Journal (${log.length})`),
                  el(
                    'div',
                    { class: 'mt-small mt-muted' },
                    log.slice(0, 50).map((l) => el('div', null, `${fmt.datetime(l.t)} — ${l.job} : ${l.message}`))
                  )
                )
              : null
          ),
          section(
            'money',
            'Estimation des revenus',
            el('div', { class: 'grid cols-3' }, A.field('RPM minimum (pour 1 000 vues)', rpmMin), A.field('RPM maximum', rpmMax), A.field('Devise', currency)),
            W.button('Enregistrer', () => save({ rpmMin: Number(rpmMin.value) || 0, rpmMax: Number(rpmMax.value) || 0, currency: currency.value }), {
              variant: 'primary',
              busy: false,
            }),
            el('p', { class: 'mt-small mt-muted' }, 'Le RPM (revenu pour 1 000 vues) varie fortement selon la niche et le pays : finance/tech 3-10 €, divertissement/jeux 0,5-2 €.')
          ),
          section(
            'data',
            'Données',
            el(
              'p',
              { class: 'mt-muted', style: 'margin-top:0' },
              `Stockage local utilisé : ${usage != null ? fmt.num(usage / 1024) + ' Ko' : 'inconnu'}. La sauvegarde contient vos listes, profils, suivis, idées et paramètres (sans le jeton Google).`
            ),
            el(
              'div',
              { class: 'mt-row' },
              W.button(
                'Exporter une sauvegarde',
                async () => MT.download(`mytube-seo-sauvegarde-${MT.today()}.json`, JSON.stringify(await MT.store.exportAll(), null, 2), 'application/json'),
                { icon: 'download' }
              ),
              importInput,
              W.button('Importer une sauvegarde', () => importInput.click(), { icon: 'upload', busy: false }),
              W.button(
                'Tout effacer',
                async () => {
                  if (!(await W.confirm('Effacer toutes les données de MyTube SEO (paramètres, listes, suivis, idées…) ?', { danger: true, okLabel: 'Tout effacer' }))) return;
                  await MT.oauth.logout().catch(() => {});
                  await browser.storage.local.clear();
                  W.toast('Données effacées', 'success');
                  A.navigate('welcome');
                },
                { variant: 'ghost danger', icon: 'trash' }
              )
            )
          )
        )
      );
      if (params.section)
        setTimeout(() => {
          const t = document.getElementById('section-' + params.section);
          if (t) t.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    },
  });
})();
