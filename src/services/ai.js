import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-flash';

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * 调用 Gemini API，分析正文内容，提取音乐信息
 * @param {string} text - 网页正文内容
 * @returns {Promise<Array|String>} - [{song, artist, album}] 或原始内容
 */
export async function analyzeMusicInfo(text) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API Key 未配置');
  const prompt = `请从以下文本中提取所有出现的音乐信息，尽量输出完整的 歌曲名、歌手、专辑（如有），以JSON数组返回，每项格式为：{"song": "歌曲名", "artist": "歌手", "album": "专辑"}。如信息不全可留空。例如：[{"song": "Shape of You", "artist": "Ed Sheeran", "album": "Divide"}]

文本：\n${text}`;

  try {
    const result = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    // 新版SDK获取内容
    const parts = result.candidates?.[0]?.content?.parts;
    if (!parts || !parts.length) {
      throw new Error('Gemini API 返回内容为空');
    }
    const content = parts.map(p => p.text).join('\n');

    try {
      const json = JSON.parse(content);
      return json;
    } catch {
      return content;
    }
  } catch (err) {
    throw new Error('Gemini API 调用失败: ' + (err.message || err));
  }
}
