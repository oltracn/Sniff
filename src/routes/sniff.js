import express from 'express';
import * as sniffController from '../controllers/sniffController.js';

const router = express.Router();

// POST /api/sniffs
router.post('/', sniffController.createSniffHandler);

// GET /api/sniffs
router.get('/', sniffController.listSniffsHandler);

// GET /api/sniffs/:id
router.get('/:id', sniffController.getSniffHandler);

export default router;
