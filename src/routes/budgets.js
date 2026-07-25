const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/budgets — list budgets
router.get('/', authenticate, authorize('admin', 'accounts_head'), async (req, res) => {
  try {
    const { year_month } = req.query;
    const currentMonth = year_month || new Date().toISOString().slice(0, 7);

    const budgets = await db('budgets')
      .leftJoin('expense_heads', 'budgets.head_id', 'expense_heads.id')
      .leftJoin('users', 'budgets.created_by', 'users.id')
      .where('budgets.year_month', currentMonth)
      .select('budgets.*', 'expense_heads.name as head_name', 'users.name as created_by_name')
      .orderBy('expense_heads.name', 'asc');

    // Get spending for each budget
    const headIds = budgets.map((b) => b.head_id);
    const spending = headIds.length
      ? await db('expenses')
          .where('expenses.status', 'approved')
          .whereRaw("strftime('%Y-%m', expenses.date) = ?", [currentMonth])
          .whereIn('expenses.head_id', headIds)
          .select('expenses.head_id', db.raw('SUM(expenses.amount) as spent'))
          .groupBy('expenses.head_id')
      : [];

    const spendingMap = {};
    spending.forEach((s) => {
      spendingMap[s.head_id] = Number(s.spent);
    });

    const result = budgets.map((b) => ({
      ...b,
      spent: spendingMap[b.head_id] || 0,
      remaining: Number(b.amount) - (spendingMap[b.head_id] || 0),
      utilization_pct: spendingMap[b.head_id]
        ? Math.round(((spendingMap[b.head_id] / Number(b.amount)) * 100) * 100) / 100
        : 0,
    }));

    res.json({ budgets: result, year_month: currentMonth });
  } catch (err) {
    console.error('List budgets error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/budgets — admin sets budget
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { year_month, head_id, amount } = req.body;

    if (!year_month || !head_id || amount == null) {
      return res.status(400).json({ error: 'year_month, head_id, and amount are required.' });
    }

    // Validate format
    if (!/^\d{4}-\d{2}$/.test(year_month)) {
      return res.status(400).json({ error: 'year_month must be in YYYY-MM format.' });
    }

    const head = await db('expense_heads').where({ id: head_id, is_active: true }).first();
    if (!head) {
      return res.status(400).json({ error: 'Invalid expense head.' });
    }

    // Upsert
    const existing = await db('budgets').where({ year_month, head_id }).first();
    let budget;

    if (existing) {
      [budget] = await db('budgets')
        .where({ id: existing.id })
        .update({ amount })
        .returning('*');
    } else {
      [budget] = await db('budgets')
        .insert({ year_month, head_id, amount, created_by: req.user.id })
        .returning('*');
    }

    res.status(201).json({ budget });
  } catch (err) {
    console.error('Set budget error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/budgets/bulk — admin sets multiple budgets at once
router.post('/bulk', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { year_month, budgets } = req.body;

    if (!year_month || !budgets || !Array.isArray(budgets)) {
      return res.status(400).json({ error: 'year_month and budgets array are required.' });
    }

    const results = [];
    for (const { head_id, amount } of budgets) {
      const existing = await db('budgets').where({ year_month, head_id }).first();
      let budget;

      if (existing) {
        [budget] = await db('budgets')
          .where({ id: existing.id })
          .update({ amount })
          .returning('*');
      } else {
        [budget] = await db('budgets')
          .insert({ year_month, head_id, amount, created_by: req.user.id })
          .returning('*');
      }
      results.push(budget);
    }

    res.status(201).json({ budgets: results });
  } catch (err) {
    console.error('Bulk set budgets error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/budgets/summary — budget vs actual overview
router.get('/summary', authenticate, authorize('admin', 'accounts_head'), async (req, res) => {
  try {
    const { year_month } = req.query;
    const currentMonth = year_month || new Date().toISOString().slice(0, 7);

    const budgets = await db('budgets')
      .leftJoin('expense_heads', 'budgets.head_id', 'expense_heads.id')
      .where('budgets.year_month', currentMonth)
      .select('budgets.head_id', 'expense_heads.name as head_name', 'budgets.amount as budgeted');

    const spending = await db('expenses')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .where('expenses.status', 'approved')
      .whereRaw("strftime('%Y-%m', expenses.date) = ?", [currentMonth])
      .select('expenses.head_id', 'expense_heads.name as head_name', db.raw('SUM(expenses.amount) as spent'))
      .groupBy('expenses.head_id');

    const spendingMap = {};
    spending.forEach((s) => {
      spendingMap[s.head_id] = Number(s.spent);
    });

    const summary = budgets.map((b) => ({
      head_name: b.head_name,
      budgeted: Number(b.budgeted),
      spent: spendingMap[b.head_id] || 0,
      remaining: Number(b.budgeted) - (spendingMap[b.head_id] || 0),
      utilization_pct: spendingMap[b.head_id]
        ? Math.round(((spendingMap[b.head_id] / Number(b.budgeted)) * 100) * 100) / 100
        : 0,
    }));

    const totalBudgeted = summary.reduce((s, b) => s + b.budgeted, 0);
    const totalSpent = summary.reduce((s, b) => s + b.spent, 0);

    res.json({
      year_month: currentMonth,
      summary,
      totals: { budgeted: totalBudgeted, spent: totalSpent, remaining: totalBudgeted - totalSpent },
    });
  } catch (err) {
    console.error('Budget summary error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
