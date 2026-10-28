/* MyTube SEO — vue Commentaires : tirage au sort, nuage de mots, sentiment, questions, filtres et export. */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const { el, fmt } = MT;
  const W = MT.widgets;
  const A = MT.app;

  function randomInt(max) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }

  function commentLink(videoId, c) {
    return `https://www.youtube.com/watch?v=${videoId}&lc=${encodeURIComponent(c.id)}`;
  }

  function commentItem(videoId, c, extra) {
    return el(
      'div',
      { class: 'comment-item' },
      c.authorAvatar
        ? el('img', { src: c.authorAvatar, width: 32, height: 32, style: 'border-radius:50%;flex:none' })
        : el('div', { style: 'width:32px;height:32px;border-radius:50%;background:var(--mt-bg3);flex:none' }),
      el(
        'div',
        { class: 'mt-grow', style: 'min-width:0' },
        el(
          'div',
          { class: 'mt-row', style: 'gap:6px' },
          el('span', { class: 'author' }, c.author || 'Anonyme'),
          c.isOwner ? el('span', { class: 'mt-chip', style: 'padding:0 6px' }, 'Créateur') : null,
          el('a', { class: 'mt-small mt-muted', href: commentLink(videoId, c), target: '_blank', rel: 'noopener' }, c.publishedText || ''),
          el('span', { class: 'mt-small mt-muted' }, `👍 ${fmt.num(c.likes)} · 💬 ${c.replies || 0}`),
          extra || null
        ),
        el('div', { class: 'text' }, c.text)
      )
    );
  }

  function winnerTab(c, videoId, comments) {
    const count = A.select(
      [1, 2, 3, 5, 10].map((n) => [String(n), `${n} gagnant${n > 1 ? 's' : ''}`]),
      '1'
    );
    const unique = A.checkbox('Une seule participation par personne', true);
    const noOwner = A.checkbox('Exclure le créateur de la vidéo', true);
    const keyword = A.input({ placeholder: 'Mot-clé obligatoire dans le commentaire (facultatif)' });
    const minLikes = A.input({ type: 'number', value: '0', min: 0 });
    const out = el('div', { style: 'margin-top:14px' });
    const eligible = () => {
      let list = comments.filter((x) => x.text);
      if (noOwner.querySelector('input').checked) list = list.filter((x) => !x.isOwner);
      if (keyword.value.trim()) list = list.filter((x) => MT.text.normalize(x.text).includes(MT.text.normalize(keyword.value.trim())));
      const ml = Number(minLikes.value) || 0;
      if (ml) list = list.filter((x) => x.likes >= ml);
      if (unique.querySelector('input').checked) {
        const seen = new Set();
        list = list.filter((x) => {
          const k = x.authorChannelId || x.author;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }
      return list;
    };
    const draw = async () => {
      const pool = eligible();
      const n = Math.min(Number(count.value), pool.length);
      if (!n) return W.toast('Aucun commentaire éligible', 'error');
      const reel = el('div', { class: 'winner-card' }, el('div', { class: 'mt-muted' }, 'Tirage en cours…'), el('div', { class: 'name' }, '…'));
      MT.fill(out, A.card(null, reel));
      const nameEl = reel.querySelector('.name');
      for (let i = 0; i < 24; i++) {
        nameEl.textContent = pool[randomInt(pool.length)].author;
        await MT.sleep(40 + i * 6);
      }
      const remaining = [...pool];
      const winners = [];
      for (let i = 0; i < n; i++) winners.push(remaining.splice(randomInt(remaining.length), 1)[0]);
      MT.fill(
        out,
        A.card(
          `🎉 ${n} gagnant${n > 1 ? 's' : ''} parmi ${pool.length} participants éligibles`,
          winners.map((w, i) => commentItem(videoId, w, el('strong', { style: 'color:var(--mt-accent)' }, `#${i + 1}`))),
          el(
            'div',
            { class: 'mt-row', style: 'margin-top:10px' },
            W.copyButton(() => winners.map((w, i) => `#${i + 1} ${w.author} — ${commentLink(videoId, w)}`).join('\n'), 'Copier les gagnants', { size: 'md' }),
            W.button('Retirer au sort', draw, { icon: 'refresh' }),
            el('span', { class: 'mt-small mt-muted' }, `Tirage effectué le ${fmt.datetime(Date.now())} (aléatoire cryptographique).`)
          )
        )
      );
    };
    const info = el('span', { class: 'mt-muted' });
    const updateInfo = () => (info.textContent = `${eligible().length} participant(s) éligible(s)`);
    for (const x of [count, keyword, minLikes, unique, noOwner]) x.addEventListener('change', updateInfo);
    keyword.addEventListener('input', MT.debounce(updateInfo, 200));
    updateInfo();
    MT.add(
      c,
      el('div', { class: 'grid cols-3' }, A.field('Nombre de gagnants', count), A.field('Mot-clé', keyword), A.field('J’aime minimum', minLikes)),
      el('div', { class: 'mt-row', style: 'gap:16px' }, unique, noOwner, info),
      el('div', { style: 'margin-top:10px' }, W.button('Tirer au sort', draw, { variant: 'primary', icon: 'gift' })),
      out
    );
  }

  function cloudTab(c, comments, goFilter) {
    const words = MT.text.wordFrequency(
      comments.map((x) => x.text),
      { limit: 80 }
    );
    const phrases = MT.text.phraseFrequency(
      comments.map((x) => x.text),
      2,
      20
    );
    MT.add(
      c,
      W.wordCloud(words, { onClick: (w) => goFilter(w.word) }),
      el(
        'div',
        { class: 'grid cols-2', style: 'margin-top:14px' },
        A.card(
          'Mots les plus fréquents',
          W.barChart(
            words.slice(0, 15).map((w) => ({ label: w.word, value: w.count })),
            { format: String, valueLabel: 'Occurrences' }
          )
        ),
        A.card(
          'Expressions fréquentes',
          phrases.length
            ? W.barChart(
                phrases.slice(0, 15).map((p) => ({ label: p.phrase, value: p.count })),
                { format: String, valueLabel: 'Occurrences' }
              )
            : W.empty('Pas assez d’expressions répétées')
        )
      )
    );
  }

  function sentimentTab(c, videoId, comments) {
    const scored = comments.map((x) => ({ ...x, s: MT.text.sentiment(x.text) }));
    const pos = scored.filter((x) => x.s > 0.15);
    const neg = scored.filter((x) => x.s < -0.15);
    const neu = scored.length - pos.length - neg.length;
    const total = scored.length || 1;
    const avg = MT.mean(scored.map((x) => x.s)) || 0;
    MT.add(
      c,
      el(
        'div',
        { class: 'mt-row', style: 'gap:20px;margin-bottom:14px' },
        W.gauge(Math.round((avg + 1) * 50), { size: 96, label: 'Humeur' }),
        el(
          'div',
          { class: 'mt-grow' },
          W.barChart(
            [
              { label: `Positifs (${pos.length})`, value: (pos.length / total) * 100, color: 'var(--mt-great)' },
              { label: `Neutres (${neu})`, value: (neu / total) * 100, color: 'var(--mt-muted)' },
              { label: `Négatifs (${neg.length})`, value: (neg.length / total) * 100, color: 'var(--mt-bad)' },
            ],
            { format: (v) => fmt.dec(v, 0) + ' %', max: 100, share: false, valueLabel: 'Part des commentaires' }
          )
        )
      ),
      el(
        'div',
        { class: 'grid cols-2' },
        A.card(
          'Les plus positifs',
          [...pos]
            .sort((a, b) => b.s - a.s || b.likes - a.likes)
            .slice(0, 8)
            .map((x) => commentItem(videoId, x))
        ),
        A.card(
          'Les plus négatifs',
          neg.length
            ? [...neg]
                .sort((a, b) => a.s - b.s || b.likes - a.likes)
                .slice(0, 8)
                .map((x) => commentItem(videoId, x))
            : W.empty('Aucun commentaire négatif détecté')
        )
      ),
      el('p', { class: 'mt-small mt-muted' }, 'Analyse lexicale (français/anglais) : indicative, l’ironie n’est pas détectée.')
    );
  }

  function questionsTab(c, videoId, comments) {
    const qs = comments.filter((x) => MT.text.isQuestion(x.text)).sort((a, b) => b.likes - a.likes);
    MT.add(
      c,
      el('p', { class: 'mt-muted', style: 'margin-top:0' }, `${qs.length} question(s) : idéales pour répondre, épingler ou créer de nouvelles vidéos.`),
      qs.length
        ? qs.slice(0, 100).map((q) =>
            commentItem(
              videoId,
              q,
              W.button(
                'Idée',
                async () => {
                  await MT.store.upsert('ideas', {
                    id: MT.uid(),
                    title: q.text.slice(0, 90),
                    keyword: '',
                    notes: `Question de ${q.author} : ${q.text}\n${commentLink(videoId, q)}`,
                    status: 'idea',
                    createdAt: Date.now(),
                  });
                  W.toast('Ajoutée au planificateur', 'success');
                },
                { size: 'sm', variant: 'ghost', icon: 'star' }
              )
            )
          )
        : W.empty('Aucune question détectée')
    );
  }

  function allTab(c, videoId, comments, initialFilter) {
    const q = A.input({ value: initialFilter || '', placeholder: 'Rechercher dans les commentaires…', type: 'search' });
    const sort = A.select(
      [
        ['likes', 'Plus aimés'],
        ['recent', 'Plus récents'],
        ['replies', 'Plus de réponses'],
        ['long', 'Plus longs'],
      ],
      'likes'
    );
    const only = A.select(
      [
        ['', 'Tous'],
        ['questions', 'Questions'],
        ['owner', 'Du créateur'],
        ['links', 'Avec lien'],
      ],
      ''
    );
    const list = el('div');
    const count = el('span', { class: 'mt-muted' });
    let current = [];
    const draw = () => {
      const needle = MT.text.normalize(q.value);
      current = comments.filter(
        (x) =>
          (!needle || MT.text.normalize(x.text + ' ' + x.author).includes(needle)) &&
          (only.value !== 'questions' || MT.text.isQuestion(x.text)) &&
          (only.value !== 'owner' || x.isOwner) &&
          (only.value !== 'links' || /https?:\/\//.test(x.text))
      );
      const key = { likes: (x) => -x.likes, recent: (x) => x.ageSec ?? 1e12, replies: (x) => -(x.replies || 0), long: (x) => -x.text.length }[sort.value];
      current.sort((a, b) => key(a) - key(b));
      count.textContent = `${current.length} commentaire(s)`;
      MT.fill(
        list,
        current.slice(0, 300).map((x) => commentItem(videoId, x)),
        current.length > 300 ? el('p', { class: 'mt-muted' }, '300 premiers affichés — exportez pour tout voir.') : null
      );
    };
    q.addEventListener('input', MT.debounce(draw, 200));
    sort.addEventListener('change', draw);
    only.addEventListener('change', draw);
    draw();
    const api = {
      set(word) {
        q.value = word;
        draw();
      },
    };
    MT.add(
      c,
      el('div', { class: 'mt-row', style: 'flex-wrap:nowrap;margin-bottom:10px' }, q, el('div', { style: 'width:190px' }, sort), el('div', { style: 'width:170px' }, only)),
      el(
        'div',
        { class: 'mt-row', style: 'justify-content:space-between;margin-bottom:6px' },
        count,
        W.button(
          'Exporter CSV',
          () =>
            MT.download(
              `commentaires-${videoId}.csv`,
              MT.toCSV(current, [
                { key: 'author', label: 'Auteur' },
                { key: 'text', label: 'Commentaire' },
                { key: 'likes', label: 'J’aime' },
                { key: 'replies', label: 'Réponses' },
                { key: 'publishedText', label: 'Date' },
                { label: 'Lien', get: (x) => commentLink(videoId, x) },
              ]),
              'text/csv;charset=utf-8'
            ),
          { size: 'sm', icon: 'download', busy: false }
        )
      ),
      list
    );
    return api;
  }

  A.register('comments', {
    title: 'Commentaires',
    icon: 'comment',
    group: 'community',
    order: 1,
    description: 'Tirage au sort, nuage de mots, sentiment, questions',
    async render(c, params) {
      const s = await MT.store.getSettings();
      const st = await MT.oauth.status();
      const max = A.select(
        [
          ['200', '200 commentaires'],
          ['500', '500'],
          ['1000', '1 000'],
          ['2000', '2 000'],
          ['5000', '5 000'],
        ],
        params.max || '500'
      );
      const order = A.select(
        [
          ['top', 'Les plus pertinents'],
          ['new', 'Les plus récents'],
        ],
        'top'
      );
      const source = A.select(
        [
          ['web', 'Pages YouTube (sans clé)'],
          ['api', 'API officielle (clé ou connexion)'],
        ],
        'web'
      );
      MT.add(
        c,
        A.pageHead('Analyse des commentaires', 'Organisez un concours, découvrez ce que dit votre audience et trouvez des idées de vidéos dans les questions.', 'comment'),
        A.card(
          null,
          A.videoInput({ value: params.v || '', label: 'Charger', onSubmit: (id) => A.navigate('comments', { v: id, max: max.value, tab: params.tab }) }),
          el('div', { class: 'grid cols-3', style: 'margin-top:10px' }, A.field('Quantité', max), A.field('Ordre', order), A.field('Source', source))
        )
      );
      if (!params.v) return;
      const out = el('div', { style: 'margin-top:16px' });
      c.appendChild(out);
      const prog = W.progress();
      const label = el('div', { class: 'mt-muted', style: 'margin-bottom:6px' }, 'Chargement des commentaires…');
      MT.fill(out, A.card(null, label, prog));
      let data;
      try {
        const limit = Number(max.value);
        if (source.value === 'api' && (s.apiKey || st.connected)) {
          const a = st.connected ? await A.auth() : { apiKey: s.apiKey };
          const list = await MT.ytapi.commentThreads(params.v, a, {
            max: limit,
            order: order.value === 'new' ? 'time' : 'relevance',
            onProgress: (n) => {
              label.textContent = `${n} commentaires chargés…`;
              prog.set(n, limit);
            },
          });
          data = { comments: list, total: null };
        } else {
          data = await MT.yt.getComments(params.v, {
            max: limit,
            sort: order.value,
            onProgress: (n, total) => {
              label.textContent = `${n} commentaires chargés${total ? ' sur ' + fmt.int(total) : ''}…`;
              prog.set(n, Math.min(limit, total || limit));
            },
          });
        }
      } catch (e) {
        MT.fill(out, W.alert('Chargement impossible : ' + e.message, 'error'));
        return;
      }
      if (data.disabled) {
        MT.fill(out, W.alert('Les commentaires sont désactivés pour cette vidéo.', 'warn'));
        return;
      }
      const comments = data.comments;
      const video = await MT.yt.player(params.v).catch(() => ({ title: params.v }));
      let filterWord = '';
      let allApi = null;
      const tabsEl = W.tabs(
        [
          { id: 'winner', label: '🎁 Tirage au sort', render: (x) => winnerTab(x, params.v, comments) },
          {
            id: 'cloud',
            label: 'Nuage de mots',
            render: (x) =>
              cloudTab(x, comments, (w) => {
                filterWord = w;
                tabsEl.show('all');
                if (allApi) allApi.set(w);
              }),
          },
          { id: 'sentiment', label: 'Sentiment', render: (x) => sentimentTab(x, params.v, comments) },
          { id: 'questions', label: 'Questions', render: (x) => questionsTab(x, params.v, comments) },
          { id: 'all', label: 'Tous les commentaires', render: (x) => (allApi = allTab(x, params.v, comments, filterWord)) },
        ],
        { initial: params.tab || 'cloud' }
      );
      MT.fill(
        out,
        A.card(
          el(
            'span',
            null,
            `${fmt.int(comments.length)} commentaires`,
            data.total ? el('span', { class: 'mt-muted' }, ` sur ${fmt.int(data.total)}`) : null,
            ' — ',
            el('a', { href: `https://www.youtube.com/watch?v=${params.v}`, target: '_blank', rel: 'noopener' }, video.title)
          ),
          data.truncated ? W.alert('Seule une partie des commentaires a été chargée : augmentez la quantité si besoin.', 'info') : null,
          tabsEl
        )
      );
    },
  });
})();
