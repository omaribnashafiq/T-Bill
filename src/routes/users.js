const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — admin lists all users
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, is_active, search } = req.query;

    let query = db('users').select('id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at').orderBy('created_at', 'desc');

    if (role) query = query.where('role', role);
    if (is_active !== undefined) query = query.where('is_active', is_active === 'true');
    if (search) {
      query = query.where(function () {
        this.where('name', 'like', `%${search}%`)
          .orWhere('email', 'like', `%${search}%`)
          .orWhere('phone', 'like', `%${search}%`);
      });
    }

    const users = await query;
    res.json({ users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/users/:id — admin gets user detail
router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await db('users')
      .where({ id: req.params.id })
      .select('id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at')
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Get user's expense stats
    const [expenseStats] = await db('expenses')
      .where({ created_by: user.id })
      .select(
        db.raw('COUNT(*) as total_expenses'),
        db.raw("SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount"),
        db.raw("SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount"),
        db.raw("SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END) as rejected_amount")
      );

    res.json({ user, stats: expenseStats });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/users — admin creates user
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (role && !['employee', 'accounts_head', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [user] = await db('users')
      .insert({ name, email, phone, password_hash, role: role || 'employee' })
      .returning(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at']);

    res.status(201).json({ user });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/users/:id — admin updates user
router.patch('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { name, email, phone, role } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone || null;
    if (role) {
      if (!['employee', 'accounts_head', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
      }
      updates.role = role;
    }

    if (email && email !== user.email) {
      const existing = await db('users').where({ email }).whereNot({ id: req.params.id }).first();
      if (existing) {
        return res.status(409).json({ error: 'Email already in use.' });
      }
      updates.email = email;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    const [updated] = await db('users')
      .where({ id: req.params.id })
      .update(updates)
      .returning(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at']);

    res.json({ user: updated });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/users/:id/toggle — admin activate/deactivate
router.patch('/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Prevent deactivating yourself
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account.' });
    }

    const [updated] = await db('users')
      .where({ id: req.params.id })
      .update({ is_active: !user.is_active })
      .returning(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at']);

    res.json({ user: updated });
  } catch (err) {
    console.error('Toggle user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/users/:id — admin deletes user
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    }

    await db('users').where({ id: req.params.id }).del();
    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/users/profile — any user updates own profile
router.patch('/profile/edit', authenticate, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    const [updated] = await db('users')
      .where({ id: req.user.id })
      .update(updates)
      .returning(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at']);

    res.json({ user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/users/password — any user changes own password
router.patch('/password/change', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await db('users').where({ id: req.user.id }).first();
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await db('users').where({ id: req.user.id }).update({ password_hash });

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/users/:id/reset-password — admin resets user password
router.patch('/:id/reset-password', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await db('users').where({ id: req.params.id }).update({ password_hash });

    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
