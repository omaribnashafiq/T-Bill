const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// POST /api/settlements — employee submits daily settlement
router.post('/', authenticate, authorize('employee', 'admin'), upload.single('bank_screenshot'), async (req, res) => {
  try {
    const { date, total_expenses, total_unspent, bank_deposit_amount } = req.body;

    if (!date || total_expenses == null || total_unspent == null || bank_deposit_amount == null) {
      return res.status(400).json({ error: 'Date, total_expenses, total_unspent, and bank_deposit_amount are required.' });
    }

    // One settlement per employee per day
    const existing = await db('daily_settlements')
      .where({ date, employee_id: req.user.id })
      .first();
    if (existing) {
      return res.status(409).json({ error: 'A settlement for this date already exists.' });
    }

    const bank_screenshot_url = req.file ? `/uploads/${req.file.filename}` : null;

    const [settlement] = await db('daily_settlements')
      .insert({
        date,
        employee_id: req.user.id,
        total_expenses,
        total_unspent,
        bank_deposit_amount,
        bank_screenshot_url,
        status: 'pending',
      })
      .returning('*');

    res.status(201).json({ settlement });
  } catch (err) {
    console.error('Create settlement error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/settlements — list settlements
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, employee_id, from, to, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('daily_settlements')
      .leftJoin('users as emp', 'daily_settlements.employee_id', 'emp.id')
      .leftJoin('users as approver', 'daily_settlements.approved_by', 'approver.id')
      .select(
        'daily_settlements.*',
        'emp.name as employee_name',
        'approver.name as approved_by_name'
      )
      .orderBy('daily_settlements.date', 'desc');

    // Role-based filtering
    if (req.user.role === 'employee') {
      query = query.where('daily_settlements.employee_id', req.user.id);
    } else if (req.user.role === 'accounts_head') {
      query = query.where(function () {
        this.where('daily_settlements.status', 'pending').orWhere('daily_settlements.employee_id', req.user.id);
      });
    }
    // admin sees everything

    if (status) query = query.where('daily_settlements.status', status);
    if (employee_id) query = query.where('daily_settlements.employee_id', employee_id);
    if (from) query = query.where('daily_settlements.date', '>=', from);
    if (to) query = query.where('daily_settlements.date', '<=', to);

    const [{ count: total }] = await query.clone().count('* as count');
    const settlements = await query.offset(offset).limit(limit);

    res.json({ settlements, total: Number(total), page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List settlements error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/settlements/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const settlement = await db('daily_settlements')
      .leftJoin('users as emp', 'daily_settlements.employee_id', 'emp.id')
      .leftJoin('users as approver', 'daily_settlements.approved_by', 'approver.id')
      .where('daily_settlements.id', req.params.id)
      .select(
        'daily_settlements.*',
        'emp.name as employee_name',
        'approver.name as approved_by_name'
      )
      .first();

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found.' });
    }

    if (req.user.role === 'employee' && settlement.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fetch the day's expenses for context
    const expenses = await db('expenses')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .where('expenses.created_by', settlement.employee_id)
      .where('expenses.date', settlement.date)
      .select('expenses.*', 'expense_heads.name as head_name');

    res.json({ settlement: { ...settlement, expenses } });
  } catch (err) {
    console.error('Get settlement error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/settlements/:id/approve
router.patch('/:id/approve', authenticate, authorize('accounts_head', 'admin'), async (req, res) => {
  try {
    const settlement = await db('daily_settlements').where({ id: req.params.id }).first();
    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found.' });
    }
    if (settlement.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending settlements can be approved.' });
    }

    const [updated] = await db('daily_settlements')
      .where({ id: req.params.id })
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: db.fn.now(),
      })
      .returning('*');

    res.json({ settlement: updated });
  } catch (err) {
    console.error('Approve settlement error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/settlements/:id/reject
router.patch('/:id/reject', authenticate, authorize('accounts_head', 'admin'), async (req, res) => {
  try {
    const settlement = await db('daily_settlements').where({ id: req.params.id }).first();
    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found.' });
    }
    if (settlement.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending settlements can be rejected.' });
    }

    const [updated] = await db('daily_settlements')
      .where({ id: req.params.id })
      .update({
        status: 'rejected',
        approved_by: req.user.id,
        approved_at: db.fn.now(),
      })
      .returning('*');

    res.json({ settlement: updated });
  } catch (err) {
    console.error('Reject settlement error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/settlements/:id — admin deletes settlement
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const settlement = await db('daily_settlements').where({ id: req.params.id }).first();
    if (!settlement) return res.status(404).json({ error: 'Settlement not found.' });

    await db('daily_settlements').where({ id: settlement.id }).del();

    await log({
      action: 'delete',
      entity: 'settlement',
      entity_id: settlement.id,
      details: { date: settlement.date, bank_deposit_amount: settlement.bank_deposit_amount },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.json({ message: 'Settlement deleted.' });
  } catch (err) {
    console.error('Delete settlement error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
