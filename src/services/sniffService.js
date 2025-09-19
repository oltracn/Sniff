import { supabaseAdmin } from '../services/external/supabaseAdmin.js';
import { insertOrFindUrl } from './urlService.js';
import { insertOrFindGuest } from './guestService.js';

// 策略对象：定义处理不同 actor 的函数
const actorStrategies = {
  user: async (actorId) => ({ user_id: actorId }),
  guest: async (actorId) => {
    const guestId = await insertOrFindGuest(actorId);
    return { guest_id: guestId };
  },
};

// createSniff: 插入 sniffs 与对应的 musics
// 参数说明：{ actor, event, items }
//  - actor: null | { type: 'user'|'guest', id: string }
//  - event: { url?, title?, fetched_at?, meta? }
//  - items: Array< { song?, artist?, album?, cover_url?, spotify_url?, meta? } >
export async function createSniff({ actor, event, items }) {
  // 使用策略对象解析 actor 字段
  let actorField = {};
  if (actor) {
    const strategy = actorStrategies[actor.type];
    if (strategy) {
      actorField = await strategy(actor.id);
    }
  }

  // 处理 URL：插入或查找 urls 表
  const urlId = event?.url ? await insertOrFindUrl(event.url, event.title) : null;

  const ev = {
    url_id: urlId,
    title: event?.title || null,
    fetched_at: event?.fetched_at || new Date().toISOString(),
    meta: event?.meta || null,
    ...actorField,
  };

  const { data: insertedEvents, error: evError } = await supabaseAdmin.from('sniffs').insert(ev).select();
  if (evError) throw evError;
  const insertedEvent = Array.isArray(insertedEvents) ? insertedEvents[0] : insertedEvents;

  const mapped = (items || []).map((it) => ({
    sniff_id: insertedEvent.id,
    ...actorField,
    song: it?.song || null,
    artist: it?.artist || null,
    album: it?.album || null,
    cover_url:
      it?.cover_url || it?.coverUrl || (it?.spotify && (it.spotify.coverUrl || it.spotify.cover_url)) || null,
    spotify_url:
      it?.spotify_url || it?.spotifyUrl || (it?.spotify && (it.spotify.url || it.spotify.spotifyUrl)) || null,
    meta: it?.meta || null,
  }));

  const { data: insertedItems, error: itemsError } = await supabaseAdmin.from('musics').insert(mapped).select();
  if (itemsError) {
    // 尝试回滚 event，若回滚失败则记录错误但继续抛出原始错误
    try {
      await supabaseAdmin.from('sniffs').delete().eq('id', insertedEvent.id);
    } catch (e) {
      console.error('failed to rollback event after items insert error', e);
    }
    throw itemsError;
  }

  return { event: insertedEvent, items: insertedItems };
}

// claimGuestData: 将 guestId 关联的数据转到指定 userId（释放 guest_id）
export async function claimGuestData(guestId, userId) {
  // 更新 sniffs
  const { data: evData, error: evErr } = await supabaseAdmin
    .from('sniffs')
    .update({ user_id: userId, guest_id: null })
    .eq('guest_id', guestId)
    .is('user_id', null);
  if (evErr) throw evErr;

  // 更新 musics
  const { data: miData, error: miErr } = await supabaseAdmin
    .from('musics')
    .update({ user_id: userId, guest_id: null })
    .eq('guest_id', guestId)
    .is('user_id', null);
  if (miErr) throw miErr;

  return { events: evData, items: miData };
}

// getSniffById: 查询单条 sniff 记录详情
export async function getSniffById(id) {
  const { data, error } = await supabaseAdmin
    .from('sniffs')
    .select('*, urls(url, title), musics(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// listSniffs: 查询多条 sniff 记录
// 支持 actor 方案，统一身份过滤
export async function listSniffs({ page = 1, pageSize = 20, actor = null, filters = {} }) {
  const offset = (page - 1) * pageSize;
  let query = supabaseAdmin
    .from('sniffs')
    .select('*, urls(url, title), musics(*)')
    .range(offset, offset + pageSize - 1);

  // 优先用 actor 过滤
  if (actor && actor.type && actor.id) {
    if (actor.type === 'user') query = query.eq('user_id', actor.id);
    if (actor.type === 'guest') query = query.eq('guest_id', actor.id);
  } else {
    // 兼容旧 filters
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.guestId) query = query.eq('guest_id', filters.guestId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}