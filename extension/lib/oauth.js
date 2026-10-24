/*
 * MyTube SEO — connexion Google (OAuth 2.0, flux implicite) via browser.identity.
 * L'utilisateur fournit son propre identifiant client OAuth (Google Cloud, type « Application Web »)
 * avec l'URI de redirection affichée dans les paramètres.
 */
(function (root) {
  'use strict';
  const MT = (root.MT = root.MT || {});

  const SCOPES = ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/yt-analytics.readonly'];

  class AuthError extends Error {}

  function redirectUri() {
    return browser.identity.getRedirectURL();
  }

  async function login({ interactive = true } = {}) {
    const settings = await MT.store.getSettings();
    const clientId = (settings.oauthClientId || '').trim();
    if (!clientId) throw new AuthError('Renseignez d’abord votre identifiant client OAuth Google dans les paramètres.');
    const state = MT.uid();
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'token',
      redirect_uri: redirectUri(),
      scope: SCOPES.join(' '),
      include_granted_scopes: 'true',
      state,
      prompt: interactive ? 'select_account consent' : 'none',
    });
    const previous = await MT.store.get('oauth', null);
    if (!interactive && previous && previous.email) params.set('login_hint', previous.email);
    let redirect;
    try {
      redirect = await browser.identity.launchWebAuthFlow({ url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params, interactive });
    } catch (e) {
      throw new AuthError(interactive ? 'Connexion Google annulée ou refusée.' : 'Session Google expirée : reconnectez-vous dans les paramètres.');
    }
    const frag = new URLSearchParams(new URL(redirect).hash.slice(1));
    if (frag.get('error')) throw new AuthError('Google a refusé la connexion : ' + frag.get('error'));
    if (frag.get('state') !== state) throw new AuthError('Réponse OAuth invalide.');
    const token = {
      accessToken: frag.get('access_token'),
      expiresAt: Date.now() + (Number(frag.get('expires_in')) || 3600) * 1000 - 60000,
      scope: frag.get('scope') || SCOPES.join(' '),
      obtainedAt: Date.now(),
      channel: previous ? previous.channel : null,
      email: previous ? previous.email : null,
    };
    await MT.store.set('oauth', token);
    try {
      const ch = await MT.ytapi.myChannel({ token: token.accessToken });
      token.channel = { channelId: ch.channelId, title: ch.title, avatar: ch.avatar, subscribers: ch.subscribers };
      await MT.store.set('oauth', token);
      const s = await MT.store.getSettings();
      if (!s.myChannelId) await MT.store.setSettings({ myChannelId: ch.channelId, myChannelTitle: ch.title });
    } catch (e) {
      /* la chaîne sera récupérée plus tard */
    }
    return token;
  }

  /** Jeton d'accès valide (rafraîchissement silencieux si possible). */
  async function getToken({ interactive = false } = {}) {
    const t = await MT.store.get('oauth', null);
    if (t && t.accessToken && t.expiresAt > Date.now()) return t.accessToken;
    if (!t || !t.accessToken) {
      if (!interactive) throw new AuthError('Connectez votre compte YouTube (Paramètres > Connexion Google) pour utiliser cette fonction.');
      return (await login({ interactive: true })).accessToken;
    }
    try {
      return (await login({ interactive: false })).accessToken;
    } catch (e) {
      if (interactive) return (await login({ interactive: true })).accessToken;
      throw new AuthError('Session Google expirée : reconnectez-vous dans les paramètres.');
    }
  }

  async function auth(opts) {
    return { token: await getToken(opts) };
  }

  async function logout() {
    const t = await MT.store.get('oauth', null);
    if (t && t.accessToken) {
      try {
        await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t.accessToken), { method: 'POST', credentials: 'omit' });
      } catch (e) {
        /* révocation best-effort */
      }
    }
    await browser.storage.local.remove('oauth');
  }

  async function status() {
    const t = await MT.store.get('oauth', null);
    return {
      connected: !!(t && t.accessToken),
      valid: !!(t && t.accessToken && t.expiresAt > Date.now()),
      expiresAt: t ? t.expiresAt : null,
      channel: t ? t.channel : null,
      redirectUri: redirectUri(),
    };
  }

  MT.oauth = { SCOPES, AuthError, redirectUri, login, getToken, auth, logout, status };
})(typeof globalThis !== 'undefined' ? globalThis : this);
