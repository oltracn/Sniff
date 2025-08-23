import SpotifyWebApi from 'spotify-web-api-node';
import 'dotenv/config';

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function getAccessToken() {
  const data = await spotifyApi.clientCredentialsGrant();
  spotifyApi.setAccessToken(data.body.access_token);
}


// 搜索单首歌曲
export async function searchSpotifyTrack({ song, artist, album }) {
  await getAccessToken();
  let query = song || '';
  if (artist) query += ` artist:${artist}`;
  // 不在 query 里加 album，后面用 album 过滤
  const result = await spotifyApi.searchTracks(query, { limit: 10 });
  const items = result.body.tracks.items;
  if (!items || items.length === 0) return null;

  let track = null;
  if (album) {
    // 尝试用 album 精确过滤
    track = items.find(t => t.album && t.album.name && t.album.name.toLowerCase() === album.toLowerCase());
  }
  if (!track) {
    // 没有 album 或没找到完全匹配的，取第一首
    track = items[0];
  }
  return {
    song: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: track.album.name,
    coverUrl: track.album.images[0]?.url,
    durationMs: track.duration_ms,
    spotifyUrl: track.external_urls.spotify,
  };
}