const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('./load');

test('parseCount gère les formats localisés', () => {
  const cases = [
    ['1,234,567 views', 1234567],
    ['1.2K views', 1200],
    ['1,2 k vues', 1200],
    ['12 345 vues', 12345],
    ['1 234 567 vues', 1234567],
    ['1,2 M de vues', 1200000],
    ['3.4M subscribers', 3400000],
    ['1.23K', 1230],
    ['10K', 10000],
    ['1,5 Md de vues', 1500000000],
    ['2.1B views', 2100000000],
    ['1.234.567 Aufrufe', 1234567],
    ['1,2 Mio. Aufrufe', 1200000],
    ['1,2 mil visualizaciones', 1200],
    ['No views', 0],
    ['Aucune vue', 0],
    ['345 videos', 345],
    ['', null],
    [null, null],
  ];
  for (const [input, expected] of cases) assert.equal(MT.parseCount(input), expected, String(input));
});

test('parseRelative gère plusieurs langues', () => {
  const D = 86400;
  const cases = [
    ['3 days ago', 3 * D],
    ['il y a 3 jours', 3 * D],
    ['il y a 2 semaines', 14 * D],
    ['il y a 1 an', 365 * D],
    ['il y a 3 mois', 90 * D],
    ['Streamed 5 hours ago', 5 * 3600],
    ['Diffusé il y a 10 minutes', 600],
    ['vor 2 Jahren', 730 * D],
    ['hace 4 meses', 120 * D],
    ['1 year ago', 365 * D],
    ['hier', D],
    ['1,2 M de vues', null],
    ['1.2M views', null],
    ['Streamed live on Mar 5, 2020', null],
  ];
  for (const [input, expected] of cases) assert.equal(MT.parseRelative(input), expected, input);
});

test('parseDuration / parseIsoDuration', () => {
  assert.equal(MT.parseDuration('12:34'), 754);
  assert.equal(MT.parseDuration('1:02:03'), 3723);
  assert.equal(MT.parseIsoDuration('PT1H2M3S'), 3723);
  assert.equal(MT.parseIsoDuration('PT45S'), 45);
  assert.equal(MT.parseIsoDuration('P1DT1S'), 86401);
});

test('parseDateText', () => {
  assert.equal(MT.parseDateText('Joined Mar 5, 2010'), Date.UTC(2010, 2, 5));
  assert.equal(MT.parseDateText('Inscrit le 5 mars 2010'), Date.UTC(2010, 2, 5));
  assert.equal(MT.parseDateText('2015-07-21'), Date.UTC(2015, 6, 21));
  assert.equal(MT.parseDateText('Beigetreten am 12. Dezember 2019'), Date.UTC(2019, 11, 12));
});

test('URL de vidéo et de chaîne', () => {
  assert.equal(MT.videoIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1'), 'dQw4w9WgXcQ');
  assert.equal(MT.videoIdFromUrl('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(MT.videoIdFromUrl('https://www.youtube.com/shorts/abcdefghijk'), 'abcdefghijk');
  assert.equal(MT.videoIdFromUrl('https://studio.youtube.com/video/abcdefghijk/edit'), 'abcdefghijk');
  assert.equal(MT.videoIdFromUrl('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.deepEqual(MT.channelRefFromUrl('https://www.youtube.com/@MrBeast/videos'), { type: 'handle', value: 'MrBeast' });
  assert.deepEqual(MT.channelRefFromUrl('@squeezie'), { type: 'handle', value: 'squeezie' });
  assert.deepEqual(MT.channelRefFromUrl('https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA'), { type: 'id', value: 'UCX6OQ3DkcsbYNE6H8uQQuVA' });
  assert.deepEqual(MT.channelRefFromUrl('https://www.youtube.com/c/Nom'), { type: 'custom', value: 'Nom' });
});

test('toCSV échappe les cellules', () => {
  const csv = MT.toCSV([{ a: 'x,y', b: 'he said "hi"', c: ['t1', 't2'] }], ['a', 'b', 'c']);
  assert.equal(csv, '﻿a,b,c\r\n"x,y","he said ""hi""","t1, t2"');
});

test('pool limite le parallélisme et capture les erreurs', async () => {
  let active = 0;
  let maxActive = 0;
  const res = await MT.pool([1, 2, 3, 4, 5], 2, async (x) => {
    active++;
    maxActive = Math.max(maxActive, active);
    await MT.sleep(5);
    active--;
    if (x === 3) throw new Error('boom');
    return x * 2;
  });
  assert.equal(maxActive, 2);
  assert.deepEqual(res[0], 2);
  assert.deepEqual(res[2], { error: 'boom' });
});
