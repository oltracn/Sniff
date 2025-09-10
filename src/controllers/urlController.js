import { parseMusicFromUrl } from '../services/urlService.js';

export async function parseUrlHandler(req, res) {
  const { url } = req.body;
  try {
    const result = await parseMusicFromUrl(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
