import SpotifyWebApi from 'spotify-web-api-node';
import 'dotenv/config';

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let _accessToken = null;
let _tokenExpiresAt = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiresAt - 30 * 1000) {
    return _accessToken;
  }
  console.log('[spotify] requesting client credentials token...');
  const data = await spotifyApi.clientCredentialsGrant();
  const token = data.body.access_token;
  const expiresIn = data.body.expires_in || 3600;
  spotifyApi.setAccessToken(token);
  _accessToken = token;
  _tokenExpiresAt = Date.now() + expiresIn * 1000;
  console.log(`[spotify] got token, expires in ${expiresIn}s`);
  return _accessToken;
}

function normalizeText(s = '') {
  return String(s || '').trim().toLowerCase();
}

function buildQuery({ song, artist }) {
  // 按优先级：song+artist -> song
  const qParts = [];
  if (song && artist) {
    qParts.push(`track:"${String(song).trim()}"`);
    qParts.push(`artist:"${String(artist).trim()}"`);
  } else if (song) {
    qParts.push(`track:"${String(song).trim()}"`);
  } else if (artist) {
    qParts.push(`artist:"${String(artist).trim()}"`);
  }
  return qParts.join(' ');
}

function filterByAlbum(items = [], album) {
  if (!album) return items;
  const target = normalizeText(album);
  return items.filter((t) => {
    const name = normalizeText(t.album?.name || t.album?.title || '');
    return name === target || name.includes(target) || target.includes(name);
  });
}

export async function searchSpotifyTrack({ song, artist, album } = {}) {
  try {
    console.log('[spotify] searchSpotifyTrack input:', { song, artist, album });
    if (!song && !artist) {
      console.log('[spotify] missing song and artist -> abort');
      return null;
    }

    await getAccessToken();

    const query = buildQuery({ song, artist });
    if (!query) return null;

    console.log('[spotify] executing query:', query);
    const res = await spotifyApi.searchTracks(query, { limit: 10 });
    const total = res?.body?.tracks?.total;
    const items = res?.body?.tracks?.items || [];
    console.log(`[spotify] search returned total=${total}, items=${items.length}`);
    if (items.length === 0) {
      console.log('[spotify] no items returned');
      return null;
    }

    let candidates = items;

    // 如果结果超过1条且提供了 album，使用 album 过滤
    if (candidates.length > 1 && album) {
      const filtered = filterByAlbum(candidates, album);
      console.log(`[spotify] filtered by album '${album}': before=${candidates.length} after=${filtered.length}`);
      if (filtered.length > 0) candidates = filtered;
    }

    // 选择最优候选：优先 exact album match，再按第一个
    let track = null;
    if (album) {
      const exact = candidates.find((t) => normalizeText(t.album?.name) === normalizeText(album));
      if (exact) track = exact;
    }
    if (!track) track = candidates[0];

    console.log('[spotify] selected track:', (track && (track.name || track.id)) || null);

    if (!track) return null;

    const coverUrl = Array.isArray(track.album?.images) && track.album.images.length > 0
      ? track.album.images[0].url
      : null;
    const spotifyUrl = track.external_urls?.spotify || null;
    console.log('[spotify] coverUrl, spotifyUrl:', { coverUrl, spotifyUrl });

    return {
      song: track.name || song || null,
      artist: (track.artists || []).map((a) => a.name).join(', ') || artist || null,
      album: track.album?.name || album || null,
      coverUrl,
      durationMs: track.duration_ms || null,
      spotifyUrl,
      raw: track,
    };
  } catch (err) {
    console.error('spotify search error:', err?.stack || err);
    return null;
  }
}