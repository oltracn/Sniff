import { supabaseAdmin } from '../services/external/supabaseAdmin.js';

// getMusicsBySniff: 查询 sniff 下的 musics
export async function getMusicsBySniff(sniffId) {
  const { data, error } = await supabaseAdmin
    .from('musics')
    .select('*')
    .eq('sniff_id', sniffId);
  if (error) throw error;
  return data;
}
