import { supabaseAdmin } from '../services/external/supabaseAdmin.js';
import { fetchUrlContent, extractMainText } from './external/fetcher.js';
import { analyzeMusicInfo } from './external/ai.js';
import { searchSpotifyTrack } from './external/spotify.js';

// 解析音乐信息的主函数
export async function parseMusicFromUrl(url) {
  if (!url) {
    throw new Error('缺少 url 参数');
  }

  try {
    // 1. 抓取网页正文
    const html = await fetchUrlContent(url);
    // 解析<title>
    let pageTitle = '';
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      pageTitle = titleMatch[1].trim();
    }
    const mainText = await extractMainText(html, url);

    // 2. AI 分析正文，提取音乐信息
    let musicInfoList = await analyzeMusicInfo(mainText);

    // 处理 Gemini 返回的字符串格式
    if (typeof musicInfoList === 'string') {
      const match = musicInfoList.match(/```json\s*([\s\S]*?)```/);
      if (match) {
        try {
          musicInfoList = JSON.parse(match[1]);
        } catch {
          musicInfoList = [];
        }
      } else {
        musicInfoList = [];
      }
    }

    // 3. 查询 Spotify，聚合结果（并发，限制最大25首）
    let results = [];
    if (Array.isArray(musicInfoList)) {
      const MAX_COUNT = 25;
      musicInfoList = musicInfoList.slice(0, MAX_COUNT);
      results = await Promise.all(
        musicInfoList.map(async (info) => {
          const spotify = await searchSpotifyTrack(info);
          return {
            ...info,
            spotify,
          };
        })
      );
    } else {
      results = [];
    }

    return { results, title: pageTitle, url };
  } catch (err) {
    throw new Error(err.message);
  }
}

// insertOrFindUrl: 插入或查找 URL，返回 urlId
export async function insertOrFindUrl(url, title = null) {
  // 先查找是否存在
  const { data: existing, error: findError } = await supabaseAdmin
    .from('urls')
    .select('id')
    .eq('url', url)
    .single();

  if (findError && findError.code !== 'PGRST116') { // PGRST116: not found
    throw findError;
  }

  if (existing) {
    return existing.id;
  }

  // 不存在则插入
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('urls')
    .insert({ url, title })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}
