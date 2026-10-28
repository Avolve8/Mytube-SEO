/*
 * MyTube SEO — raccourcis clavier sur YouTube (désactivés pendant la saisie).
 * Alt+Maj+T : copier les tags · Alt+Maj+V : Videolytics complet · Alt+Maj+E : modifier dans Studio
 * Alt+Maj+C : capturer l'image · Alt+Maj+P : afficher/masquer les panneaux
 * Doit être chargé en dernier : il démarre le routeur des scripts de contenu.
 */
(function () {
  'use strict';
  const MT = globalThis.MT;
  const W = MT.widgets;
  const P = MT.page;

  function typing(e) {
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  async function copyTags() {
    const id = MT.watch.currentVideoId();
    if (!id) return;
    let tags = null;
    const pr = P.playerResponse(id);
    if (pr) tags = MT.yt.parsePlayer(pr).tags;
    if (!tags || !tags.length) tags = await P.yt('getVideoTags', id).catch(() => []);
    if (!tags.length) return W.toast('Aucun tag sur cette vidéo', 'error');
    const ok = await MT.copy(tags.join(', '));
    W.toast(ok ? `${tags.length} tags copiés` : 'Copie impossible', ok ? 'success' : 'error');
  }

  function togglePanels() {
    const hosts = document.querySelectorAll('mytube-seo-panel');
    const hide = [...hosts].some((h) => h.style.display !== 'none');
    hosts.forEach((h) => (h.style.display = hide ? 'none' : ''));
    W.toast(hide ? 'Panneaux MyTube SEO masqués (Alt+Maj+P pour réafficher)' : 'Panneaux affichés');
  }

  let shortcutsOn = true;
  P.getSettings().then((s) => (shortcutsOn = s.panels.shortcuts !== false));
  MT.store.onChange('settings', (k, v) => (shortcutsOn = !v || !v.panels || v.panels.shortcuts !== false));

  document.addEventListener(
    'keydown',
    (e) => {
      if (!shortcutsOn || !e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || typing(e)) return;
      const key = e.key.toLowerCase();
      const id = MT.watch.currentVideoId();
      const onVideo = !!id && (location.pathname === '/watch' || location.pathname.startsWith('/shorts/'));
      if (key === 't' && onVideo) copyTags();
      else if (key === 'v' && onVideo) MT.openApp('videolytics?v=' + id);
      else if (key === 'e' && onVideo) window.open(`https://studio.youtube.com/video/${id}/edit`, '_blank');
      else if (key === 'c' && onVideo) MT.watch.captureFrame(id, document.title.replace(/ - YouTube$/, ''));
      else if (key === 'p') togglePanels();
      else return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  P.start();
})();
