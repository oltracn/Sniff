// services/geminiService.js
// 确保你已经安装了 @google/generative-ai
// 如果没有，请运行：npm install @google/generative-ai
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 使用环境变量中的 API Key 初始化 Gemini 客户端
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 调用 Gemini AI 分析文本，提取音乐信息。
 * @param {string} text 需要分析的文本内容。
 * @returns {Promise<{title: string|null, artist: string|null, album: string|null}>} 分析结果。
 */
async function analyzeMusicInfo(text) {
  try {
    // 使用 gemini-2.5-flash 模型
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 设计一个清晰有效的 Prompt
    // 关键在于指导 Gemini 返回我们需要的 JSON 格式
    const prompt = `从以下文本中识别出歌曲标题(title)、艺术家(artist)和专辑(album)。
    以 JSON 格式返回，例如：{"title": "歌曲名", "artist": "艺术家名", "album": "专辑名"}。
    如果无法识别某个信息，则将其值设为 null。
    请只返回 JSON 对象，不要包含任何额外的文字或Markdown格式（如\`\`\`json）。

    文本内容：
    "${text}"`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let jsonString = response.text().trim();

    // 尝试去除可能的 Markdown 格式，因为 Gemini 有时会附带
    if (jsonString.startsWith('```json') && jsonString.endsWith('```')) {
        jsonString = jsonString.substring(7, jsonString.length - 3).trim();
    }

    console.log("Gemini Raw Response (processed):", jsonString);

    let parsedResult;
    try {
      // 尝试解析 JSON 字符串
      parsedResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON response, returning nulls:", jsonString, parseError);
      // 解析失败时，返回默认的空结构
      return { title: null, artist: null, album: null };
    }

    // 确保返回的结构符合预期，即使 Gemini 返回了额外的字段
    return {
      title: parsedResult.title || null,
      artist: parsedResult.artist || null,
      album: parsedResult.album || null
    };

  } catch (error) {
    console.error('Error calling Gemini AI:', error.message);
    // 发生任何错误时，返回空信息，以便上层逻辑可以继续处理
    return { title: null, artist: null, album: null };
  }
}

module.exports = { analyzeMusicInfo };