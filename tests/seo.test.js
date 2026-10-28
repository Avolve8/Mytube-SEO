const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load');

const good = {
  title: 'Recette crêpes faciles : la pâte inratable en 5 minutes',
  keyword: 'recette crêpes faciles',
  description:
    'Recette crêpes faciles et rapides : voici ma pâte à crêpes inratable, prête en 5 minutes. ' +
    'Dans cette vidéo je vous montre ma recette crêpes faciles pas à pas. '.repeat(20) +
    '\n00:00 Introduction\n01:10 Ingrédients\n03:00 Cuisson\n\nAbonne-toi : https://youtube.com/@moi\n#crepes #recette',
  tags: ['recette crêpes faciles', 'pâte à crêpes', 'crêpes', 'recette crêpes', 'crêpes rapides', 'pâte à crêpes inratable', 'dessert facile', 'chandeleur'],
};

test('tagsLength compte guillemets et virgules comme YouTube', () => {
  assert.equal(MT.seo.tagsLength(['a', 'b c']), 1 + 5 + 1);
  assert.equal(MT.seo.tagsLength([]), 0);
});

test('scoreVideo : une vidéo optimisée obtient un bon score', () => {
  const r = MT.seo.scoreVideo(good);
  assert.ok(r.score >= 75, `score ${r.score}`);
  assert.equal(r.checks.find((c) => c.id === 'kwInTitle').status, 'ok');
  assert.equal(r.checks.find((c) => c.id === 'kwFirstTag').status, 'ok');
  assert.equal(r.checks.find((c) => c.id === 'chapters').status, 'ok');
});

test('scoreVideo : une vidéo vide obtient un mauvais score', () => {
  const r = MT.seo.scoreVideo({ title: 'VLOG!!!', description: '', tags: [], keyword: 'voyage japon' });
  assert.ok(r.score < 25, `score ${r.score}`);
  assert.equal(r.checks.find((c) => c.id === 'titlePunct').status, 'bad');
});

test('scoreVideo devine le mot-clé à partir du premier tag', () => {
  const r = MT.seo.scoreVideo({ ...good, keyword: '' });
  assert.equal(r.keyword, 'recette crêpes faciles');
});

test('suggestTags exclut les tags existants et classe le mot-clé en premier', () => {
  const s = MT.seo.suggestTags({ title: good.title, keyword: 'crêpes faciles', related: ['crêpes faciles sans lait', 'crêpes faciles rapide'], existing: ['crêpes'] });
  assert.equal(s[0].tag, 'crêpes faciles');
  assert.ok(!s.some((x) => x.tag === 'crêpes'));
});

test('sortTags met le mot-clé exact en premier', () => {
  const sorted = MT.seo.sortTags(['dessert', 'chandeleur', 'recette crêpes faciles', 'crêpes'], { keyword: 'recette crêpes faciles', title: good.title });
  assert.equal(sorted[0], 'recette crêpes faciles');
});

test('fitTags respecte la limite de 500 caractères', () => {
  const tags = Array.from({ length: 80 }, (_, i) => 'tag numero ' + i);
  const fit = MT.seo.fitTags(tags);
  assert.ok(MT.seo.tagsLength(fit) <= 500);
  assert.ok(fit.length > 10);
});

test('audit de démonétisation', () => {
  const r = MT.seo.demonetizationAudit({ title: 'Fusillade et drogue : le reportage', description: 'Rien de grave', tags: ['putain'] });
  assert.ok(r.risk > 40);
  assert.ok(r.findings.some((f) => f.category === 'violence'));
  assert.ok(r.findings.some((f) => f.category === 'drugs'));
  assert.equal(MT.seo.demonetizationAudit({ title: 'Recette de crêpes', description: '', tags: [] }).level, 'aucun');
});

test('audit de chaîne', () => {
  const now = Date.now();
  const videos = Array.from({ length: 10 }, (_, i) => ({ ...good, views: 1000 - i * 10, publishedAt: now - i * 7 * 86400000 }));
  const r = MT.seo.channelAudit({ channel: { description: 'x'.repeat(400), keywords: ['a', 'b', 'c', 'd', 'e'], links: [{}], banner: 'u' }, videos });
  assert.ok(r.score >= 70, `score ${r.score}`);
});

test('texte : sentiment, questions, chapitres', () => {
  assert.ok(MT.text.sentiment('Super vidéo, vraiment génial merci !') > 0.3);
  assert.ok(MT.text.sentiment('Nul, vraiment décevant et ennuyeux') < -0.3);
  assert.ok(MT.text.sentiment('pas mal du tout') >= 0);
  assert.ok(MT.text.isQuestion('Comment tu fais ça ?'));
  assert.equal(MT.text.extractChapters('00:00 Intro\n1:23 Suite\n10:00 Fin').length, 3);
  assert.ok(MT.text.containsPhrase('Les Crêpes faciles du dimanche', 'crepes faciles'));
  assert.ok(!MT.text.containsPhrase('Les crêpesfaciles', 'crepes faciles'));
  assert.equal(MT.text.countPhrase('chat noir, chat noir et chat', 'chat noir'), 2);
  assert.deepEqual(MT.text.wordFrequency(['chat chat chien', 'chat'])[0], { word: 'chat', count: 3 });
});

test('score de mot-clé', () => {
  const day = 86400;
  const search = {
    estimatedResults: 250000,
    videos: Array.from({ length: 20 }, (_, i) => ({
      videoId: 'v' + i,
      title: i % 2 ? 'Recette crêpes faciles' : 'Autre chose',
      views: 100000 / (i + 1),
      ageSec: (i + 1) * 30 * day,
      verified: i < 3,
      channelId: 'c' + (i % 7),
    })),
  };
  const probes = [
    { prefix: 'rece', suggestions: ['recette'] },
    { prefix: 'recette c', suggestions: ['recette crêpes faciles', 'recette cookies'] },
    { prefix: 'recette crêpes faciles', suggestions: ['recette crêpes faciles', 'recette crêpes faciles sans lait', 'recette crêpes faciles rapide'] },
  ];
  const r = MT.keyword.scoreKeyword({ keyword: 'recette crêpes faciles', search, probes, myChannel: { avgViews: 500 } });
  for (const k of ['volume', 'competition', 'optimization', 'overall', 'weighted']) {
    assert.ok(r[k] >= 0 && r[k] <= 100, `${k}=${r[k]}`);
  }
  assert.equal(r.autocomplete.found.prefix, 'recette c');
  assert.equal(r.metrics.titleMatchPct, 0.5);
  assert.deepEqual(MT.keyword.probePrefixes('recette crêpes faciles').slice(-1), ['recette crêpes faciles']);
  assert.equal(MT.keyword.expansionQueries('chat', 'fr').length, 1 + 26 + 8);
});

test('tagFrequency', () => {
  const r = MT.keyword.tagFrequency([
    { videoId: 'a', tags: ['Chat', 'chien'] },
    { videoId: 'b', tags: ['chat'] },
  ]);
  assert.equal(r[0].tag, 'Chat');
  assert.equal(r[0].count, 2);
  assert.equal(r[0].pct, 1);
});
