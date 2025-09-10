import express from 'express';
import * as musicController from '../controllers/musicController.js';

const router = express.Router();

// GET /api/music/:sniffId
router.get('/:sniffId', musicController.getMusicsHandler);

export default router;
