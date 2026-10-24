/*
 * MyTube SEO — tâches périodiques (alarmes) exécutées en arrière-plan quand Firefox est ouvert :
 * suivi de classement, instantanés des concurrents et de votre chaîne, alertes de marque,
 * rotation des tests A/B et mises à jour programmées.
 * Chaque passage traite un volume borné (page d'événements suspendue après inactivité).
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  const BUDGET_MS = 20000;
  const HOUR = 3600 * 1000;

  async function notify(id, title, message) {
    const s = await MT.store.getSettings();
    if (!s.notifications) return;
    try {
      await browser.notifications.create(id, { type: 'basic', iconUrl: browser.runtime.getURL('icons/icon-96.png'), title, message });
    } catch (e) {
      /* notifications indisponibles */
    }
  }

  function overBudget(start) {
    return Date.now() - start > BUDGET_MS;
  }

  /* ------------------------------------------------------- classement */

  async function rankTick() {
    const s = await MT.store.getSettings();
    const freq = Math.max(1, s.rankFrequencyHours || 24) * HOUR;
    const items = (await MT.store.list('rankTracking'))
      .filter((i) => !i.paused && (!i.lastChecked || Date.now() - i.lastChecked >= freq))
      .sort((a, b) => (a.lastChecked || 0) - (b.lastChecked || 0));
    const start = Date.now();
    let done = 0;
    for (const item of items) {
      if (overBudget(start)) break;
      try {
        const c = await MT.research.checkRank(item.id);
        done++;
        if (c && c.prev !== undefined && c.prev !== c.rank) {
          const enteredTop = c.rank != null && c.rank <= 10 && (c.prev == null || c.prev > 10);
          const lost = c.rank == null && c.prev != null;
          const bigMove = c.rank != null && c.prev != null && Math.abs(c.prev - c.rank) >= 5;
          if (enteredTop || lost || bigMove) {
            const msg =
              c.rank == null
                ? `« ${item.keyword} » : sortie du top ${item.depth || 100} (était #${c.prev}).`
                : `« ${item.keyword} » : #${c.rank}${c.prev != null ? ` (était #${c.prev})` : ''}.`;
            await notify('rank-' + item.id + '-' + Date.now(), 'Classement : ' + (item.title || '').slice(0, 60), msg);
          }
        }
      } catch (e) {
        /* erreur enregistrée sur l'élément */
      }
      await MT.sleep(400);
    }
    if (done) await MT.store.addJobLog({ job: 'rank', message: `${done} classement(s) vérifié(s)` });
  }

  /* ------------------------------------------------------ concurrents */

  async function competitorsTick() {
    const s = await MT.store.getSettings();
    const freq = Math.max(6, s.competitorFrequencyHours || 24) * HOUR;
    const start = Date.now();
    let done = 0;
    const list = (await MT.store.list('competitors'))
      .filter((c) => !c.lastChecked || Date.now() - c.lastChecked >= freq)
      .sort((a, b) => (a.lastChecked || 0) - (b.lastChecked || 0));
    for (const c of list) {
      if (overBudget(start)) break;
      try {
        await MT.research.snapshotCompetitor(c.id);
        done++;
      } catch (e) {
        await MT.store.update('competitors', (all) => {
          const x = all.find((y) => y.id === c.id);
          if (x) {
            x.lastChecked = Date.now();
            x.error = e.message;
          }
          return all;
        });
      }
    }
    if (s.myChannelId && !overBudget(start)) {
      const snaps = await MT.store.list('mySnapshots');
      const last = snaps[snaps.length - 1];
      if (!last || Date.now() - last.t >= 20 * HOUR) {
        try {
          await MT.research.snapshotMyChannel();
          done++;
        } catch (e) {
          /* réessai au prochain passage */
        }
      }
    }
    if (done) await MT.store.addJobLog({ job: 'competitors', message: `${done} chaîne(s) mise(s) à jour` });
  }

  /* --------------------------------------------------------- alertes */

  async function alertsTick() {
    const s = await MT.store.getSettings();
    const freq = Math.max(1, s.alertFrequencyHours || 6) * HOUR;
    const start = Date.now();
    const list = (await MT.store.list('alerts')).filter((a) => !a.paused && (!a.lastChecked || Date.now() - a.lastChecked >= freq));
    for (const a of list) {
      if (overBudget(start)) break;
      try {
        const r = await MT.research.checkAlert(a.id);
        if (r && r.fresh.length) {
          await notify('alert-' + a.id + '-' + Date.now(), `Alerte « ${a.term} »`, `${r.fresh.length} nouvelle(s) vidéo(s) : ${r.fresh[0].title}`);
        }
      } catch (e) {
        /* réessai au prochain passage */
      }
    }
  }

  /* -------------------------------------------------------- tests A/B */

  function winnerIndex(test) {
    let best = -1;
    let bestRate = -1;
    test.variants.forEach((v, i) => {
      const rate = v.hours > 0 ? v.views / v.hours : -1;
      if (rate > bestRate) {
        bestRate = rate;
        best = i;
      }
    });
    return best < 0 ? 0 : best;
  }

  async function patchTest(id, patch) {
    await MT.store.update('abTests', (list) => {
      const t = list.find((x) => x.id === id);
      if (t) Object.assign(t, typeof patch === 'function' ? patch(t) : patch);
      return list;
    });
  }

  /** Crédite la période écoulée à la variante active puis passe à la suivante (ou termine). */
  async function advanceAbTest(id, auth, { finish = false } = {}) {
    const t = (await MT.store.list('abTests')).find((x) => x.id === id);
    if (!t || t.status !== 'running') throw new Error('Test non actif');
    const [stats] = await MT.ytapi.videos([t.videoId], auth, 'statistics');
    if (!stats) throw new Error('Vidéo introuvable');
    const now = Date.now();
    const variants = t.variants.map((v) => ({ ...v }));
    const cur = variants[t.currentIndex];
    cur.views = (cur.views || 0) + Math.max(0, (stats.views || 0) - (t.lastViews || 0));
    cur.hours = (cur.hours || 0) + Math.max(0, (now - t.lastSwitchAt) / HOUR);
    cur.periods = (cur.periods || 0) + 1;
    const log = [...(t.log || [])];
    if (finish || now >= t.endsAt) {
      const w = winnerIndex({ variants });
      if (w !== t.currentIndex) await MT.research.applyVariant(t.type, t.videoId, variants[w], auth);
      log.push({ t: now, msg: `Test terminé : variante ${variants[w].label} gagnante, appliquée définitivement.` });
      await patchTest(id, { variants, status: 'done', winnerIndex: w, finishedAt: now, lastViews: stats.views, log, needsAuth: false, error: null });
      await notify('ab-' + id, 'Test A/B terminé', `${(t.videoTitle || '').slice(0, 50)} : la variante ${variants[w].label} gagne.`);
      return;
    }
    const nextIdx = (t.currentIndex + 1) % variants.length;
    await MT.research.applyVariant(t.type, t.videoId, variants[nextIdx], auth);
    log.push({ t: now, msg: `Variante ${variants[nextIdx].label} activée (${cur.label} : +${cur.views} vues cumulées).` });
    await patchTest(id, {
      variants,
      currentIndex: nextIdx,
      lastSwitchAt: now,
      lastViews: stats.views,
      nextSwitchAt: now + t.intervalHours * HOUR,
      log: log.slice(-100),
      needsAuth: false,
      error: null,
    });
  }

  async function abTick() {
    const due = (await MT.store.list('abTests')).filter((t) => t.status === 'running' && t.nextSwitchAt <= Date.now());
    if (!due.length) return;
    let auth;
    try {
      auth = await MT.oauth.auth({ interactive: false });
    } catch (e) {
      for (const t of due) {
        if (!t.needsAuth) await notify('ab-auth-' + t.id, 'Test A/B en attente', 'Reconnectez votre compte Google dans MyTube SEO pour poursuivre le test.');
        await patchTest(t.id, { needsAuth: true });
      }
      return;
    }
    for (const t of due) {
      try {
        await advanceAbTest(t.id, auth);
      } catch (e) {
        await patchTest(t.id, (x) => ({ error: e.message, log: [...(x.log || []), { t: Date.now(), msg: 'Erreur : ' + e.message }].slice(-100), nextSwitchAt: Date.now() + HOUR }));
      }
    }
  }

  /* ------------------------------------------------ mises à jour programmées */

  async function scheduledTick() {
    const due = (await MT.store.list('scheduled')).filter((u) => u.status === 'pending' && u.at <= Date.now());
    if (!due.length) return;
    let auth;
    try {
      auth = await MT.oauth.auth({ interactive: false });
    } catch (e) {
      for (const u of due) {
        if (!u.needsAuth)
          await notify('sched-auth-' + u.id, 'Mise à jour programmée en attente', 'Reconnectez votre compte Google dans MyTube SEO pour appliquer les mises à jour.');
      }
      await MT.store.update('scheduled', (list) => {
        for (const u of list) if (due.some((d) => d.id === u.id)) u.needsAuth = true;
        return list;
      });
      return;
    }
    for (const u of due) {
      let status = 'done';
      let error = null;
      try {
        await MT.research.applyChanges(u.videoId, u.changes, auth);
      } catch (e) {
        status = 'error';
        error = e.message;
      }
      await MT.store.update('scheduled', (list) => {
        const x = list.find((y) => y.id === u.id);
        if (x) Object.assign(x, { status, error, doneAt: Date.now(), needsAuth: false });
        return list;
      });
      await notify(
        'sched-' + u.id,
        status === 'done' ? 'Mise à jour appliquée' : 'Échec de la mise à jour',
        `${(u.videoTitle || u.videoId).slice(0, 60)}${error ? ' — ' + error : ''}`
      );
    }
  }

  const JOBS = {
    'mt-rank': { period: 60, run: rankTick },
    'mt-competitors': { period: 120, run: competitorsTick },
    'mt-alerts': { period: 60, run: alertsTick },
    'mt-ab': { period: 15, run: abTick },
    'mt-scheduled': { period: 5, run: scheduledTick },
  };

  const running = new Set();
  async function run(name) {
    const job = JOBS[name];
    if (!job || running.has(name)) return;
    running.add(name);
    try {
      await job.run();
    } catch (e) {
      await MT.store.addJobLog({ job: name, message: 'Erreur : ' + e.message });
    } finally {
      running.delete(name);
    }
  }

  async function ensureAlarms() {
    const existing = new Set((await browser.alarms.getAll()).map((a) => a.name));
    for (const [name, job] of Object.entries(JOBS)) {
      if (!existing.has(name)) browser.alarms.create(name, { delayInMinutes: 1, periodInMinutes: job.period });
    }
  }

  MT.jobs = { JOBS, run, ensureAlarms, advanceAbTest, winnerIndex, notify };
})(typeof globalThis !== 'undefined' ? globalThis : this);
