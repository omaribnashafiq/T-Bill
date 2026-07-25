const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/export/expenses — export expenses as CSV
router.get('/expenses', authenticate, authorize('admin', 'accounts_head'), async (req, res) => {
  try {
    const { from, to, head_id, status } = req.query;

    let query = db('expenses')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .leftJoin('expense_heads as sub', 'expenses.subhead_id', 'sub.id')
      .leftJoin('users as creator', 'expenses.created_by', 'creator.id')
      .leftJoin('users as approver', 'expenses.approved_by', 'approver.id')
      .select(
        'expenses.date',
        'creator.name as employee',
        'expense_heads.name as category',
        'sub.name as subcategory',
        'expenses.amount',
        'expenses.explanation',
        'expenses.status',
        'approver.name as approved_by',
        'expenses.approved_at',
        'expenses.created_at'
      )
      .orderBy('expenses.date', 'desc');

    if (from) query = query.where('expenses.date', '>=', from);
    if (to) query = query.where('expenses.date', '<=', to);
    if (head_id) query = query.where('expenses.head_id', head_id);
    if (status) query = query.where('expenses.status', status);

    const expenses = await query;

    // Build CSV
    const headers = ['Date', 'Employee', 'Category', 'Subcategory', 'Amount (৳)', 'Explanation', 'Status', 'Approved By', 'Approved At', 'Created At'];
    const rows = expenses.map((e) => [
      e.date,
      e.employee,
      e.category,
      e.subcategory || '',
      Number(e.amount).toFixed(2),
      `"${(e.explanation || '').replace(/"/g, '""')}"`,
      e.status,
      e.approved_by || '',
      e.approved_at || '',
      e.created_at,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export expenses error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/export/settlements — export settlements as CSV
router.get('/settlements', authenticate, authorize('admin', 'accounts_head'), async (req, res) => {
  try {
    const { from, to, status } = req.query;

    let query = db('daily_settlements')
      .leftJoin('users as emp', 'daily_settlements.employee_id', 'emp.id')
      .leftJoin('users as approver', 'daily_settlements.approved_by', 'approver.id')
      .select(
        'daily_settlements.date',
        'emp.name as employee',
        'daily_settlements.total_expenses',
        'daily_settlements.total_unspent',
        'daily_settlements.bank_deposit_amount',
        'daily_settlements.status',
        'approver.name as approved_by',
        'daily_settlements.approved_at'
      )
      .orderBy('daily_settlements.date', 'desc');

    if (from) query = query.where('daily_settlements.date', '>=', from);
    if (to) query = query.where('daily_settlements.date', '<=', to);
    if (status) query = query.where('daily_settlements.status', status);

    const settlements = await query;

    const headers = ['Date', 'Employee', 'Total Expenses (৳)', 'Unspent (৳)', 'Bank Deposit (৳)', 'Status', 'Approved By', 'Approved At'];
    const rows = settlements.map((s) => [
      s.date,
      s.employee,
      Number(s.total_expenses).toFixed(2),
      Number(s.total_unspent).toFixed(2),
      Number(s.bank_deposit_amount).toFixed(2),
      s.status,
      s.approved_by || '',
      s.approved_at || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="settlements-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export settlements error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/export/petty-cash — export petty cash as CSV
router.get('/petty-cash', authenticate, authorize('admin', 'accounts_head'), async (req, res) => {
  try {
    const { fund_id } = req.query;

    let query = db('petty_cash_transactions')
      .leftJoin('petty_cash', 'petty_cash_transactions.petty_cash_id', 'petty_cash.id')
      .leftJoin('expense_heads', 'petty_cash_transactions.head_id', 'expense_heads.id')
      .leftJoin('users as creator', 'petty_cash_transactions.created_by', 'creator.id')
      .leftJoin('users as approver', 'petty_cash_transactions.approved_by', 'approver.id')
      .select(
        'petty_cash_transactions.date',
        'petty_cash_transactions.type',
        'petty_cash_transactions.amount',
        'petty_cash_transactions.explanation',
        'expense_heads.name as category',
        'creator.name as dispensed_by',
        'petty_cash_transactions.status',
        'approver.name as approved_by'
      )
      .orderBy('petty_cash_transactions.date', 'desc');

    if (fund_id) query = query.where('petty_cash_transactions.petty_cash_id', fund_id);

    const transactions = await query;

    const headers = ['Date', 'Type', 'Amount (৳)', 'Explanation', 'Category', 'Dispensed By', 'Status', 'Approved By'];
    const rows = transactions.map((t) => [
      t.date,
      t.type,
      Number(t.amount).toFixed(2),
      `"${(t.explanation || '').replace(/"/g, '""')}"`,
      t.category || '',
      t.dispensed_by,
      t.status,
      t.approved_by || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="petty-cash-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export petty cash error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/export/monthly-summary — export monthly summary as CSV
router.get('/monthly-summary', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { year, employee_id } = req.query;
    const targetYear = year || new Date().getFullYear();

    let query = db('expenses')
      .leftJoin('users', 'expenses.created_by', 'users.id')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .whereRaw("strftime('%Y', expenses.date) = ?", [String(targetYear)])
      .where('expenses.status', 'approved')
      .select(
        'users.name as employee',
        'expense_heads.name as category',
        db.raw("strftime('%m', expenses.date) as month"),
        db.raw('SUM(expenses.amount) as total_amount'),
        db.raw('COUNT(*) as expense_count')
      )
      .groupBy('expenses.created_by', 'expenses.head_id', db.raw("strftime('%m', expenses.date)"))
      .orderBy('users.name', 'asc');

    if (employee_id) query = query.where('expenses.created_by', employee_id);

    const data = await query;

    const headers = ['Employee', 'Category', 'Month', 'Total Amount (৳)', 'Expense Count'];
    const rows = data.map((d) => [
      d.employee,
      d.category,
      d.month,
      Number(d.total_amount).toFixed(2),
      d.expense_count,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-summary-${targetYear}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export monthly summary error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
