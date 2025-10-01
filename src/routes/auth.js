import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// Step 1: client starts auth -> returns authorization URL to open in system browser
router.post('/start', authController.startAuthHandler);
// Step 2: Google redirects backend here (configured as redirect URI in Google console)
router.get('/google/callback', authController.googleCallbackHandler);
// Step 3: App receives deep link with one-time token (ott) then calls finish to get internal tokens
router.post('/finish', authController.finishAuthHandler);
// Optional: logout (revoke session)
router.post('/logout', authController.logoutHandler);
router.post('/refresh', authController.refreshHandler);

export default router;
