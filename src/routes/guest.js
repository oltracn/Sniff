import express from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import * as guestController from '../controllers/guestController.js';

const router = express.Router();

// Route mappings for guest-related operations (resource-oriented)
// POST /api/guest/fetch - accepts anonymous or authenticated (optionalAuth)
router.post('/fetch', optionalAuth(), guestController.fetchHandler);

// POST /api/guest/claim - requires authentication
router.post('/claim', requireAuth(), guestController.claimHandler);

export default router;
