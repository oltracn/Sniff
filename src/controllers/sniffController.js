import { createSniff, getSniffById, listSniffs } from '../services/sniffService.js';

export async function createSniffHandler(req, res) {
  try {
    const { actor, event, items } = req.body;
    const result = await createSniff({ actor, event, items });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function listSniffsHandler(req, res) {
  try {
    const { page = 1, pageSize = 20, ...filters } = req.query;
    const result = await listSniffs({ page, pageSize, filters });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getSniffHandler(req, res) {
  try {
    const { id } = req.params;
    const result = await getSniffById(id);
    if (!result) return res.status(404).json({ error: 'not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
