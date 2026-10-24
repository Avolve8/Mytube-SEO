/*
 * MyTube SEO — « Explorateur de recherche » sur les pages de résultats :
 * score du mot-clé, recherches associées, tags les plus utilisés, badges par résultat (vues/jour, rang, tags).
 */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const P = MT.page;

  const RESULT_SELECTOR = 'ytd-search ytd-video-renderer, ytd-search yt-lockup-view-model';

  function queryOf(loc) {
    return (new URLSearchParams(loc.search).get('search_query') || '').trim();
  }

  function gaugeBox(score, label, inverse) {
    return el('div', { class: 'mt-gauge-box' }, W.gauge(score, { size: 58, inverse }), label);
  }

  /* ----------------------------------------------- badges sur les résultats */

  function videoIdOf(node) {
    const a = node.querySelector('a#thumbnail[href], a#video-title[href], a[href*="/watch?v="], a[href*="/shorts/"]');
    return a ? MT.videoIdFromUrl(a.getAttribute('href')) : null;
  }

  function domStats(node) {
    const texts = [...node.querySelectorAll('#metadata-line span, .inline-metadata-item, [class*="metadata-row"] span, [class*="metadata"] span')]
      .map((s) => (s.textContent || '').trim())
      .filter(Boolean);
    let views = null;
    let ageSec = null;
    for (const t of texts) {
      const rel = MT.parseRelative(t);
      if (rel != null && ageSec == null) ageSec = rel;
      else if (views == null && /\d/.test(t) && !/:\d{2}/.test(t)) {
        const n = MT.parseCount(t);
        if (n != null) views = n;
      }
    }
    return { views, ageSec };
  }

  function badgeFor(node, info) {
    const sig = JSON.stringify([info.rank, info.vpd != null ? Math.round(info.vpd) : null, info.tags ? info.tags.length : null, info.seo, P.isDark()]);
    let badge = node.querySelector(':scope mytube-seo-badge');
    if (badge && badge.dataset.sig === sig) return; // évite de boucler avec le MutationObserver
    if (!badge) {
      badge = el('mytube-seo-badge', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 2px;font:500 12px Roboto,Arial,sans-serif' });
      const anchor = node.querySelector('#metadata, #meta, yt-lockup-metadata-view-model, [class*="lockup-metadata"]');
      if (anchor) anchor.appendChild(badge);
      else node.appendChild(badge);
    }
    badge.dataset.sig = sig;
    MT.clear(badge);
    const dark = P.isDark();
    const pillStyle = (bg) => `display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:${bg};color:${dark ? '#fff' : '#0f0f0f'};`;
    if (info.rank) badge.appendChild(el('span', { style: pillStyle(dark ? '#3a2a12' : '#fff1dc'), title: 'Position dans les résultats' }, '#' + info.rank));
    if (info.vpd != null)
      badge.appendChild(el('span', { style: pillStyle(dark ? '#16301f' : '#e3f6ea'), title: 'Vues par jour depuis la publication' }, '📈 ' + fmt.num(info.vpd) + ' vues/jour'));
    if (info.tags != null)
      badge.appendChild(el('span', { style: pillStyle(dark ? '#1b2a44' : '#e5efff'), title: info.tags.join(', ') || 'Aucun tag' }, '🏷️ ' + info.tags.length + ' tags'));
    if (info.seo != null) badge.appendChild(el('span', { style: pillStyle(dark ? '#33202a' : '#fde8ef'), title: 'Score SEO pour la requête' }, 'SEO ' + info.seo));
  }

  /* --------------------------------------------------------------- module */

  P.register({
    name: 'search',
    enabled: (s) => s.panels.search || s.panels.searchBadges,
    match: (loc) => loc.pathname === '/results' && !!queryOf(loc),
    async start(loc, settings) {
      const query = queryOf(loc);
      const state = { alive: true, analysis: null, tags: new Map() };
      const cleanups = [];
      let panel = null;

      if (settings.panels.search) {
        panel = P.createPanel({ id: 'search', title: 'Explorateur de recherche', sub: `« ${query} »` });
        await P.mountPanel(panel, [
          { selector: 'ytd-search ytd-two-column-search-results-renderer #primary', where: 'prepend' },
          { selector: 'ytd-search #contents', where: 'prepend' },
        ]);
        cleanups.push(() => panel.destroy());
        renderPanel(panel, query, state);
      }

      if (settings.panels.searchBadges) {
        const decorate = MT.debounce(() => {
          if (!state.alive) return;
          const byId = new Map(((state.analysis && state.analysis.videos) || []).map((v) => [v.videoId, v]));
          let pos = 0;
          for (const node of document.querySelectorAll(RESULT_SELECTOR)) {
            if (!P.visible(node) || node.closest('ytd-reel-shelf-renderer, ytd-shelf-renderer, grid-shelf-view-model')) continue;
            pos++;
            const id = videoIdOf(node);
            if (!id) continue;
            const data = byId.get(id);
            const dom = domStats(node);
            const views = data && data.views != null ? data.views : dom.views;
            const age = data && data.ageSec != null ? data.ageSec : dom.ageSec;
            const tags = state.tags.get(id);
            let seo = null;
            if (tags && data) seo = MT.seo.scoreVideo({ title: data.title, description: data.description || '', tags, keyword: query }).score;
            badgeFor(node, { rank: pos, vpd: views != null && age != null ? views / Math.max(1, age / 86400) : null, tags: tags || null, seo });
          }
        }, 400);
        const obs = new MutationObserver(decorate);
        const container = await P.waitFor('ytd-search #contents', 8000);
        if (container && state.alive) obs.observe(container, { childList: true, subtree: true });
        state.decorate = decorate;
        decorate();
        cleanups.push(() => {
          obs.disconnect();
          document.querySelectorAll('mytube-seo-badge').forEach((b) => b.remove());
        });
      }

      return () => {
        state.alive = false;
        cleanups.forEach((fn) => fn());
      };
    },
  });

  function renderPanel(panel, query, state) {
    const body = panel.body;
    MT.fill(body, W.spinner('Analyse du mot-clé…'));

    async function analyzeTags(container, btn) {
      const videos = (state.analysis.videos || []).filter((v) => !v.inShelf).slice(0, 15);
      btn.disabled = true;
      MT.fill(container, W.spinner('Lecture des tags des 15 premiers résultats…'));
      try {
        const res = await MT.send('tags.forVideos', { ids: videos.map((v) => v.videoId) });
        for (const r of res) state.tags.set(r.videoId, r.tags);
        const freq = MT.keyword.tagFrequency(res);
        const avg = MT.mean(res.map((r) => r.tags.length)) || 0;
        MT.fill(
          container,
          el(
            'div',
            { class: 'mt-row', style: 'justify-content:space-between;margin-bottom:6px' },
            el('span', { class: 'mt-muted' }, `${res.length} vidéos analysées · ${fmt.dec(avg)} tags en moyenne`),
            W.copyButton(
              () =>
                freq
                  .slice(0, 30)
                  .map((t) => t.tag)
                  .join(', '),
              'Copier les 30 premiers'
            )
          ),
          freq.length
            ? W.chips(freq.slice(0, 40), {
                badge: (t) => t.count,
                onClick: (t) => MT.openApp('keywords?q=' + encodeURIComponent(t.tag)),
                title: (t) => `${t.tag} — utilisé par ${t.count} vidéo(s)`,
              })
            : W.alert('Aucun tag trouvé chez les concurrents.', 'warn')
        );
        if (state.decorate) state.decorate();
      } catch (e) {
        MT.fill(container, W.alert(e.message, 'error'));
        btn.disabled = false;
      }
    }

    MT.send('keyword.analyze', { keyword: query })
      .then((a) => {
        if (!state.alive) return;
        state.analysis = a;
        if (state.decorate) state.decorate();
        const s = a.score;
        const m = s.metrics;
        panel.setSub(`« ${query} » · score ${s.overall}/100`);
        const tagsBox = el('div');
        const tagsBtn = W.button('Tags les plus utilisés', () => analyzeTags(tagsBox, tagsBtn), { size: 'sm', icon: 'tag' });
        MT.fill(
          body,
          el(
            'div',
            { class: 'mt-gauges' },
            gaugeBox(s.overall, 'Global'),
            gaugeBox(s.volume, 'Volume'),
            gaugeBox(s.competition, 'Concurrence', true),
            gaugeBox(s.optimization, 'Optimisation', true),
            s.weighted != null ? gaugeBox(s.weighted, 'Pour vous') : null
          ),
          el(
            'div',
            { style: 'margin-top:10px' },
            W.stats([
              { label: 'Résultats estimés', value: fmt.num(m.estimatedResults) },
              { label: 'Vues médianes (top 10)', value: fmt.num(m.medianViews) },
              { label: 'Vues/jour moy. (top 10)', value: fmt.num(m.avgViewsPerDay) },
              { label: 'Titres avec le mot-clé', value: fmt.pct(m.titleMatchPct, 0) },
              { label: 'Âge moyen (top 20)', value: m.avgAgeDays != null ? fmt.int(m.avgAgeDays) + ' j' : '—' },
              { label: 'Chaînes différentes', value: m.uniqueChannels },
            ])
          ),
          a.correctedQuery ? W.alert(`YouTube corrige la requête en « ${a.correctedQuery} ».`, 'warn') : null,
          a.related.length
            ? P.section(
                'Recherches associées',
                W.chips(a.related.slice(0, 16), { onClick: (q) => (location.href = '/results?search_query=' + encodeURIComponent(q)), title: (q) => 'Rechercher « ' + q + ' »' })
              )
            : null,
          el(
            'div',
            { class: 'mt-row', style: 'margin-top:10px' },
            tagsBtn,
            W.button('Explorateur complet', () => MT.openApp('keywords?q=' + encodeURIComponent(query)), { size: 'sm', icon: 'search' }),
            W.button(
              'Ajouter au planificateur',
              async () => {
                await MT.send('idea.add', { title: query, keyword: query, score: s.overall });
                W.toast('Idée ajoutée au planificateur', 'success');
              },
              { size: 'sm', icon: 'star' }
            )
          ),
          el('div', { class: 'mt-section' }, tagsBox)
        );
      })
      .catch((e) => {
        if (!state.alive) return;
        MT.fill(body, W.alert('Analyse impossible : ' + e.message, 'error'));
      });
  }
})();
