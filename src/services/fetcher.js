import axios from 'axios';
import { load } from 'cheerio';

export async function fetchUrlContent(url) {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': url,
      // 'Cookie': '如有需要可手动添加'
    }
  });
  return response.data;
}

// 提取网页正文内容
// 主入口：根据url分发到不同站点适配器
export async function extractMainText(html, url = '') {
  if (isNeteaseDjProgram(url)) {
    return await extractNeteaseDjProgram(url);
  }
  if (isApplePodcast(url)) {
    return extractApplePodcast(html);
  }
  if (isXiaoyuzhou(url)) {
    return extractXiaoyuzhou(html);
  }
  return extractGeneric(html);
}
// 网易云音乐节目页适配器
async function extractNeteaseDjProgram(url) {
  // 支持 /#/program?id=xxx 或 /m/program?id=xxx
  const match = url.match(/[\/#]program\?id=(\d+)/);
  if (!match) return '';
  const id = match[1];
  const apiUrl = `https://music.163.com/api/dj/program/detail?id=${id}`;
  try {
    const resp = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': url,
      },
      timeout: 8000,
    });
    const desc = resp.data?.program?.description;
    return desc ? desc.trim() : '';
  } catch (e) {
    return '';
  }
}

function isNeteaseDjProgram(url) {
  return /music\.163\.com\/(#|m)\/program\?id=\d+/.test(url);
}

// Apple Podcasts 适配器
function extractApplePodcast(html) {
  const $ = load(html);
  // 1. JSON-LD description
  let jsonldDesc = '';
  const jsonldScripts = $('script[type="application/ld+json"]');
  jsonldScripts.each((i, el) => {
    try {
      const json = JSON.parse($(el).html());
      if (json && typeof json === 'object') {
        if (Array.isArray(json)) {
          for (const item of json) {
            if (item['@type'] && (item['@type'] === 'PodcastEpisode' || item['@type'] === 'PodcastSeries')) {
              if (item.description) {
                jsonldDesc = item.description;
                break;
              }
            }
          }
        } else {
          if (json['@type'] && (json['@type'] === 'PodcastEpisode' || json['@type'] === 'PodcastSeries')) {
            if (json.description) {
              jsonldDesc = json.description;
            }
          }
        }
      }
    } catch (e) {}
  });
  if (jsonldDesc) {
    return jsonldDesc.trim();
  }
  // 2. paragraph-wrapper 下所有 <p>
  let paraText = '';
  const paraDiv = $('.paragraph-wrapper');
  if (paraDiv.length > 0) {
    paraText = paraDiv.find('p').map((i, el) => $(el).text()).get().join('\n');
    paraText = paraText.replace(/\n{2,}/g, '\n').trim();
    if (paraText) return paraText;
  }
  // 3. meta 标签
  let metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
  if (metaDesc) return metaDesc.trim();
  // fallback
  return extractGeneric(html);
}

// 小宇宙FM 适配器
function extractXiaoyuzhou(html) {
  const $ = load(html);
  // 小宇宙FM节目正文一般在 .episode__shownotes
  const showNotes = $('.episode__shownotes');
  if (showNotes.length) {
    return showNotes.text().trim();
  }
  // fallback
  return extractGeneric(html);
}

// 通用提取逻辑
function extractGeneric(html) {
  const $ = load(html);
  // 常见正文选择器
  const selectors = [
    'article',
    '.article-content',
    '.post-content',
    '.content',
    '#content',
    '.main-content',
    '.episode__shownotes',
  ];
  for (const selector of selectors) {
    const el = $(selector);
    if (el.length) {
      return el.text().trim();
    }
  }
  // fallback: body 所有 <p>
  let text = $('body p').map((i, el) => $(el).text()).get().join('\n');
  text = text.replace(/\n{2,}/g, '\n').trim();
  if (text) return text;
  // fallback: 整个 body
  return $('body').text().trim();
}

// 站点识别
function isApplePodcast(url) {
  return /podcasts\.apple\.com\//i.test(url);
}
function isXiaoyuzhou(url) {
  return /xiaoyuzhoufm\.com\//i.test(url);
}
