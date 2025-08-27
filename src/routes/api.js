import express from 'express';
import { fetchUrlContent, extractMainText } from '../services/fetcher.js';
import { analyzeMusicInfo } from '../services/ai.js';
import { searchSpotifyTrack } from '../services/spotify.js';
import guestRouter from './guest.js';

const router = express.Router();

// POST /api/parse-music
router.post('/parse-music', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: '缺少 url 参数' });
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

  res.json({ results, title: pageTitle, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

// mount guest routes
router.use('/guest', guestRouter);
