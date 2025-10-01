import { startAuth, handleGoogleCallback, finishAuth, logoutSession, refreshInternal } from '../services/authService.js';

export async function startAuthHandler(req, res) {
  try {
    const { device_id } = req.body || {};
    const result = await startAuth({ deviceId: device_id });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function googleCallbackHandler(req, res) {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('missing code/state');
    const redirectDeepLink = await handleGoogleCallback({ code: String(code), state: String(state) });
    // 302 to app deep link (user must have app installed). If not installed, show fallback HTML.
    res.redirect(302, redirectDeepLink);
  } catch (e) {
    console.error('googleCallback error', e);
    res.status(500).send('auth failed');
  }
}

export async function finishAuthHandler(req, res) {
  try {
    const { ott } = req.body || {};
    if (!ott) return res.status(400).json({ error: 'missing_ott' });
  const result = await finishAuth({ ott });
  res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function logoutHandler(req, res) {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: 'missing_refresh_token' });
    await logoutSession({ refreshToken });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function refreshHandler(req, res) {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: 'missing_refresh_token' });
    const data = await refreshInternal({ refreshToken });
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}
