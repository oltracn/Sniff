import express from 'express';
import * as urlController from '../controllers/urlController.js';

const router = express.Router();

// POST /api/urls/parse
router.post('/parse', urlController.parseUrlHandler);

export default router;
