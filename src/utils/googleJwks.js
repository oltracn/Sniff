import axios from 'axios';

let cache = { keys: null, fetchedAt: 0 };
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export async function getGoogleJwksKey(kid) {
  const now = Date.now();
  if (!cache.keys || now - cache.fetchedAt > 5 * 60 * 1000) {
    const resp = await axios.get(JWKS_URL);
    cache = { keys: resp.data.keys, fetchedAt: now };
  }
  const key = cache.keys.find(k => k.kid === kid);
  if (!key) throw new Error('jwks_key_not_found');
  return key; // return JWK, jose will import
}
