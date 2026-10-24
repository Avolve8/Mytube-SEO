/*
 * MyTube SEO — moteur d'optimisation : score SEO d'une vidéo, suggestions et tri de tags,
 * audit de démonétisation, audit de chaîne, estimation de revenus, idées de titres.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});
  const T = () => MT.text;

  const LIMITS = { title: 100, description: 5000, tags: 500, hashtags: 15 };

  /** Longueur des tags telle que comptée par YouTube (guillemets autour des tags à espaces + virgules). */
  function tagsLength(tags) {
    const list = (tags || []).filter(Boolean);
    return list.reduce((sum, t) => sum + t.length + (/\s/.test(t) ? 2 : 0), 0) + Math.max(0, list.length - 1);
  }

  function parseTagInput(text) {
    return [
      ...new Set(
        String(text || '')
          .split(/[,\n]/)
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean)
      ),
    ];
  }

  function guessKeyword({ title = '', tags = [] }) {
    if (tags && tags.length) return tags[0];
    const phrases = T().phraseFrequency([title, title], 2, 1);
    if (phrases.length) return phrases[0].phrase;
    const words = T().contentWords(title);
    return words.slice(0, 2).join(' ');
  }

  function status(pass) {
    return pass >= 0.99 ? 'ok' : pass > 0 ? 'warn' : 'bad';
  }

  /**
   * Score SEO d'une vidéo (0-100) avec liste de vérifications détaillées.
   * input: {title, description, tags, keyword?, isShort?}
   */
  function scoreVideo(input) {
    const title = input.title || '';
    const description = input.description || '';
    const tags = (input.tags || []).filter(Boolean);
    const keyword = (input.keyword || '').trim() || guessKeyword({ title, tags });
    const isShort = !!input.isShort;
    const tx = T();
    const kwN = tx.normalize(keyword);
    const kwWords = tx.contentWords(keyword).map(tx.normalize);

    const titleLen = [...title].length;
    const descWords = tx.wordCount(description);
    const hashtags = tx.extractHashtags(description + ' ' + title);
    const links = tx.extractLinks(description);
    const chapters = tx.extractChapters(description);
    const tagChars = tagsLength(tags);
    const first150 = description.slice(0, 150);
    const kwInTitle = keyword && tx.containsPhrase(title, keyword);
    const titleN = tx.normalize(title);
    const allKwWordsInTitle = kwWords.length > 0 && kwWords.every((w) => titleN.includes(w));
    const kwCountDesc = keyword ? tx.countPhrase(description, keyword) : 0;
    const letters = title.replace(/[^\p{L}]/gu, '');
    const upperRatio = letters ? letters.replace(/[^\p{Lu}]/gu, '').length / letters.length : 0;
    const tagsN = tags.map(tx.normalize);
    const uniqueTags = new Set(tagsN);

    const checks = [];
    const add = (id, group, label, weight, pass, tip, skip) => {
      if (skip) return;
      pass = Math.max(0, Math.min(1, pass));
      checks.push({ id, group, label, weight, pass, status: status(pass), tip });
    };

    // --- Titre
    add(
      'kwInTitle',
      'Titre',
      'Mot-clé cible dans le titre',
      15,
      kwInTitle ? 1 : allKwWordsInTitle ? 0.6 : 0,
      kwInTitle
        ? 'Le mot-clé exact figure dans le titre.'
        : allKwWordsInTitle
          ? 'Tous les mots sont présents mais pas dans l’ordre exact : utilisez l’expression exacte.'
          : `Ajoutez « ${keyword} » dans le titre.`,
      !keyword
    );
    let startPass = 0;
    if (kwInTitle) {
      const idx = tx.normalize(title).indexOf(kwN);
      startPass = idx <= 0 ? 1 : idx / Math.max(1, titleN.length) < 0.4 ? 0.8 : 0.4;
    }
    add(
      'kwTitleStart',
      'Titre',
      'Mot-clé au début du titre',
      8,
      startPass,
      startPass >= 0.99 ? 'Le titre commence par le mot-clé.' : 'Placez le mot-clé le plus tôt possible dans le titre.',
      !keyword
    );
    const lenPass =
      titleLen >= 40 && titleLen <= 70
        ? 1
        : (titleLen >= 30 && titleLen < 40) || (titleLen > 70 && titleLen <= 80)
          ? 0.6
          : (titleLen >= 20 && titleLen < 30) || (titleLen > 80 && titleLen <= LIMITS.title)
            ? 0.3
            : 0;
    add(
      'titleLength',
      'Titre',
      `Longueur du titre (${titleLen}/100)`,
      7,
      lenPass,
      titleLen > 70
        ? 'Au-delà de ~70 caractères, le titre est tronqué dans les résultats.'
        : titleLen < 40
          ? 'Un titre de 40 à 70 caractères laisse la place au mot-clé et à l’accroche.'
          : 'Longueur idéale.'
    );
    add(
      'titleCaps',
      'Titre',
      'Pas de majuscules abusives',
      3,
      upperRatio < 0.5 ? 1 : 0,
      upperRatio < 0.5 ? 'Casse correcte.' : 'Évitez d’écrire le titre en MAJUSCULES : réservez-les à un mot.'
    );
    add(
      'titlePunct',
      'Titre',
      'Ponctuation mesurée',
      2,
      /[!?]{3,}/.test(title) ? 0 : 1,
      /[!?]{3,}/.test(title) ? 'Évitez « !!! » ou « ??? » qui font « piège à clics ».' : 'Ponctuation correcte.'
    );

    // --- Description
    const kwInDesc = keyword && tx.containsPhrase(description, keyword);
    add(
      'kwInDesc',
      'Description',
      'Mot-clé dans la description',
      10,
      kwInDesc ? 1 : 0,
      kwInDesc ? 'Le mot-clé est présent dans la description.' : 'Mentionnez le mot-clé exact dans la description.',
      !keyword
    );
    const kwStart = keyword && tx.containsPhrase(first150, keyword);
    add(
      'kwInDescStart',
      'Description',
      'Mot-clé dans les 2 premières lignes',
      7,
      kwStart ? 1 : 0,
      kwStart ? 'Visible avant « Plus ».' : 'Les ~150 premiers caractères sont affichés dans les résultats : placez-y le mot-clé.',
      !keyword
    );
    const repeatPass = kwCountDesc >= 2 && kwCountDesc <= 5 ? 1 : kwCountDesc === 1 || kwCountDesc > 5 ? 0.5 : 0;
    add(
      'kwDescRepeat',
      'Description',
      `Répétitions du mot-clé (${kwCountDesc}×)`,
      4,
      repeatPass,
      kwCountDesc > 5
        ? 'Trop de répétitions peuvent être vues comme du bourrage de mots-clés.'
        : kwCountDesc < 2
          ? 'Répétez naturellement le mot-clé 2 à 3 fois.'
          : 'Bonne densité.',
      !keyword
    );
    const descPass = descWords >= 250 ? 1 : descWords >= 150 ? 0.7 : descWords >= 50 ? 0.4 : 0;
    add(
      'descLength',
      'Description',
      `Longueur de la description (${descWords} mots)`,
      8,
      descPass,
      descWords >= 250 ? 'Description riche.' : 'Visez au moins 250 mots : YouTube s’en sert pour comprendre le sujet.',
      isShort
    );
    add(
      'descLinks',
      'Description',
      'Liens utiles',
      3,
      links.length ? 1 : 0,
      links.length ? `${links.length} lien(s).` : 'Ajoutez des liens (vidéos liées, playlist, réseaux, site).',
      isShort
    );
    const chaptersOk = chapters.length >= 3 && chapters[0].seconds === 0;
    add(
      'chapters',
      'Description',
      `Chapitres (${chapters.length})`,
      4,
      chaptersOk ? 1 : chapters.length ? 0.4 : 0,
      chaptersOk ? 'Chapitres valides (3+ horodatages commençant par 00:00).' : 'Ajoutez des chapitres : 3 horodatages minimum, le premier à 00:00.',
      isShort || (input.durationSec != null && input.durationSec < 120)
    );
    const hPass = hashtags.length >= 1 && hashtags.length <= 3 ? 1 : hashtags.length > 3 && hashtags.length <= LIMITS.hashtags ? 0.5 : 0;
    add(
      'hashtags',
      'Description',
      `Hashtags (${hashtags.length})`,
      3,
      hPass,
      hashtags.length > LIMITS.hashtags
        ? 'Plus de 15 hashtags : YouTube les ignore tous.'
        : hashtags.length === 0
          ? 'Ajoutez 1 à 3 hashtags pertinents.'
          : hashtags.length > 3
            ? 'Seuls les 3 premiers s’affichent au-dessus du titre.'
            : 'Parfait.'
    );
    const cta = /abonne|abonnez|subscribe|like|pouce|notification|cloche|partage/i.test(T().normalize(description));
    add('cta', 'Description', 'Appel à l’action', 2, cta ? 1 : 0, cta ? 'Présent.' : 'Invitez à s’abonner, liker ou commenter.');

    // --- Tags
    const nbTags = tags.length;
    add(
      'hasTags',
      'Tags',
      `Nombre de tags (${nbTags})`,
      6,
      nbTags >= 5 ? 1 : nbTags > 0 ? 0.5 : 0,
      nbTags >= 5 ? 'Bon nombre de tags.' : 'Utilisez au moins 5 à 15 tags (expression exacte, variantes, sujets larges).'
    );
    let firstTag = 0;
    if (keyword && nbTags) firstTag = tagsN[0] === kwN ? 1 : tagsN.some((t) => t === kwN) ? 0.6 : tagsN.some((t) => t.includes(kwN)) ? 0.4 : 0;
    add(
      'kwFirstTag',
      'Tags',
      'Mot-clé cible en premier tag',
      5,
      firstTag,
      firstTag >= 0.99 ? 'Le premier tag est le mot-clé exact.' : 'Mettez le mot-clé exact en premier tag : les premiers tags pèsent le plus.',
      !keyword
    );
    const tlPass = tagChars > LIMITS.tags ? 0 : tagChars >= 300 ? 1 : tagChars >= 200 ? 0.7 : tagChars >= 100 ? 0.4 : tagChars > 0 ? 0.2 : 0;
    add(
      'tagsLength',
      'Tags',
      `Utilisation de l’espace des tags (${tagChars}/500)`,
      5,
      tlPass,
      tagChars > LIMITS.tags
        ? 'Limite de 500 caractères dépassée : YouTube refusera l’enregistrement.'
        : tagChars >= 300
          ? 'Bonne utilisation.'
          : 'Utilisez 300 à 500 caractères de tags.'
    );
    const titleWords = [...new Set(tx.contentWords(title).map(tx.normalize))];
    const tagText = tagsN.join(' ');
    const covered = titleWords.filter((w) => tagText.includes(w)).length;
    const coverage = titleWords.length ? covered / titleWords.length : 0;
    add(
      'tagsInTitle',
      'Tags',
      `Mots du titre présents dans les tags (${Math.round(coverage * 100)} %)`,
      4,
      coverage >= 0.5 ? 1 : coverage * 2,
      coverage >= 0.5 ? 'Titre et tags sont cohérents.' : 'Reprenez les mots importants du titre dans vos tags.',
      !nbTags
    );
    const context = tx.normalize(title + ' ' + description);
    const relevant = tags.filter((t) =>
      tx
        .contentWords(t)
        .map(tx.normalize)
        .some((w) => context.includes(w))
    ).length;
    const relevance = nbTags ? relevant / nbTags : 0;
    add(
      'tagsRelevance',
      'Tags',
      `Tags pertinents avec le contenu (${Math.round(relevance * 100)} %)`,
      4,
      relevance >= 0.6 ? 1 : relevance / 0.6,
      relevance >= 0.6 ? 'Les tags correspondent au titre/à la description.' : 'Certains tags ne sont mentionnés nulle part : YouTube peut les juger trompeurs.',
      !nbTags
    );
    const sizes = new Set(
      tags.map((t) => {
        const n = t.split(/\s+/).length;
        return n === 1 ? 'large' : n <= 3 ? 'moyen' : 'longue';
      })
    );
    add(
      'tagsDiversity',
      'Tags',
      'Mélange de tags larges et longue traîne',
      2,
      sizes.size >= 2 ? 1 : nbTags ? 0.4 : 0,
      sizes.size >= 2 ? 'Bon mélange.' : 'Combinez tags d’un mot, expressions et requêtes longue traîne.',
      !nbTags
    );
    add(
      'tagsDuplicates',
      'Tags',
      'Pas de doublons',
      2,
      uniqueTags.size === nbTags ? 1 : 0,
      uniqueTags.size === nbTags ? 'Aucun doublon.' : 'Supprimez les tags en double.',
      !nbTags
    );

    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    const score = totalWeight ? Math.round((checks.reduce((s, c) => s + c.weight * c.pass, 0) / totalWeight) * 100) : 0;
    return {
      score,
      keyword,
      checks,
      stats: { titleLength: titleLen, descriptionWords: descWords, descriptionChars: description.length, tagsCount: nbTags, tagsChars: tagChars, hashtags, links, chapters },
    };
  }

  function scoreLabel(score) {
    if (score >= 80) return { label: 'Excellent', tone: 'great' };
    if (score >= 60) return { label: 'Bon', tone: 'good' };
    if (score >= 40) return { label: 'Moyen', tone: 'fair' };
    return { label: 'Faible', tone: 'poor' };
  }

  /* --------------------------------------------------------------- tags */

  /**
   * Suggestions de tags classées.
   * related: suggestions d'autocomplétion ; competitorTags: [{tag, count}] ; existing: tags déjà présents.
   */
  function suggestTags({ title = '', keyword = '', related = [], competitorTags = [], existing = [], limit = 40 }) {
    const tx = T();
    const seen = new Set(existing.map(tx.normalize));
    const out = new Map();
    const push = (tag, score, source) => {
      tag = String(tag || '')
        .trim()
        .replace(/^#/, '');
      if (!tag || tag.length > 100) return;
      const n = tx.normalize(tag);
      if (seen.has(n)) return;
      const prev = out.get(n);
      if (prev) {
        prev.score += score * 0.3;
        if (!prev.sources.includes(source)) prev.sources.push(source);
      } else out.set(n, { tag, score, sources: [source] });
    };
    if (keyword) push(keyword, 100, 'mot-clé');
    related.forEach((s, i) => push(s, 80 - i * 1.5, 'recherches'));
    competitorTags.forEach((t, i) => push(t.tag, 45 + Math.min(40, (t.count || 1) * 8) - i * 0.3, 'concurrents'));
    tx.phraseFrequency([title], 3, 5).forEach((p) => push(p.phrase, 40, 'titre'));
    tx.phraseFrequency([title], 2, 8).forEach((p) => push(p.phrase, 35, 'titre'));
    tx.contentWords(title)
      .filter((w) => w.length > 3)
      .forEach((w) => push(w, 20, 'titre'));
    if (keyword)
      tx.contentWords(keyword)
        .filter((w) => w.length > 3)
        .forEach((w) => push(w, 30, 'mot-clé'));
    return [...out.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  function tagRelevance(tag, { keyword = '', title = '', description = '' }) {
    const tx = T();
    const n = tx.normalize(tag);
    let score = 0;
    if (keyword && n === tx.normalize(keyword)) score += 100;
    if (keyword && n.includes(tx.normalize(keyword))) score += 25;
    if (title && tx.containsPhrase(title, tag)) score += 40;
    if (keyword) score += tx.similarity(tag, keyword) * 30;
    if (description && tx.containsPhrase(description, tag)) score += 10;
    const words = tx.contentWords(tag).map(tx.normalize);
    const titleN = tx.normalize(title);
    score += words.filter((w) => titleN.includes(w)).length * 5;
    return score;
  }

  /** Tri de tags : 'relevance' (défaut), 'length', 'alpha', 'reverse'. */
  function sortTags(tags, ctx = {}, mode = 'relevance') {
    const list = [...new Set(tags.filter(Boolean))];
    if (mode === 'alpha') return list.sort((a, b) => a.localeCompare(b, 'fr'));
    if (mode === 'length') return list.sort((a, b) => b.length - a.length);
    if (mode === 'reverse') return list.reverse();
    return list
      .map((t, i) => ({ t, s: tagRelevance(t, ctx) - i * 0.01 }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.t);
  }

  /** Coupe une liste de tags pour respecter la limite de 500 caractères. */
  function fitTags(tags, max = LIMITS.tags) {
    const out = [];
    for (const t of tags) {
      if (tagsLength([...out, t]) <= max) out.push(t);
    }
    return out;
  }

  /* ---------------------------------------------------- démonétisation */

  const SENSITIVE = {
    violence: {
      label: 'Violence / armes',
      severity: 'high',
      words:
        'tuer tue meurtre meurtrier assassinat assassin tuerie massacre fusillade terroriste terrorisme attentat bombe arme armes fusil pistolet kalach kalachnikov sang sanglant gore decapitation torture viol violer kill killed killing murder murderer shooting shooter gun guns rifle weapon weapons terrorist terrorism bomb bombing blood bloody gore massacre beheading torture rape stab poignarder',
    },
    adult: {
      label: 'Contenu adulte',
      severity: 'high',
      words:
        'sexe sexy porno porn pornographie nude nudes nue nudite nsfw erotique xxx onlyfans strip striptease fetish fetichisme escort prostitution sexuel sexuelle hentai camgirl',
    },
    drugs: {
      label: 'Drogues',
      severity: 'high',
      words: 'drogue drogues cocaine heroine cannabis weed marijuana beuh crack meth methamphetamine lsd ecstasy mdma overdose dealer shit-drogue champignons-hallucinogenes',
    },
    profanity: {
      label: 'Grossièretés',
      severity: 'medium',
      words: 'putain merde connard connasse salope encule enculer bordel nique niquer ntm fdp batard fuck fucking fucker shit bitch asshole bastard motherfucker dick pussy cunt',
    },
    tragedy: {
      label: 'Sujets sensibles / tragédies',
      severity: 'medium',
      words: 'suicide suicider mort morts deces death dead died accident catastrophe pandemie covid coronavirus epidemie cancer guerre war genocide famine tremblement-de-terre',
    },
    controversial: {
      label: 'Sujets controversés / haine',
      severity: 'medium',
      words: 'raciste racisme nazi nazis hitler holocauste extremiste extremisme haine hate harcelement harassment abus abuse discrimination complot conspiracy',
    },
    dangerous: {
      label: 'Actes dangereux / illégaux',
      severity: 'medium',
      words: 'piratage pirater hack hacking crack keygen arnaque scam escroquerie illegal illegale fraude fraud defi-dangereux prank-dangereux',
    },
    clickbait: {
      label: 'Sensationnalisme',
      severity: 'low',
      words: 'choquant choc shocking scandale scandal gone-wrong insolite incroyable-mais-vrai',
    },
  };

  const SENSITIVE_INDEX = (() => {
    const index = [];
    for (const [cat, def] of Object.entries(SENSITIVE)) {
      for (const w of def.words.split(/\s+/)) index.push({ phrase: w.replace(/-/g, ' '), cat });
    }
    return index;
  })();

  /** Audit de démonétisation d'un ensemble de champs : {title, description, tags}. */
  function demonetizationAudit({ title = '', description = '', tags = [] }) {
    const tx = T();
    const fields = { titre: title, description, tags: tags.join(', ') };
    const findings = [];
    for (const [field, text] of Object.entries(fields)) {
      if (!text) continue;
      for (const { phrase, cat } of SENSITIVE_INDEX) {
        const count = tx.countPhrase(text, phrase);
        if (count) findings.push({ field, word: phrase, count, category: cat, label: SENSITIVE[cat].label, severity: SENSITIVE[cat].severity });
      }
    }
    const weights = { high: 25, medium: 10, low: 3 };
    const fieldFactor = { titre: 1.6, tags: 1.2, description: 0.8 };
    const risk = Math.min(100, Math.round(findings.reduce((s, f) => s + weights[f.severity] * fieldFactor[f.field] * Math.min(3, f.count), 0)));
    const level = risk >= 50 ? 'élevé' : risk >= 20 ? 'modéré' : risk > 0 ? 'faible' : 'aucun';
    return { risk, level, findings };
  }

  /* ------------------------------------------------------ audit chaîne */

  function stddev(values) {
    const m = MT.mean(values);
    if (m == null) return null;
    return Math.sqrt(MT.mean(values.map((v) => (v - m) ** 2)));
  }

  /**
   * Audit des bonnes pratiques d'une chaîne.
   * channel: {description, keywords, links, banner, avatar}
   * videos: [{title, description, tags, views, publishedAt (ms), durationSec, isShort}] (les plus récentes d'abord)
   */
  function channelAudit({ channel = {}, videos = [] }) {
    const checks = [];
    const add = (id, group, label, weight, pass, tip) => {
      pass = Math.max(0, Math.min(1, pass));
      checks.push({ id, group, label, weight, pass, status: status(pass), tip });
    };
    const desc = channel.description || '';
    add(
      'chDesc',
      'Chaîne',
      'Description de chaîne complète',
      6,
      desc.length >= 300 ? 1 : desc.length >= 100 ? 0.6 : desc ? 0.3 : 0,
      desc.length >= 300 ? 'Description détaillée.' : 'Rédigez une description de chaîne de 300+ caractères avec vos mots-clés principaux.'
    );
    const kws = channel.keywords || [];
    add(
      'chKeywords',
      'Chaîne',
      `Mots-clés de chaîne (${kws.length})`,
      5,
      kws.length >= 5 ? 1 : kws.length ? 0.5 : 0,
      kws.length >= 5 ? 'Mots-clés renseignés.' : 'Ajoutez des mots-clés de chaîne dans YouTube Studio > Personnalisation > Infos de base.'
    );
    add(
      'chLinks',
      'Chaîne',
      'Liens externes',
      3,
      (channel.links || []).length ? 1 : 0,
      (channel.links || []).length ? 'Liens présents.' : 'Ajoutez vos réseaux sociaux / site dans l’en-tête de la chaîne.'
    );
    add('chBanner', 'Chaîne', 'Bannière personnalisée', 3, channel.banner ? 1 : 0, channel.banner ? 'Bannière présente.' : 'Ajoutez une bannière.');

    const dated = videos.filter((v) => v.publishedAt).sort((a, b) => b.publishedAt - a.publishedAt);
    if (dated.length >= 2) {
      const intervals = [];
      for (let i = 0; i < Math.min(dated.length - 1, 12); i++) intervals.push((dated[i].publishedAt - dated[i + 1].publishedAt) / 86400000);
      const avg = MT.mean(intervals);
      add(
        'freq',
        'Régularité',
        `Fréquence de publication (1 vidéo / ${MT.fmt.dec(avg)} j)`,
        8,
        avg <= 7 ? 1 : avg <= 14 ? 0.6 : avg <= 30 ? 0.3 : 0,
        avg <= 7 ? 'Rythme hebdomadaire ou mieux.' : 'Publiez au moins une fois par semaine pour garder l’audience active.'
      );
      const cv = avg ? stddev(intervals) / avg : 1;
      add(
        'consistency',
        'Régularité',
        'Régularité du calendrier',
        5,
        cv < 0.5 ? 1 : cv < 1 ? 0.5 : 0.1,
        cv < 0.5 ? 'Calendrier régulier.' : 'Publiez à jours/heures fixes : la régularité aide l’algorithme et l’audience.'
      );
      const since = (Date.now() - dated[0].publishedAt) / 86400000;
      add(
        'recency',
        'Régularité',
        `Dernière vidéo (il y a ${Math.round(since)} j)`,
        6,
        since <= 7 ? 1 : since <= 30 ? 0.5 : 0,
        since <= 7 ? 'Chaîne active.' : 'Aucune vidéo récente : relancez la publication.'
      );
    }

    const withViews = videos.filter((v) => v.views != null);
    if (withViews.length >= 8) {
      const recent = MT.median(withViews.slice(0, 5).map((v) => v.views));
      const older = MT.median(withViews.slice(5, 15).map((v) => v.views));
      const ratio = older ? recent / older : 1;
      add(
        'trend',
        'Performance',
        `Tendance des vues (${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)} %)`,
        6,
        ratio >= 1 ? 1 : ratio >= 0.7 ? 0.5 : 0.1,
        ratio >= 1 ? 'Les vidéos récentes performent mieux.' : 'Les dernières vidéos font moins de vues : analysez sujets, titres et miniatures.'
      );
    }

    const longVideos = videos.filter((v) => !v.isShort);
    const scored = videos.map((v) => ({ video: v, seo: scoreVideo({ title: v.title, description: v.description, tags: v.tags, isShort: v.isShort, durationSec: v.durationSec }) }));
    if (scored.length) {
      const avgSeo = MT.mean(scored.map((s) => s.seo.score));
      add(
        'avgSeo',
        'Vidéos',
        `Score SEO moyen des vidéos (${Math.round(avgSeo)}/100)`,
        10,
        avgSeo / 100,
        'Optimisez titres, descriptions et tags des vidéos ayant le score le plus faible.'
      );
      const tagged = videos.filter((v) => (v.tags || []).length >= 5).length / videos.length;
      add('tagsUsage', 'Vidéos', `Vidéos avec 5+ tags (${Math.round(tagged * 100)} %)`, 5, tagged, 'Ajoutez des tags à toutes vos vidéos.');
      if (longVideos.length) {
        const rich = longVideos.filter((v) => MT.text.wordCount(v.description) >= 150).length / longVideos.length;
        add('descUsage', 'Vidéos', `Descriptions de 150+ mots (${Math.round(rich * 100)} %)`, 5, rich, 'Enrichissez les descriptions courtes.');
        const eligible = longVideos.filter((v) => !v.durationSec || v.durationSec >= 180);
        if (eligible.length) {
          const withChapters = eligible.filter((v) => MT.text.extractChapters(v.description).length >= 3).length / eligible.length;
          add('chaptersUsage', 'Vidéos', `Vidéos avec chapitres (${Math.round(withChapters * 100)} %)`, 3, withChapters, 'Ajoutez des chapitres aux vidéos de plus de 3 minutes.');
        }
      }
      const withHashtags = videos.filter((v) => MT.text.extractHashtags(v.description).length > 0).length / videos.length;
      add('hashtagsUsage', 'Vidéos', `Vidéos avec hashtags (${Math.round(withHashtags * 100)} %)`, 2, withHashtags, 'Ajoutez 1 à 3 hashtags par vidéo.');
      const goodTitles =
        videos.filter((v) => {
          const l = [...(v.title || '')].length;
          return l >= 30 && l <= 80;
        }).length / videos.length;
      add('titleUsage', 'Vidéos', `Titres de longueur optimale (${Math.round(goodTitles * 100)} %)`, 3, goodTitles, 'Visez 40 à 70 caractères par titre.');
    }

    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    const score = totalWeight ? Math.round((checks.reduce((s, c) => s + c.weight * c.pass, 0) / totalWeight) * 100) : 0;
    return { score, checks, videos: scored };
  }

  /* ------------------------------------------------------ revenus, idées */

  function estimateEarnings({ monthlyViews, rpmMin = 0.5, rpmMax = 4 }) {
    if (monthlyViews == null) return null;
    const min = (monthlyViews / 1000) * rpmMin;
    const max = (monthlyViews / 1000) * rpmMax;
    return { monthly: { min, max }, yearly: { min: min * 12, max: max * 12 } };
  }

  /** Valeur estimée d'une chaîne (méthode simple : 24 à 36 mois de revenus). */
  function channelValuation(earnings) {
    if (!earnings) return null;
    return { min: earnings.monthly.min * 24, max: earnings.monthly.max * 36 };
  }

  function capitalize(s) {
    s = String(s || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const TITLE_TEMPLATES = [
    '{K} : le guide complet ({Y})',
    'Comment {k} en {n} étapes simples',
    '{n} erreurs à éviter avec {k}',
    '{K} pour débutants : tout ce qu’il faut savoir',
    'J’ai testé {k} pendant 30 jours… voici le résultat',
    '{K} : mes {n} meilleurs conseils',
    'Le secret pour réussir {k} (que personne ne dit)',
    '{K} expliqué en 5 minutes',
    'Top {n} {k} en {Y}',
    'Arrêtez de faire {k} comme ça !',
    '{K} : avant / après',
    'Tuto {k} facile et rapide',
    'Pourquoi {k} va tout changer pour vous',
    '{K} : le vrai coût / la vérité',
    '{K} — astuces de pro',
    '{K} : ce qui marche vraiment en {Y}',
  ];

  function titleIdeas(keyword, count = 16) {
    const k = String(keyword || '').trim();
    if (!k) return [];
    const Y = new Date().getFullYear();
    const nums = [3, 5, 7, 10];
    return TITLE_TEMPLATES.slice(0, count).map((tpl, i) =>
      tpl
        .replace('{K}', capitalize(k))
        .replace('{k}', k)
        .replace('{n}', nums[i % nums.length])
        .replace('{Y}', Y)
    );
  }

  /** Remplace les variables {nom} d'un modèle. */
  function fillTemplate(template, vars = {}) {
    return String(template || '').replace(/\{([\wÀ-ɏ]+)\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
  }

  MT.seo = {
    LIMITS,
    tagsLength,
    parseTagInput,
    guessKeyword,
    scoreVideo,
    scoreLabel,
    suggestTags,
    sortTags,
    tagRelevance,
    fitTags,
    SENSITIVE,
    demonetizationAudit,
    channelAudit,
    estimateEarnings,
    channelValuation,
    titleIdeas,
    fillTemplate,
    capitalize,
  };

  if (typeof module === 'object' && module.exports) module.exports = MT.seo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
