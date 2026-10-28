/*
 * MyTube SEO — traitement de texte : normalisation, mots vides, fréquences,
 * sentiment (lexique FR/EN), questions, hashtags, liens, chapitres.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  const STOPWORDS = new Set(
    // français
    (
      "a à afin ai aie aient aies ait alors as au aucun aucune aupres auquel aura aurai auraient aurais aurait auras aurez auriez aurions aurons auront aussi autre autres aux auxquelles auxquels avaient avais avait avant avec avez aviez avions avoir avons ayant ayez ayons bon c ça car ce ceci cela celle celles celui cependant certain certaine certains ces cet cette ceux chacun chaque chez ci comme comment d dans de des deja depuis dès desquelles desquels deux devrait doit donc dont du duquel durant elle elles en encore entre es est et etaient etais etait etant ete etes etiez etions etre eu eue eues eurent eus eusse eut eux fait faire fais faut font fut ici il ils j je jusqu jusque l la là laquelle le lequel les lesquelles lesquels leur leurs lors lorsque lui m ma mais me meme memes mes moi mon n ne ni non nos notre nous on ont ou où par parce pas peu peut peuvent plus pour pourquoi puis qu quand que quel quelle quelles quels qui quoi s sa sans se sera serai seraient serais serait seras serez seriez serions serons seront ses si sien sienne son sont sous suis sur t ta tandis te tes toi ton tous tout toute toutes tres tu un une unes uns va vers voila vos votre vous vu y c'est j'ai " +
      // anglais
      'a about above after again against all am an and any are aren as at be because been before being below between both but by can cannot could couldn did didn do does doesn doing don down during each few for from further had hadn has hasn have haven having he her here hers herself him himself his how i if in into is isn it its itself just let me more most mustn my myself no nor not now of off on once only or other ought our ours ourselves out over own same shan she should shouldn so some such than that the their theirs them themselves then there these they this those through to too under until up very was wasn we were weren what when where which while who whom why will with won would wouldn you your yours yourself yourselves im ive dont thats its youre ' +
      // espagnol / allemand (courants)
      'el los las del lo un una unos unas y o que en por con para es son al se su sus como mas pero muy ya der die das und ist nicht ein eine zu mit von den dem des auf fur im ich sie es wir ihr'
    ).split(/\s+/)
  );

  // Mots génériques YouTube à ignorer dans les nuages de mots
  const YT_NOISE = new Set(
    'video videos vidéo vidéos youtube chaine chaîne lien link subscribe abonne abonnez abonnes like likes commentaire comment comments merci thanks thank please svp https http www com'.split(
      ' '
    )
  );

  function normalize(s) {
    return MT.stripAccents(String(s || ''))
      .toLowerCase()
      .replace(/[’`]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Tokenise en mots (lettres/chiffres, accents conservés pour l'affichage). */
  function tokenize(s) {
    return (
      String(s || '')
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []
    ).map((w) => w.replace(/['’-]+$/, ''));
  }

  function isStopword(word) {
    const n = MT.stripAccents(word).toLowerCase();
    return STOPWORDS.has(n) || STOPWORDS.has(word);
  }

  function contentWords(s) {
    return tokenize(s).filter((w) => w.length > 1 && !isStopword(w) && !/^\d+$/.test(w));
  }

  /** Fréquence des mots d'un ensemble de textes, triée décroissante. */
  function wordFrequency(texts, opts = {}) {
    const { minLength = 3, limit = 100, ignore = [], noise = true } = opts;
    const ignoreSet = new Set(ignore.map((w) => normalize(w)));
    const counts = new Map();
    const display = new Map();
    for (const text of texts) {
      for (const w of tokenize(text)) {
        if (w.length < minLength || /^\d+$/.test(w)) continue;
        const n = normalize(w);
        if (STOPWORDS.has(n) || ignoreSet.has(n) || (noise && YT_NOISE.has(n))) continue;
        counts.set(n, (counts.get(n) || 0) + 1);
        if (!display.has(n)) display.set(n, w);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([n, count]) => ({ word: display.get(n), count }));
  }

  /** N-grammes (expressions de 2-3 mots) les plus fréquents. */
  function phraseFrequency(texts, n = 2, limit = 30) {
    const counts = new Map();
    for (const text of texts) {
      const words = tokenize(text).filter((w) => w.length > 1);
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n);
        if (isStopword(gram[0]) || isStopword(gram[n - 1])) continue;
        const key = gram.join(' ');
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, c]) => c > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([phrase, count]) => ({ phrase, count }));
  }

  /* ----------------------------------------------------------- sentiment */

  const POSITIVE =
    "super genial génial excellent excellente top bravo merci parfait parfaite magnifique incroyable adore adoré j'adore aime aimé love loved amazing awesome great good nice best cool beautiful perfect fantastic wonderful brilliant thanks thank helpful utile utiles intéressant interessant intéressante passionnant clair claire efficace drôle drole marrant hilarant fun beau belle bien meilleur meilleure meilleurs merveilleux formidable impressionnant chapeau pépite pepite qualité qualite gg wow excellent inspirant inspirante motivant enjoyed enjoy recommend recommande fan fans favorite favori favorite préféré prefere masterpiece chef-d'oeuvre bonheur heureux heureuse happy glad epic légendaire legend legendary pertinent pertinente instructif instructive"
      .split(/\s+/)
      .map(normalize);

  const NEGATIVE =
    'nul nulle mauvais mauvaise horrible affreux affreuse décevant decevant déçu decu déçue deception déception ennuyeux ennuyeuse chiant naze pourri pourrie arnaque faux fausse mensonge menteur bad worst terrible awful boring hate hated sucks trash garbage useless inutile fake scam disappointed disappointing poor stupid stupide idiot dommage nope dislike clickbait putaclic merde problème probleme bug bugs cassé casse broken wrong erreur erreurs incorrect honte shame lent slow pénible penible insupportable agaçant agacant énervant enervant triste sad angry colère colere wtf beurk dégueulasse degueulasse pire'
      .split(/\s+/)
      .map(normalize);

  const NEGATORS = new Set(['pas', 'jamais', 'plus', 'not', 'never', 'no', 'non', 'aucun', 'aucune', 'sans', "n't", 'dont', "don't", 'isnt', "isn't"]);
  const INTENSIFIERS = new Set(['très', 'tres', 'trop', 'vraiment', 'super', 'tellement', 'very', 'really', 'so', 'too', 'extremely', 'grave']);

  const POS_EMOJI = /[😀😃😄😁😆😊🙂😍🥰😘👍👏🙌💪🔥💖💯⭐🌟✨🎉🤩😎🥳💙💚💛💜🧡❤]/u;
  const NEG_EMOJI = /[😡😠🤬👎😢😭😞😒🙄🤮💩😤😩😫]/u;

  const POS_SET = new Set(POSITIVE);
  const NEG_SET = new Set(NEGATIVE);

  /** Score de sentiment entre -1 et 1 (lexique + émojis + négations). */
  function sentiment(text) {
    const words = tokenize(text).map(normalize);
    let score = 0;
    let hits = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      let v = POS_SET.has(w) ? 1 : NEG_SET.has(w) ? -1 : 0;
      if (!v) continue;
      const prev = words.slice(Math.max(0, i - 3), i);
      if (prev.some((p) => NEGATORS.has(p))) v = -v * 0.8;
      if (prev.some((p) => INTENSIFIERS.has(p))) v *= 1.5;
      score += v;
      hits++;
    }
    const str = String(text || '');
    const pe = (str.match(new RegExp(POS_EMOJI.source, 'gu')) || []).length;
    const ne = (str.match(new RegExp(NEG_EMOJI.source, 'gu')) || []).length;
    score += pe * 0.7 - ne * 0.7;
    hits += pe + ne;
    if (/!{2,}/.test(str) && score > 0) score += 0.3;
    if (!hits) return 0;
    return Math.max(-1, Math.min(1, score / Math.sqrt(hits + 1)));
  }

  function sentimentLabel(score) {
    if (score > 0.15) return 'positif';
    if (score < -0.15) return 'négatif';
    return 'neutre';
  }

  function isQuestion(text) {
    const s = normalize(text);
    return (
      /\?/.test(s) || /^(comment|pourquoi|quand|quel|quelle|quels|quelles|est-ce|combien|ou |how|why|what|when|where|which|who|can you|could you|do you|is it|are you|qui )/.test(s)
    );
  }

  function extractHashtags(text) {
    return [...new Set((String(text || '').match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.toLowerCase()))];
  }

  function extractLinks(text) {
    return [...new Set(String(text || '').match(/https?:\/\/[^\s<>"')]+/g) || [])];
  }

  /** Chapitres « 00:00 Titre » dans une description. */
  function extractChapters(text) {
    const chapters = [];
    for (const line of String(text || '').split('\n')) {
      const m = line.match(/^\s*[\-•▶►]?\s*\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s*[-–—:|]?\s*(.+)?$/);
      if (m) chapters.push({ time: m[1], seconds: MT.parseDuration(m[1]), title: (m[2] || '').trim() });
    }
    return chapters;
  }

  function wordCount(text) {
    return tokenize(text).length;
  }

  /** Similarité de Jaccard entre deux textes (mots de contenu). */
  function similarity(a, b) {
    const A = new Set(contentWords(a).map(normalize));
    const B = new Set(contentWords(b).map(normalize));
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const w of A) if (B.has(w)) inter++;
    return inter / (A.size + B.size - inter);
  }

  /** Le texte contient-il l'expression (insensible à la casse et aux accents) ? */
  function containsPhrase(text, phrase) {
    const p = normalize(phrase);
    if (!p) return false;
    const t = ' ' + normalize(text).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
    return t.includes(' ' + p.replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ');
  }

  function countPhrase(text, phrase) {
    const p = normalize(phrase)
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    if (!p) return 0;
    const t = ' ' + normalize(text).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
    let count = 0;
    let idx = 0;
    const needle = ' ' + p + ' ';
    while ((idx = t.indexOf(needle, idx)) !== -1) {
      count++;
      idx += needle.length - 1;
    }
    return count;
  }

  MT.text = {
    STOPWORDS,
    normalize,
    tokenize,
    isStopword,
    contentWords,
    wordFrequency,
    phraseFrequency,
    sentiment,
    sentimentLabel,
    isQuestion,
    extractHashtags,
    extractLinks,
    extractChapters,
    wordCount,
    similarity,
    containsPhrase,
    countPhrase,
  };

  if (typeof module === 'object' && module.exports) module.exports = MT.text;
})(typeof globalThis !== 'undefined' ? globalThis : this);
