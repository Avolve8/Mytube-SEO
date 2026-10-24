/*
 * MyTube SEO — panneau « Videolytics » sur les pages de lecture (/watch et /shorts) :
 * statistiques, tags (copie, classement par tag), score SEO, audit, outils (miniature, capture, export…).
 */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const P = MT.page;

  function currentVideoId() {
    return new URLSearchParams(location.search).get('v') || MT.videoIdFromUrl(location.pathname);
  }

  function captureFrame(videoId, title) {
    const video = document.querySelector('video.html5-main-video') || document.querySelector('#shorts-player video') || document.querySelector('video');
    if (!video || !video.videoWidth) {
      W.toast('Lecteur introuvable ou vidéo non chargée.', 'error');
      return;
    }
    try {
      const canvas = el('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      MT.send('frame.store', { dataUrl, videoId, title }).then(() => W.toast('Image capturée : ouverte dans l’éditeur de miniatures', 'success'));
    } catch (e) {
      W.toast('Capture impossible pour cette vidéo (protection du flux).', 'error');
    }
  }

  function exportVideo(video) {
    const data = {
      videoId: video.videoId,
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      title: video.title,
      description: video.description,
      tags: video.tags,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      publishedAt: video.publishedAt ? new Date(video.publishedAt).toISOString() : null,
      durationSec: video.durationSec,
      category: video.category,
      channel: video.channelName,
      channelId: video.channelId,
    };
    MT.download(`video-${video.videoId}.json`, JSON.stringify(data, null, 2), 'application/json');
  }

  function render(panel, videoId, settings, isShort) {
    const body = panel.body;
    const state = { video: null, keyword: '', ranks: {}, checking: false };

    async function load() {
      MT.fill(body, W.spinner('Analyse de la vidéo…'));
      const pr = P.playerResponse(videoId);
      if (pr) {
        state.video = MT.yt.parsePlayer(pr);
        draw(true);
      }
      try {
        const full = await P.yt('getVideo', videoId);
        const localTags = state.video ? state.video.tags : [];
        state.video = { ...full, tags: full.tags && full.tags.length ? full.tags : localTags };
        draw(false);
      } catch (e) {
        if (!state.video) {
          MT.fill(
            body,
            W.alert('Impossible de charger les données : ' + e.message, 'error'),
            el('div', { style: 'margin-top:8px' }, W.button('Réessayer', load, { size: 'sm', icon: 'refresh' }))
          );
        }
      }
    }

    let tabsEl = null;
    function draw(partial) {
      const v = state.video;
      if (!state.keyword) state.keyword = v.tags[0] || '';
      const seo = MT.seo.scoreVideo({ title: v.title, description: v.description, tags: v.tags, keyword: state.keyword, durationSec: v.durationSec, isShort });
      panel.setSub(`${v.views != null ? fmt.num(v.views) + ' vues · ' : ''}SEO ${seo.score}/100${partial ? ' · …' : ''}`);
      const current = tabsEl ? [...tabsEl.querySelectorAll('.mt-tab')].find((t) => t.classList.contains('active')) : null;
      tabsEl = W.tabs(
        [
          { id: 'overview', label: 'Aperçu', render: (c) => overview(c, v, seo) },
          { id: 'tags', label: `Tags (${v.tags.length})`, render: (c) => tagsTab(c, v) },
          { id: 'seo', label: 'SEO', render: (c) => seoTab(c, v) },
          { id: 'tools', label: 'Outils', render: (c) => toolsTab(c, v) },
        ],
        { initial: current ? current.dataset.id : 'overview' }
      );
      MT.fill(body, tabsEl);
    }

    function overview(c, v, seo) {
      const label = MT.seo.scoreLabel(seo.score);
      const ch = v.channel || {};
      MT.add(
        c,
        el(
          'div',
          { class: 'mt-row', style: 'align-items:flex-start;gap:12px;flex-wrap:nowrap' },
          el('div', { class: 'mt-gauge-box' }, W.gauge(seo.score, { size: 70, label: 'SEO' }), label.label),
          el(
            'div',
            { class: 'mt-grow' },
            W.stats([
              { label: 'Vues', value: fmt.num(v.views), title: fmt.int(v.views) },
              { label: 'Vues / jour', value: fmt.num(v.viewsPerDay) },
              { label: 'J’aime', value: fmt.num(v.likes), hint: v.likeRatio != null ? fmt.pct(v.likeRatio, 2) + ' des vues' : null },
              { label: 'Commentaires', value: fmt.num(v.comments) },
              { label: 'Engagement', value: v.engagement != null ? fmt.pct(v.engagement, 2) : '—', title: '(J’aime + commentaires) / vues' },
              { label: 'Durée', value: fmt.duration(v.durationSec) },
            ])
          )
        ),
        el(
          'dl',
          { class: 'mt-kv', style: 'margin-top:10px' },
          el('dt', null, 'Publiée'),
          el('dd', null, v.publishedAt ? `${fmt.date(v.publishedAt)} (${fmt.ago(v.publishedAt)})` : v.dateText || '—'),
          el('dt', null, 'Chaîne'),
          el('dd', null, `${v.channelName || ch.title || '—'}${ch.subscribers != null ? ' · ' + fmt.num(ch.subscribers) + ' abonnés' : ''}`),
          ch.subscribers ? el('dt', null, 'Vues / abonné') : null,
          ch.subscribers ? el('dd', null, v.views != null ? fmt.dec(v.views / ch.subscribers, 2) : '—') : null,
          el('dt', null, 'Catégorie'),
          el('dd', null, v.category || '—'),
          el('dt', null, 'Sous-titres'),
          el('dd', null, v.captions && v.captions.length ? v.captions.map((t) => t.lang + (t.auto ? ' (auto)' : '')).join(', ') : 'Aucun'),
          el('dt', null, 'Tous publics'),
          el('dd', null, v.isFamilySafe ? 'Oui' : 'Non')
        )
      );
    }

    async function checkRanks(v, rerender) {
      if (state.checking) return;
      state.checking = true;
      const list = v.tags.slice(0, 15);
      try {
        for (const tag of list) {
          state.ranks[tag] = '…';
          rerender();
          try {
            const r = await MT.send('rank.check', { videoId: v.videoId, keyword: tag, maxResults: 50 });
            state.ranks[tag] = r.rank != null ? '#' + r.rank : r.inShelf ? 'Shorts' : '>50';
          } catch (e) {
            state.ranks[tag] = '?';
          }
          rerender();
        }
      } finally {
        state.checking = false;
      }
    }

    function tagsTab(c, v) {
      const chars = MT.seo.tagsLength(v.tags);
      const list = el('div');
      const rerender = () => {
        MT.fill(
          list,
          v.tags.length
            ? W.chips(v.tags, {
                onClick: (t) => MT.openApp('keywords?q=' + encodeURIComponent(t)),
                badge: (t) => state.ranks[t] || '',
                title: (t) => `${t} — cliquer pour analyser ce mot-clé`,
              })
            : W.alert('Cette vidéo n’utilise aucun tag (ou ils sont masqués).', 'warn')
        );
      };
      rerender();
      const hashtags = MT.text.extractHashtags(v.description + ' ' + v.title);
      MT.add(
        c,
        el(
          'div',
          { class: 'mt-row', style: 'justify-content:space-between;margin-bottom:8px' },
          el('span', { class: 'mt-muted' }, `${v.tags.length} tags · ${chars}/500 caractères`),
          el('span', { class: 'mt-row', style: 'gap:4px' }, v.tags.length ? W.copyButton(() => v.tags.join(', '), 'Copier') : null)
        ),
        list,
        v.tags.length
          ? el(
              'div',
              { class: 'mt-row', style: 'margin-top:10px' },
              W.button('Classement par tag', () => checkRanks(v, rerender), {
                size: 'sm',
                icon: 'trophy',
                title: 'Position de cette vidéo dans la recherche pour chaque tag (top 50)',
              }),
              W.button(
                'Suivre',
                async () => {
                  const tracked = v.tags.slice(0, 5);
                  for (const k of tracked) await MT.send('rank.track', { videoId: v.videoId, keyword: k, title: v.title });
                  W.toast(`${tracked.length} mot(s)-clé(s) ajouté(s) au suivi de classement`, 'success');
                },
                { size: 'sm', icon: 'chart', title: 'Suivre le classement des 5 premiers tags' }
              ),
              W.button(
                'Enregistrer en liste',
                async () => {
                  await MT.store.upsert('tagLists', { id: MT.uid(), name: v.title.slice(0, 60), tags: v.tags, createdAt: Date.now() });
                  W.toast('Liste de tags enregistrée', 'success');
                },
                { size: 'sm', icon: 'list' }
              )
            )
          : null,
        hashtags.length ? P.section('Hashtags', W.chips(hashtags)) : null
      );
    }

    function seoTab(c, v) {
      const input = el('input', { class: 'mt-input', value: state.keyword, placeholder: 'Mot-clé cible' });
      const out = el('div');
      const update = () => {
        state.keyword = input.value.trim();
        const seo = MT.seo.scoreVideo({ title: v.title, description: v.description, tags: v.tags, keyword: state.keyword, durationSec: v.durationSec, isShort });
        const demo = MT.seo.demonetizationAudit(v);
        MT.fill(
          out,
          el(
            'div',
            { class: 'mt-row', style: 'margin:8px 0' },
            W.pill(seo.score),
            el('strong', null, MT.seo.scoreLabel(seo.score).label),
            el('span', { class: 'mt-muted' }, `pour « ${seo.keyword || '—'} »`)
          ),
          W.checklist(seo.checks),
          P.section(
            'Audit de démonétisation',
            demo.findings.length
              ? el(
                  'div',
                  null,
                  W.alert(`Risque ${demo.level} (${demo.risk}/100) : ${[...new Set(demo.findings.map((f) => f.word))].slice(0, 8).join(', ')}`, demo.risk >= 50 ? 'error' : 'warn')
                )
              : W.alert('Aucun terme sensible détecté.', 'success')
          ),
          P.section(
            'Description',
            W.stats([
              { label: 'Mots', value: fmt.int(seo.stats.descriptionWords) },
              { label: 'Liens', value: seo.stats.links.length },
              { label: 'Chapitres', value: seo.stats.chapters.length },
              { label: 'Hashtags', value: seo.stats.hashtags.length },
            ])
          )
        );
      };
      input.addEventListener('input', MT.debounce(update, 300));
      MT.add(c, el('label', { class: 'mt-small mt-muted' }, 'Mot-clé cible (par défaut : premier tag)'), input, out);
      update();
    }

    function toolsTab(c, v) {
      const mine = settings.myChannelId && settings.myChannelId === v.channelId;
      const btn = (label, icon, fn, title) => W.button(label, fn, { size: 'sm', icon, title });
      MT.add(
        c,
        el(
          'div',
          { class: 'mt-row' },
          btn('Analyse complète', 'chart', () => MT.openApp('videolytics?v=' + v.videoId)),
          btn('Capturer l’image', 'image', () => captureFrame(v.videoId, v.title), 'Capturer l’image actuelle pour créer une miniature'),
          el('a', { class: 'mt-btn sm', href: MT.thumbUrl(v.videoId, 'maxresdefault'), target: '_blank', rel: 'noopener' }, W.icon('download'), 'Miniature HD'),
          btn('Commentaires', 'comment', () => MT.openApp('comments?v=' + v.videoId), 'Nuage de mots, sentiment, questions'),
          btn('Tirage au sort', 'gift', () => MT.openApp('comments?v=' + v.videoId + '&tab=winner')),
          btn(
            'Concurrent',
            'users',
            async () => {
              await MT.send('competitor.add', { input: v.channelId });
              W.toast('Chaîne ajoutée aux concurrents', 'success');
            },
            'Ajouter cette chaîne au suivi des concurrents'
          ),
          btn(
            'Idée',
            'star',
            async () => {
              await MT.send('idea.add', { title: v.title, keyword: state.keyword, notes: 'Inspiration : https://www.youtube.com/watch?v=' + v.videoId });
              W.toast('Ajouté au planificateur de vidéos', 'success');
            },
            'Ajouter au planificateur comme inspiration'
          ),
          btn('Exporter', 'download', () => exportVideo(v)),
          W.copyButton(() => v.title, 'Titre'),
          W.copyButton(() => v.description, 'Description'),
          mine
            ? el(
                'a',
                { class: 'mt-btn sm primary', href: `https://studio.youtube.com/video/${v.videoId}/edit`, target: '_blank', rel: 'noopener' },
                W.icon('edit'),
                'Modifier dans Studio'
              )
            : null
        )
      );
    }

    load();
  }

  P.register({
    name: 'watch',
    enabled: (s) => s.panels.watch,
    match: (loc) => (loc.pathname === '/watch' && !!new URLSearchParams(loc.search).get('v')) || /^\/shorts\/[\w-]{11}/.test(loc.pathname),
    async start(loc, settings) {
      const videoId = currentVideoId();
      const isShort = loc.pathname.startsWith('/shorts/');
      const panel = P.createPanel({ id: 'watch', title: 'Videolytics', floating: isShort, position: isShort ? 'left top' : '' });
      if (isShort) document.documentElement.appendChild(panel.host);
      else {
        await P.mountPanel(panel, [
          { selector: 'ytd-watch-flexy #secondary-inner', where: 'prepend' },
          { selector: 'ytd-watch-flexy #secondary', where: 'prepend' },
          { selector: 'ytd-watch-flexy #below', where: 'prepend' },
        ]);
      }
      render(panel, videoId, settings, isShort);
      return () => panel.destroy();
    },
  });

  MT.watch = { captureFrame, currentVideoId };
})();
