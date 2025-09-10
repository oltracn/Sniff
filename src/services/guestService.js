import { supabaseAdmin } from '../services/external/supabaseAdmin.js';

// 插入或查找 guest，返回 guest_id
export async function insertOrFindGuest(guestId) {
  // 先查找是否存在
  const { data: existing, error: findError } = await supabaseAdmin
    .from('guests')
    .select('id')
    .eq('id', guestId)
    .single();

  if (existing) {
    return existing.id;
  }

  // 不存在则插入
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('guests')
    .insert({ id: guestId })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}
