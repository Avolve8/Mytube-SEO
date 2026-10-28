/*
 * MyTube SEO — utilitaires communs (pages, scripts de contenu, arrière-plan, tests Node).
 * Aucun innerHTML : tout le DOM est construit via el()/svg() pour rester compatible
 * avec les Trusted Types de YouTube et éviter toute injection.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  /* ------------------------------------------------------------------ DOM */

  const BOOL_ATTRS = new Set(['disabled', 'checked', 'selected', 'hidden', 'readOnly', 'multiple', 'required', 'autofocus', 'open', 'draggable', 'spellcheck']);

  function applyAttrs(node, attrs) {
    if (!attrs) return;
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || (value === false && !BOOL_ATTRS.has(key))) continue;
      if (key === 'class' || key === 'className') {
        node.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : value);
      } else if (key === 'style') {
        if (typeof value === 'string') node.setAttribute('style', value);
        else
          for (const [p, v] of Object.entries(value))
            if (v != null)
              node.style.setProperty(
                p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()),
                v
              );
      } else if (key === 'dataset') {
        for (const [d, v] of Object.entries(value)) if (v != null) node.dataset[d] = v;
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'value' && 'value' in node) {
        node.value = value;
      } else if (BOOL_ATTRS.has(key)) {
        node[key] = !!value;
        if (!value) node.removeAttribute(key.toLowerCase());
      } else if (key === 'for') {
        node.setAttribute('for', value);
      } else if (key === 'ref' && typeof value === 'function') {
        value(node);
      } else {
        node.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }

  function appendChildren(node, children) {
    for (const child of children) {
      if (child == null || child === false || child === true) continue;
      if (Array.isArray(child)) appendChildren(node, child);
      else if (typeof child === 'object' && child.nodeType) node.appendChild(child);
      else node.appendChild(node.ownerDocument.createTextNode(String(child)));
    }
  }

  /** el('div', {class: 'x', onclick}, 'texte', autreNoeud, [liste]) */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    applyAttrs(node, attrs);
    appendChildren(node, children);
    return node;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'class') node.setAttribute('class', v);
        else node.setAttribute(k, String(v));
      }
    }
    appendChildren(node, children);
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /** Ajoute des enfants (en ignorant null/false), contrairement à Node.append. */
  function add(node, ...children) {
    appendChildren(node, children);
    return node;
  }

  /** Remplace le contenu d'un nœud. */
  function fill(node, ...children) {
    clear(node);
    appendChildren(node, children);
    return node;
  }

  /* ------------------------------------------------------------ formatage */

  const LOCALE = 'fr-FR';
  const nfCompact = typeof Intl !== 'undefined' ? new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }) : null;
  const nfInt = typeof Intl !== 'undefined' ? new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }) : null;
  const nf1 = typeof Intl !== 'undefined' ? new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }) : null;

  const fmt = {
    num(n) {
      if (n == null || Number.isNaN(n)) return '—';
      return Math.abs(n) < 10000 ? nfInt.format(n) : nfCompact.format(n);
    },
    int(n) {
      return n == null || Number.isNaN(n) ? '—' : nfInt.format(Math.round(n));
    },
    dec(n, digits = 1) {
      if (n == null || Number.isNaN(n)) return '—';
      return digits === 1 ? nf1.format(n) : new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(n);
    },
    pct(ratio, digits = 1) {
      if (ratio == null || Number.isNaN(ratio)) return '—';
      return new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: digits }).format(ratio);
    },
    signed(n) {
      if (n == null || Number.isNaN(n)) return '—';
      return (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt.num(Math.abs(n));
    },
    duration(sec) {
      if (sec == null || Number.isNaN(sec)) return '—';
      sec = Math.round(sec);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const pad = (x) => String(x).padStart(2, '0');
      return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    },
    date(ts) {
      if (!ts) return '—';
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
    },
    datetime(ts) {
      if (!ts) return '—';
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    /** « il y a 3 jours » à partir d'un âge en secondes */
    ageSec(sec) {
      if (sec == null || Number.isNaN(sec)) return '—';
      const units = [
        [31536000, 'an', 'ans'],
        [2592000, 'mois', 'mois'],
        [604800, 'semaine', 'semaines'],
        [86400, 'jour', 'jours'],
        [3600, 'heure', 'heures'],
        [60, 'minute', 'minutes'],
      ];
      for (const [size, one, many] of units) {
        if (sec >= size) {
          const v = Math.floor(sec / size);
          return `il y a ${v} ${v > 1 ? many : one}`;
        }
      }
      return "à l'instant";
    },
    ago(ts) {
      return ts ? fmt.ageSec((Date.now() - new Date(ts).getTime()) / 1000) : '—';
    },
  };

  /* -------------------------------------------------------------- parsing */

  function stripAccents(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  const MULTIPLIERS = [
    [/^(milliards?|billions?|mrd|md|bn|b|g)$/, 1e9],
    [/^(millions?|millones?|milioni|milhoes|mio|mln|mi|m)$/, 1e6],
    [/^(milliers?|mille|mila|mil|thousands?|tsd|k)$/, 1e3],
  ];

  /**
   * Convertit un compteur YouTube localisé en nombre :
   * "1,234,567 views", "1.2K", "1,2 k vues", "12 345 vues", "1,2 M de vues", "Aucune vue".
   */
  function parseCount(text) {
    if (text == null) return null;
    if (typeof text === 'number') return Number.isFinite(text) ? text : null;
    const s = stripAccents(String(text)).toLowerCase().replace(/[   ]/g, ' ').trim();
    if (!s) return null;
    if (/^(no|aucun|aucune|ningun|ninguna|keine|nessuna|nenhuma|nenhum)\b/.test(s)) return 0;
    const m = s.match(/(\d+(?:[.,' ]\d+)*)\s*([a-z]+\.?)?/);
    if (!m) return null;
    const numPart = m[1];
    const word = (m[2] || '').replace(/\.$/, '');
    let mult = 1;
    for (const [re, value] of MULTIPLIERS) {
      if (word && re.test(word)) {
        mult = value;
        break;
      }
    }
    if (mult > 1) {
      // nombre décimal : « 1,2 » ou « 1.2 » (un seul séparateur décimal)
      const cleaned = numPart.replace(/[ ']/g, '');
      const lastSep = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
      let value;
      if (lastSep >= 0 && cleaned.length - lastSep - 1 <= 2) {
        value = parseFloat(cleaned.slice(0, lastSep).replace(/[.,]/g, '') + '.' + cleaned.slice(lastSep + 1));
      } else {
        value = parseFloat(cleaned.replace(/[.,]/g, ''));
      }
      return Number.isFinite(value) ? Math.round(value * mult) : null;
    }
    const digits = numPart.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : null;
  }

  const TIME_UNITS = [
    [['sec', 'seg', 'sek'], 1],
    [['min'], 60],
    [['hour', 'heure', 'hora', 'stund', 'ora', 'ore', 'hr'], 3600],
    [['day', 'jour', 'dia', 'tag', 'giorn'], 86400],
    [['week', 'semaine', 'semana', 'sem', 'woche', 'settiman', 'wk'], 604800],
    [['month', 'mois', 'mes', 'monat', 'mese', 'mo'], 2592000],
    [['year', 'an', 'annee', 'ano', 'jahr', 'anno', 'yr'], 31536000],
  ];

  /** "3 days ago" / "il y a 3 jours" / "vor 3 Tagen" → secondes (approx.) */
  function parseRelative(text) {
    if (!text) return null;
    const s = stripAccents(String(text)).toLowerCase().replace(/[  ]/g, ' ');
    if (/\b(yesterday|hier|ayer|gestern|ieri|ontem)\b/.test(s)) return 86400;
    if (/\b(today|aujourd|hoy|heute|oggi|hoje|just now|instant)\b/.test(s)) return 0;
    const re = /(\d+)\s*([a-z]+)/g;
    let m;
    while ((m = re.exec(s))) {
      const word = m[2];
      for (const [prefixes, size] of TIME_UNITS) {
        if (prefixes.some((p) => word.startsWith(p))) return parseInt(m[1], 10) * size;
      }
    }
    return null;
  }

  /** "1:02:03" → 3723 */
  function parseDuration(text) {
    if (!text) return null;
    const m = String(text).match(/(\d+(?::\d{1,2}){1,2})/);
    if (!m) return null;
    return m[1].split(':').reduce((acc, part) => acc * 60 + parseInt(part, 10), 0);
  }

  /** Durée ISO 8601 de l'API Data ("PT1H2M3S") → secondes */
  function parseIsoDuration(iso) {
    const m = String(iso || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return null;
    const [, d, h, mi, s] = m.map((x) => (x ? parseInt(x, 10) : 0));
    return d * 86400 + h * 3600 + mi * 60 + s;
  }

  const MONTHS = {
    jan: 0,
    janv: 0,
    janvier: 0,
    january: 0,
    ene: 0,
    enero: 0,
    januar: 0,
    gen: 0,
    gennaio: 0,
    janeiro: 0,
    feb: 1,
    fev: 1,
    fevr: 1,
    fevrier: 1,
    february: 1,
    febrero: 1,
    februar: 1,
    febbraio: 1,
    fevereiro: 1,
    mar: 2,
    mars: 2,
    march: 2,
    marzo: 2,
    marz: 2,
    marco: 2,
    apr: 3,
    avr: 3,
    avril: 3,
    april: 3,
    abr: 3,
    abril: 3,
    aprile: 3,
    may: 4,
    mai: 4,
    mayo: 4,
    mag: 4,
    maggio: 4,
    maio: 4,
    jun: 5,
    juin: 5,
    june: 5,
    junio: 5,
    juni: 5,
    giu: 5,
    giugno: 5,
    junho: 5,
    jul: 6,
    juil: 6,
    juillet: 6,
    july: 6,
    julio: 6,
    juli: 6,
    lug: 6,
    luglio: 6,
    julho: 6,
    aug: 7,
    aout: 7,
    august: 7,
    ago: 7,
    agosto: 7,
    sep: 8,
    sept: 8,
    septembre: 8,
    september: 8,
    septiembre: 8,
    set: 8,
    settembre: 8,
    setembro: 8,
    oct: 9,
    octobre: 9,
    october: 9,
    octubre: 9,
    okt: 9,
    oktober: 9,
    ott: 9,
    ottobre: 9,
    out: 9,
    outubro: 9,
    nov: 10,
    novembre: 10,
    november: 10,
    noviembre: 10,
    novembro: 10,
    dec: 11,
    decembre: 11,
    december: 11,
    dic: 11,
    diciembre: 11,
    dez: 11,
    dezember: 11,
    dicembre: 11,
    dezembro: 11,
  };

  /** "Joined Mar 5, 2010" / "Inscrit le 5 mars 2010" / "2010-03-05" → timestamp */
  function parseDateText(text) {
    if (!text) return null;
    const iso = String(text).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
    const s = stripAccents(String(text)).toLowerCase().replace(/[.,]/g, ' ');
    const year = s.match(/\b(19|20)\d{2}\b/);
    if (!year) return null;
    let month = null;
    let day = 1;
    const words = s.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (month == null && Object.prototype.hasOwnProperty.call(MONTHS, w)) {
        month = MONTHS[w];
        const before = parseInt(words[i - 1], 10);
        const after = parseInt(words[i + 1], 10);
        if (before >= 1 && before <= 31) day = before;
        else if (after >= 1 && after <= 31 && String(after).length <= 2) day = after;
      }
    }
    if (month == null) {
      const num = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
      if (num) return Date.UTC(+num[3], +num[2] - 1, +num[1]);
      return Date.UTC(+year[0], 0, 1);
    }
    return Date.UTC(+year[0], month, day);
  }

  /* ---------------------------------------------------------------- URLs */

  function videoIdFromUrl(input) {
    if (!input) return null;
    const s = String(input).trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    const m = s.match(/[?&]v=([\w-]{11})/) || s.match(/youtu\.be\/([\w-]{11})/) || s.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/) || s.match(/\/video\/([\w-]{11})(?:\/|$)/);
    return m ? m[1] : null;
  }

  /** Référence de chaîne depuis une URL, un @handle ou un identifiant UC… */
  function channelRefFromUrl(input) {
    if (!input) return null;
    const s = String(input).trim();
    let m;
    if ((m = s.match(/^(UC[\w-]{22})$/))) return { type: 'id', value: m[1] };
    if ((m = s.match(/\/channel\/(UC[\w-]{22})/))) return { type: 'id', value: m[1] };
    if ((m = s.match(/^@([\w.\-À-ɏ]+)$/))) return { type: 'handle', value: m[1] };
    if ((m = s.match(/youtube\.com\/@([^/?#]+)/))) return { type: 'handle', value: decodeURIComponent(m[1]) };
    if ((m = s.match(/youtube\.com\/(c|user)\/([^/?#]+)/))) return { type: m[1] === 'c' ? 'custom' : 'user', value: decodeURIComponent(m[2]) };
    if (/^[\w.\-]{3,}$/.test(s)) return { type: 'handle', value: s };
    return null;
  }

  function channelUrl(ref) {
    if (!ref) return null;
    if (ref.type === 'id') return `https://www.youtube.com/channel/${ref.value}`;
    if (ref.type === 'handle') return `https://www.youtube.com/@${encodeURIComponent(ref.value)}`;
    if (ref.type === 'custom') return `https://www.youtube.com/c/${encodeURIComponent(ref.value)}`;
    return `https://www.youtube.com/user/${encodeURIComponent(ref.value)}`;
  }

  function thumbUrl(videoId, quality = 'hqdefault') {
    return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
  }

  /* -------------------------------------------------------------- divers */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function debounce(fn, ms = 300) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, v));
  }

  function median(values) {
    const arr = values.filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
    if (!arr.length) return null;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  function mean(values) {
    const arr = values.filter((v) => v != null && !Number.isNaN(v));
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  }

  /** Exécute des tâches asynchrones avec un parallélisme limité. */
  async function pool(items, limit, worker, onProgress) {
    const results = new Array(items.length);
    let next = 0;
    let done = 0;
    async function run() {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = await worker(items[i], i);
        } catch (e) {
          results[i] = { error: e && e.message ? e.message : String(e) };
        }
        done++;
        if (onProgress) onProgress(done, items.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
  }

  function csvCell(v) {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join(', ') : String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** rows: tableau d'objets ; columns: [{key, label}] ou liste de clés */
  function toCSV(rows, columns) {
    const cols = (columns || Object.keys(rows[0] || {})).map((c) => (typeof c === 'string' ? { key: c, label: c } : c));
    const lines = [cols.map((c) => csvCell(c.label)).join(',')];
    for (const row of rows) lines.push(cols.map((c) => csvCell(typeof c.get === 'function' ? c.get(row) : row[c.key])).join(','));
    return '﻿' + lines.join('\r\n');
  }

  function download(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = el('textarea', { style: 'position:fixed;left:-9999px;top:0' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (_) {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  }

  function slug(s) {
    return (
      stripAccents(String(s || ''))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'export'
    );
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Appel RPC vers le script d'arrière-plan : renvoie data ou lève une erreur. */
  async function send(type, payload) {
    const res = await browser.runtime.sendMessage({ type, payload });
    if (!res) throw new Error("Pas de réponse de l'extension");
    if (!res.ok) throw new Error(res.error || 'Erreur inconnue');
    return res.data;
  }

  function appUrl(route) {
    return browser.runtime.getURL('app/app.html') + '#/' + (route || '');
  }

  function openApp(route) {
    return send('open.app', { route });
  }

  Object.assign(MT, {
    el,
    svg,
    clear,
    add,
    fill,
    fmt,
    stripAccents,
    parseCount,
    parseRelative,
    parseDuration,
    parseIsoDuration,
    parseDateText,
    videoIdFromUrl,
    channelRefFromUrl,
    channelUrl,
    thumbUrl,
    uid,
    sleep,
    debounce,
    clamp,
    median,
    mean,
    pool,
    toCSV,
    download,
    copy,
    slug,
    today,
    send,
    appUrl,
    openApp,
  });

  if (typeof module === 'object' && module.exports) module.exports = MT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
