const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/password-reset/request — send reset code to email
router.post('/request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await db('users').where({ email, is_active: true }).first();
    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: 'If the email exists, a reset code has been sent.' });

    const code = generateCode();
    const token = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db('password_resets').insert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });

    await sendPasswordResetEmail(user.email, code);

    res.json({ message: 'If the email exists, a reset code has been sent.' });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/password-reset/verify — verify code and set new password
router.post('/verify', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const user = await db('users').where({ email, is_active: true }).first();
    if (!user) return res.status(400).json({ error: 'Invalid or expired code.' });

    const token = crypto.createHash('sha256').update(code).digest('hex');
    const reset = await db('password_resets')
      .where({ user_id: user.id, token, used: false })
      .where('expires_at', '>', new Date())
      .first();

    if (!reset) return res.status(400).json({ error: 'Invalid or expired code.' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: user.id }).update({ password_hash: passwordHash });
    await db('password_resets').where({ id: reset.id }).update({ used: true });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password reset verify error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/password-reset/change — authenticated user changes own password
router.post('/change', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const user = await db('users').where({ id: req.user.id }).first();
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: req.user.id }).update({ password_hash: passwordHash });

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
