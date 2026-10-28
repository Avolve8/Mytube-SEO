/* MyTube SEO — vue Videolytics : analyse complète d'une vidéo (statistiques, SEO, tags et classements, miniatures). */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  async function imageToDataUrl(url) {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error('Image indisponible');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  }
  A.imageToDataUrl = imageToDataUrl;

  function tagRanksCard(v) {
    const rows = v.tags.slice(0, 25).map((tag) => ({ tag, rank: undefined, overall: null }));
    const box = el('div');
    const draw = () =>
      MT.fill(
        box,
        W.table(
          [
            { key: 'tag', label: 'Tag', render: (r) => el('a', { href: '#/keywords?q=' + encodeURIComponent(r.tag) }, r.tag) },
            {
              key: 'rank',
              label: 'Position (top 100)',
              num: true,
              render: (r) => (r.rank === undefined ? '—' : r.rank === '…' ? '…' : r.rank != null ? el('strong', null, '#' + r.rank) : '>100'),
            },
            { key: 'overall', label: 'Score du mot-clé', num: true, render: (r) => (r.overall != null ? W.pill(r.overall) : '—') },
            {
              key: 'act',
              label: '',
              sortable: false,
              render: (r) =>
                W.button(
                  'Suivre',
                  async () => {
                    await MT.research.trackRank({ videoId: v.videoId, keyword: r.tag, title: v.title });
                    W.toast('Ajouté au suivi de classement', 'success');
                  },
                  { size: 'sm', variant: 'ghost', icon: 'chart' }
                ),
            },
          ],
          rows,
          { sortKey: 'rank', sortDir: 'asc' }
        )
      );
    draw();
    const run = async () => {
      for (const r of rows) {
        r.rank = '…';
        draw();
        try {
          const [rk, sc] = await Promise.all([MT.yt.rankOf(v.videoId, r.tag, { maxResults: 100 }), MT.research.quickScore(r.tag).catch(() => null)]);
          r.rank = rk.rank;
          r.overall = sc ? sc.overall : null;
        } catch (e) {
          r.rank = null;
        }
        draw();
      }
    };
    return A.card(
      `Tags (${v.tags.length}) · ${MT.seo.tagsLength(v.tags)}/500 caractères`,
      v.tags.length ? W.chips(v.tags, { onClick: (t) => A.navigate('keywords', { q: t }) }) : W.alert('Aucun tag sur cette vidéo.', 'warn'),
      v.tags.length
        ? el(
            'div',
            { class: 'mt-row', style: 'margin:10px 0' },
            W.copyButton(() => v.tags.join(', '), 'Copier les tags'),
            W.button('Classement & score de chaque tag', run, { size: 'sm', variant: 'primary', icon: 'trophy' }),
            W.button(
              'Enregistrer en liste',
              async () => {
                await MT.store.upsert('tagLists', { id: MT.uid(), name: v.title.slice(0, 60), tags: v.tags, createdAt: Date.now() });
                W.toast('Liste enregistrée', 'success');
              },
              { size: 'sm', icon: 'list' }
            )
          )
        : null,
      v.tags.length ? box : null
    );
  }

  A.register('videolytics', {
    title: 'Videolytics',
    icon: 'play',
    group: 'analysis',
    order: 1,
    description: 'Analyse complète de n’importe quelle vidéo',
    async render(c, params) {
      MT.add(
        c,
        A.pageHead('Videolytics', 'Analyse complète d’une vidéo : performances, SEO, tags et classements, comparaison avec la chaîne.', 'play'),
        A.card(null, A.videoInput({ value: params.v || '', onSubmit: (id) => A.navigate('videolytics', { v: id }) }))
      );
      if (!params.v) return;
      const out = el('div', { class: 'stack', style: 'margin-top:16px' });
      c.appendChild(out);
      const v = await A.withLoading(out, 'Analyse de la vidéo…', () => MT.yt.getVideo(params.v));
      if (!v) return;
      const keywordInput = A.input({ value: v.tags[0] || '', placeholder: 'Mot-clé cible' });
      const seoBox = el('div');
      const drawSeo = () => {
        const seo = MT.seo.scoreVideo({
          title: v.title,
          description: v.description,
          tags: v.tags,
          keyword: keywordInput.value.trim(),
          durationSec: v.durationSec,
          isShort: v.isShort,
        });
        MT.fill(
          seoBox,
          el('div', { class: 'mt-row', style: 'gap:14px;margin:10px 0' }, W.gauge(seo.score, { size: 78, label: 'SEO' }), el('strong', null, MT.seo.scoreLabel(seo.score).label)),
          W.checklist(seo.checks)
        );
      };
      keywordInput.addEventListener('input', MT.debounce(drawSeo, 250));
      drawSeo();
      const demo = MT.seo.demonetizationAudit(v);
      const chapters = MT.text.extractChapters(v.description);
      const links = MT.text.extractLinks(v.description);
      const hashtags = MT.text.extractHashtags(v.description + ' ' + v.title);
      const compareBox = el('div', null, W.spinner('Comparaison avec la chaîne…'));
      const ch = v.channel || {};

      MT.fill(
        out,
        A.card(
          null,
          el(
            'div',
            { class: 'mt-row', style: 'align-items:flex-start;gap:18px' },
            el('img', { src: MT.thumbUrl(v.videoId, 'mqdefault'), style: 'width:320px;max-width:100%;border-radius:10px', alt: '' }),
            el(
              'div',
              { class: 'mt-grow', style: 'min-width:280px' },
              el('h2', { style: 'margin:0 0 6px' }, el('a', { href: `https://www.youtube.com/watch?v=${v.videoId}`, target: '_blank', rel: 'noopener' }, v.title)),
              el(
                'div',
                { class: 'mt-muted', style: 'margin-bottom:12px' },
                el('a', { href: '#/channelytics?c=' + v.channelId }, v.channelName),
                ch.subscribers != null ? ` · ${fmt.num(ch.subscribers)} abonnés` : '',
                ' · ',
                v.publishedAt ? `${fmt.date(v.publishedAt)} (${fmt.ago(v.publishedAt)})` : v.dateText || ''
              ),
              W.stats([
                { label: 'Vues', value: fmt.num(v.views), title: fmt.int(v.views) },
                { label: 'Vues / jour', value: fmt.num(v.viewsPerDay) },
                { label: 'J’aime', value: fmt.num(v.likes) },
                { label: 'Commentaires', value: fmt.num(v.comments) },
                { label: 'Engagement', value: v.engagement != null ? fmt.pct(v.engagement, 2) : '—' },
                { label: 'J’aime / vues', value: v.likeRatio != null ? fmt.pct(v.likeRatio, 2) : '—' },
                { label: 'Vues / abonné', value: ch.subscribers && v.views != null ? fmt.dec(v.views / ch.subscribers, 2) : '—' },
                { label: 'Durée', value: v.isShort ? 'Short' : fmt.duration(v.durationSec) },
                { label: 'Catégorie', value: v.category || '—' },
              ]),
              el(
                'div',
                { class: 'mt-row', style: 'margin-top:12px' },
                W.button('Commentaires', () => A.navigate('comments', { v: v.videoId }), { size: 'sm', icon: 'comment', busy: false }),
                W.button(
                  'Concurrent',
                  async () => {
                    await MT.research.addCompetitor(v.channelId);
                    W.toast('Chaîne ajoutée aux concurrents', 'success');
                  },
                  { size: 'sm', icon: 'users' }
                ),
                W.button('Exporter JSON', () => MT.download(`video-${v.videoId}.json`, JSON.stringify({ ...v, related: undefined }, null, 2), 'application/json'), {
                  size: 'sm',
                  icon: 'download',
                  busy: false,
                }),
                W.button(
                  'Charger dans SEO Studio',
                  async () => {
                    await MT.store.set('seoStudioDraft', { keyword: v.tags[0] || '', title: v.title, description: v.description, tags: v.tags });
                    A.navigate('seo-studio');
                  },
                  { size: 'sm', icon: 'edit', busy: false }
                )
              )
            )
          )
        ),
        A.grid(
          2,
          A.card('Score SEO', A.field('Mot-clé cible', keywordInput), seoBox),
          el(
            'div',
            { class: 'stack' },
            A.card('Performance par rapport à la chaîne', compareBox),
            A.card(
              'Description',
              W.stats([
                { label: 'Mots', value: fmt.int(MT.text.wordCount(v.description)) },
                { label: 'Liens', value: links.length },
                { label: 'Chapitres', value: chapters.length },
                { label: 'Hashtags', value: hashtags.length },
              ]),
              chapters.length
                ? el(
                    'div',
                    { style: 'margin-top:8px' },
                    el('div', { class: 'mt-section-title' }, 'Chapitres'),
                    el(
                      'ol',
                      { style: 'margin:0;padding-left:18px' },
                      chapters.map((ch2) => el('li', null, `${ch2.time} — ${ch2.title}`))
                    )
                  )
                : null,
              hashtags.length ? el('div', { style: 'margin-top:8px' }, W.chips(hashtags)) : null,
              el(
                'details',
                { style: 'margin-top:8px' },
                el('summary', null, 'Afficher la description'),
                el(
                  'pre',
                  { style: 'white-space:pre-wrap;font:inherit;background:var(--mt-bg2);padding:10px;border-radius:8px;max-height:300px;overflow:auto' },
                  v.description || '(vide)'
                )
              )
            ),
            A.card(
              'Audit de démonétisation',
              demo.findings.length
                ? el(
                    'div',
                    null,
                    W.alert(`Risque ${demo.level} (${demo.risk}/100)`, demo.risk >= 50 ? 'error' : 'warn'),
                    W.table(
                      [
                        { key: 'word', label: 'Terme' },
                        { key: 'label', label: 'Catégorie' },
                        { key: 'field', label: 'Champ' },
                        { key: 'count', label: 'Occurrences', num: true },
                      ],
                      demo.findings
                    )
                  )
                : W.alert('Aucun terme sensible détecté dans le titre, la description et les tags.', 'success')
            )
          )
        ),
        tagRanksCard(v),
        A.card(
          'Miniatures',
          el(
            'div',
            { class: 'mt-row', style: 'align-items:flex-end' },
            ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'].map((q) =>
              el(
                'a',
                { href: MT.thumbUrl(v.videoId, q), target: '_blank', rel: 'noopener', class: 'mt-col', style: 'gap:4px;align-items:center' },
                el('img', { src: MT.thumbUrl(v.videoId, q), style: 'width:160px;border-radius:8px', alt: q }),
                el('span', { class: 'mt-small' }, q)
              )
            )
          ),
          el(
            'div',
            { class: 'mt-row', style: 'margin-top:10px' },
            W.button(
              'Ouvrir dans l’éditeur',
              async () => {
                let dataUrl;
                try {
                  dataUrl = await imageToDataUrl(MT.thumbUrl(v.videoId, 'maxresdefault'));
                } catch (e) {
                  dataUrl = await imageToDataUrl(MT.thumbUrl(v.videoId, 'hqdefault'));
                }
                await MT.store.set('pendingFrame', { dataUrl, videoId: v.videoId, title: v.title, t: Date.now() });
                A.navigate('thumbnails', { frame: 1 });
              },
              { size: 'sm', icon: 'image' }
            ),
            W.button('Tester face aux concurrents', () => A.navigate('thumbnails', { tab: 'test', v: v.videoId, q: v.tags[0] || v.title }), {
              size: 'sm',
              icon: 'layers',
              busy: false,
            })
          )
        ),
        v.related && v.related.length
          ? A.card(
              'Vidéos suggérées à côté',
              W.table(
                [
                  { key: 'title', label: 'Vidéo', render: (r) => A.videoCell(r) },
                  { key: 'views', label: 'Vues', num: true, render: (r) => fmt.num(r.views) },
                  { key: 'publishedText', label: 'Publiée' },
                  {
                    key: 'a',
                    label: '',
                    sortable: false,
                    render: (r) => W.button('', () => A.navigate('videolytics', { v: r.videoId }), { size: 'sm', variant: 'ghost', icon: 'chart', busy: false }),
                  },
                ],
                v.related.slice(0, 15)
              )
            )
          : null
      );

      try {
        const chan = await MT.yt.getChannel(v.channelId, { videoLimit: 30 });
        const vids = chan.stats.videos.filter((x) => x.views != null);
        const med = chan.stats.medianViews;
        const sorted = [...vids].sort((a, b) => b.views - a.views);
        const pos = sorted.findIndex((x) => x.videoId === v.videoId);
        const ratio = med ? v.views / med : null;
        MT.fill(
          compareBox,
          W.stats([
            { label: 'Vues médianes de la chaîne', value: fmt.num(med) },
            { label: 'Ratio vs médiane', value: ratio != null ? '× ' + fmt.dec(ratio, 2) : '—' },
            { label: 'Classement parmi les récentes', value: pos >= 0 ? `${pos + 1}/${sorted.length}` : 'hors échantillon' },
          ]),
          ratio != null
            ? el(
                'div',
                { style: 'margin-top:8px' },
                W.alert(
                  ratio >= 1.5
                    ? 'Cette vidéo surperforme nettement la chaîne 🚀'
                    : ratio >= 0.8
                      ? 'Performance dans la moyenne de la chaîne.'
                      : 'Cette vidéo performe en dessous de la moyenne de la chaîne.',
                  ratio >= 1.5 ? 'success' : ratio >= 0.8 ? 'info' : 'warn'
                )
              )
            : null
        );
      } catch (e) {
        MT.fill(compareBox, W.alert('Comparaison indisponible : ' + e.message, 'warn'));
      }
    },
  });
})();
