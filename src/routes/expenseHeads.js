const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/expense-heads — list all (active by default)
router.get('/', authenticate, async (req, res) => {
  try {
    const { include_inactive } = req.query;

    let query = db('expense_heads').orderBy('id', 'asc');
    if (!include_inactive) {
      query = query.where('is_active', true);
    }

    const heads = await query;

    // Build tree: major heads → subheads
    const major = heads.filter((h) => !h.parent_id);
    const subMap = {};
    heads.forEach((h) => {
      if (h.parent_id) {
        (subMap[h.parent_id] = subMap[h.parent_id] || []).push(h);
      }
    });

    const tree = major.map((h) => ({
      ...h,
      subheads: subMap[h.id] || [],
    }));

    res.json({ expense_heads: tree });
  } catch (err) {
    console.error('List expense heads error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/expense-heads/flat — flat list (for dropdowns)
router.get('/flat', authenticate, async (req, res) => {
  try {
    const heads = await db('expense_heads')
      .where('is_active', true)
      .orderBy('id', 'asc');

    res.json({ expense_heads: heads });
  } catch (err) {
    console.error('Flat expense heads error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/expense-heads/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const head = await db('expense_heads').where({ id: req.params.id }).first();
    if (!head) {
      return res.status(404).json({ error: 'Expense head not found.' });
    }

    const subheads = await db('expense_heads')
      .where({ parent_id: head.id, is_active: true })
      .orderBy('id', 'asc');

    res.json({ expense_head: { ...head, subheads } });
  } catch (err) {
    console.error('Get expense head error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/expense-heads — admin creates a major head
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const existing = await db('expense_heads').where({ name: name.trim() }).first();
    if (existing) {
      return res.status(409).json({ error: 'An expense head with this name already exists.' });
    }

    const [head] = await db('expense_heads')
      .insert({ name: name.trim() })
      .returning('*');

    res.status(201).json({ expense_head: head });
  } catch (err) {
    console.error('Create expense head error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/expense-heads/:id/subheads — admin adds a subhead
router.post('/:id/subheads', authenticate, authorize('admin'), async (req, res) => {
  try {
    const parent = await db('expense_heads').where({ id: req.params.id, is_active: true }).first();
    if (!parent) {
      return res.status(404).json({ error: 'Parent expense head not found.' });
    }
    if (parent.parent_id) {
      return res.status(400).json({ error: 'Cannot add subheads to a subhead.' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const existing = await db('expense_heads').where({ name: name.trim(), parent_id: parent.id }).first();
    if (existing) {
      return res.status(409).json({ error: 'A subhead with this name already exists under this head.' });
    }

    const [subhead] = await db('expense_heads')
      .insert({ name: name.trim(), parent_id: parent.id })
      .returning('*');

    res.status(201).json({ expense_head: subhead });
  } catch (err) {
    console.error('Create subhead error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/expense-heads/:id — admin renames
router.patch('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const head = await db('expense_heads').where({ id: req.params.id }).first();
    if (!head) {
      return res.status(404).json({ error: 'Expense head not found.' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const duplicate = await db('expense_heads')
      .where({ name: name.trim() })
      .whereNot({ id: req.params.id })
      .first();
    if (duplicate) {
      return res.status(409).json({ error: 'Another expense head with this name already exists.' });
    }

    const [updated] = await db('expense_heads')
      .where({ id: req.params.id })
      .update({ name: name.trim() })
      .returning('*');

    res.json({ expense_head: updated });
  } catch (err) {
    console.error('Update expense head error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/expense-heads/:id/toggle — admin activate/deactivate
router.patch('/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
  try {
    const head = await db('expense_heads').where({ id: req.params.id }).first();
    if (!head) {
      return res.status(404).json({ error: 'Expense head not found.' });
    }

    // If deactivating a major head, deactivate its subheads too
    const newStatus = !head.is_active;
    if (!head.parent_id && !newStatus) {
      await db('expense_heads').where({ parent_id: head.id }).update({ is_active: false });
    }

    const [updated] = await db('expense_heads')
      .where({ id: req.params.id })
      .update({ is_active: newStatus })
      .returning('*');

    res.json({ expense_head: updated });
  } catch (err) {
    console.error('Toggle expense head error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
