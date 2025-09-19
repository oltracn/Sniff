import * as sniffService from '../services/sniffService.js';

function isValidGuestId(id) {
  return typeof id === 'string' && id.length > 10 && id.indexOf('@') === -1;
}

export async function fetchHandler(req, res) {
  // 支持前端直接传 actor，也支持认证中间件补充
  const { actor, event = {}, items = [] } = req.body ?? {};
  const safeItems = Array.isArray(items) ? items : [];

  // 校验 actor
  if (!actor || !actor.type || !actor.id || (actor.type === 'guest' && !isValidGuestId(actor.id))) {
    return res.status(400).json({ error: 'invalid_actor' });
  }
  if (safeItems.length === 0) return res.status(400).json({ error: 'no_items' });

  try {
    const result = await sniffService.createSniff({ actor, event, items: safeItems });
    return res.json({ event: result.event, items: result.items });
  } catch (err) {
    console.error('guestController.fetchHandler error', err);
    return res.status(500).json({ error: err.message || 'insert_failed' });
  }
}

export async function claimHandler(req, res) {
  const userId = req.userId || null;
  const { guestId } = req.body ?? {};
  if (!userId) return res.status(401).json({ error: 'invalid_token' });
  if (!isValidGuestId(guestId)) return res.status(400).json({ error: 'invalid_guestId' });

  try {
    const result = await sniffService.claimGuestData(guestId, userId);
    return res.json({ events: result.events, items: result.items });
  } catch (err) {
    console.error('guestController.claimHandler error', err);
    return res.status(500).json({ error: err.message || 'claim_failed' });
  }
}
