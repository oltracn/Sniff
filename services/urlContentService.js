// services/urlContentService.js
// 你需要安装 jsdom 和 @mozilla/readability：npm install jsdom @mozilla/readability
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

/**
 * 从给定的 URL 获取页面内容并提取文本。
 * @param {string} url 要获取内容的 URL。
 * @returns {Promise<string>} 提取到的页面文本内容，或空字符串（如果失败）。
 */
async function fetchUrlContent(url) {
  try {
    // Node.js 18+ 内置了全局 fetch API，如果你的 Node.js 版本较低，可能需要安装 node-fetch
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Failed to fetch URL ${url}: HTTP Status ${response.status}`);
      return ''; // 返回空字符串而不是抛出错误
    }

    const htmlText = await response.text();

    // 使用 JSDOM 解析 HTML
    const dom = new JSDOM(htmlText, { url }); // 传递 url 以便 Readability 正常工作
    // 使用 Readability 提取正文
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    let pageText = article ? article.textContent : '';

    // 截取文本，避免内容过长
    // 5000 字符是一个示例值，你可以根据 Gemini AI 的输入限制和你的需求调整
    const truncatedText = pageText.slice(0, 5000);

    return truncatedText;

  } catch (error) {
    console.error(`Error fetching or parsing content from URL ${url}:`, error.message);
    return ''; // 发生错误时返回空字符串
  }
}

module.exports = { fetchUrlContent };