import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// GET /api/users/profile
router.get('/profile', requireAuth(), userController.getUserProfileHandler);

// PUT /api/users/profile
router.put('/profile', requireAuth(), userController.updateUserProfileHandler);

export default router;
