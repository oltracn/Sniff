import { getUserProfile, updateUserProfile } from '../services/userService.js';

export async function getUserProfileHandler(req, res) {
  try {
    const userId = req.userId;
    const profile = await getUserProfile(userId);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateUserProfileHandler(req, res) {
  try {
    const userId = req.userId;
    const updates = req.body;
    const profile = await updateUserProfile(userId, updates);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
