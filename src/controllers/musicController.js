export async function getMusicsHandler(req, res) {
  const { sniffId } = req.params;
  try {
    const musics = await getMusicsBySniff(sniffId);
    res.json({ musics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
