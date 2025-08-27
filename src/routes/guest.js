import express from 'express';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin } from '../services/supabaseAdmin.js';

const router = express.Router();

// 限制 body 大小，拒绝超大请求
router.use(express.json({ limit: '64kb' }));

// 简单速率限制：防止滥用（局部防刷）
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
});

router.use(limiter);

function isValidGuestId(id) {
  return typeof id === 'string' && id.length > 10 && id.indexOf('@') === -1;
}

// POST /api/guest/fetch
// body: { guestId, event: { url, title, fetched_at, meta }, items: [ { song, artist, album, cover_url, spotify_url, meta } ] }
router.post('/fetch', async (req, res) => {
  const { guestId, event = {}, items = [] } = req.body || {};
  if (!isValidGuestId(guestId)) return res.status(400).json({ error: 'invalid_guestId' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'no_items' });

  try {
    // 插入 fetch_events
    const ev = {
      guest_id: guestId,
      url: event.url || null,
      title: event.title || null,
      fetched_at: event.fetched_at || new Date().toISOString(),
      meta: event.meta || null,
    };

    const { data: insertedEvents, error: evError } = await supabaseAdmin.from('fetch_events').insert(ev).select();
    if (evError) throw evError;
    const insertedEvent = Array.isArray(insertedEvents) ? insertedEvents[0] : insertedEvents;

    // 构建 items 并插入 music_items
    const mapped = items.map((it) => ({
      fetch_id: insertedEvent.id,
      guest_id: guestId,
      song: it.song || null,
      artist: it.artist || null,
      album: it.album || null,
      cover_url: it.cover_url || it.coverUrl || (it.spotify && (it.spotify.coverUrl || it.spotify.cover_url)) || null,
      spotify_url:
        it.spotify_url || it.spotifyUrl || (it.spotify && (it.spotify.url || it.spotify.spotifyUrl)) || null,
      meta: it.meta || null,
    }));

    const { data: insertedItems, error: itemsError } = await supabaseAdmin.from('music_items').insert(mapped).select();
    if (itemsError) {
      // 如果 items 插入失败，尝试回滚已插入的 event
      try {
        await supabaseAdmin.from('fetch_events').delete().eq('id', insertedEvent.id);
      } catch (e) {
        console.error('failed to rollback event after items insert error', e);
      }
      throw itemsError;
    }

    return res.json({ event: insertedEvent, items: insertedItems });
  } catch (err) {
    console.error('guest.post /fetch error', err);
    return res.status(500).json({ error: err.message || 'insert_failed' });
  }
});

// GET /api/guest/fetches?guestId=...
// 返回 { events: [ { id, guest_id, url, title, fetched_at, meta, music_items: [...] }, ... ] }
router.get('/fetches', async (req, res) => {
  const guestId = String(req.query.guestId || req.query.guest || '');
  const fetchId = String(req.query.fetchId || req.query.id || '');

  // If fetchId provided, return only that event (no guestId validation required for service role usage)
  if (fetchId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('fetch_events')
        .select('*, music_items(*)')
        .eq('id', fetchId)
        .limit(1);
      if (error) throw error;
      return res.json({ events: data || [] });
    } catch (err) {
      console.error('guest.get /fetches by id error', err);
      return res.status(500).json({ error: err.message || 'query_failed' });
    }
  }

  if (!isValidGuestId(guestId)) return res.status(400).json({ error: 'invalid_guestId' });

  try {
    const { data, error } = await supabaseAdmin
      .from('fetch_events')
      .select('*, music_items(*)')
      .eq('guest_id', guestId)
      .order('fetched_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return res.json({ events: data || [] });
  } catch (err) {
    console.error('guest.get /fetches error', err);
    return res.status(500).json({ error: err.message || 'query_failed' });
  }
});

// POST /api/guest/claim
// 将 guest 归属于已经登录的 user（通过 token），同时把两个表中对应的 guest_id 清空并设置 user_id
router.post('/claim', async (req, res) => {
  const { token, guestId } = req.body || {};
  if (!token) return res.status(400).json({ error: 'missing_token' });
  if (!isValidGuestId(guestId)) return res.status(400).json({ error: 'invalid_guestId' });

  try {
    const user = await supabaseAdmin.auth.getUser(token);
    if (!user || !user.data || !user.data.user) return res.status(403).json({ error: 'invalid_token' });
    const userId = user.data.user.id;

    // 更新 fetch_events
    const { data: evData, error: evErr } = await supabaseAdmin
      .from('fetch_events')
      .update({ user_id: userId, guest_id: null })
      .eq('guest_id', guestId)
      .is('user_id', null);
    if (evErr) throw evErr;

    // 更新 music_items
    const { data: miData, error: miErr } = await supabaseAdmin
      .from('music_items')
      .update({ user_id: userId, guest_id: null })
      .eq('guest_id', guestId)
      .is('user_id', null);
    if (miErr) throw miErr;

    return res.json({ events: evData, items: miData });
  } catch (err) {
    console.error('guest.post /claim error', err);
    return res.status(500).json({ error: err.message || 'claim_failed' });
  }
});

export default router;
