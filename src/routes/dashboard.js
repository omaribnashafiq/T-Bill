const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard — role-based dashboard
router.get('/', authenticate, async (req, res) => {
  try {
    const { role } = req.user;

    if (role === 'admin') {
      return res.json({ dashboard: await adminDashboard() });
    }
    if (role === 'accounts_head') {
      return res.json({ dashboard: await accountsHeadDashboard(req.user.id) });
    }
    return res.json({ dashboard: await employeeDashboard(req.user.id) });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

async function adminDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  const [expenseStats] = await db('expenses')
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count"),
      db.raw("SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount"),
      db.raw("SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount"),
      db.raw("SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END) as rejected_amount"),
      db.raw("SUM(amount) as total_amount")
    );

  const [monthExpenses] = await db('expenses')
    .whereRaw("strftime('%Y-%m', date) = ?", [thisMonth])
    .select(
      db.raw('COUNT(*) as count'),
      db.raw('COALESCE(SUM(amount), 0) as amount')
    );

  const [settlementStats] = await db('daily_settlements')
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count"),
      db.raw("SUM(CASE WHEN status = 'approved' THEN total_expenses ELSE 0 END) as approved_expenses")
    );

  const [pettyCashStats] = await db('petty_cash')
    .select(
      db.raw("SUM(CASE WHEN status = 'active' THEN current_balance ELSE 0 END) as active_balance")
    );

  const pendingPettyTxns = await db('petty_cash_transactions')
    .where('status', 'pending')
    .count('* as count')
    .first();

  const [userStats] = await db('users')
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active")
    );

  // Recent expenses
  const recentExpenses = await db('expenses')
    .leftJoin('users', 'expenses.created_by', 'users.id')
    .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
    .select('expenses.id', 'expenses.amount', 'expenses.status', 'expenses.date', 'users.name as created_by_name', 'expense_heads.name as head_name')
    .orderBy('expenses.created_at', 'desc')
    .limit(5);

  // Category breakdown (this month)
  const categoryBreakdown = await db('expenses')
    .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
    .whereRaw("strftime('%Y-%m', expenses.date) = ?", [thisMonth])
    .where('expenses.status', 'approved')
    .select('expense_heads.name as head_name')
    .sum('expenses.amount as total')
    .groupBy('expense_heads.name')
    .orderBy('total', 'desc');

  return {
    expenses: expenseStats,
    month_expenses: monthExpenses,
    settlements: settlementStats,
    petty_cash: pettyCashStats,
    pending_petty_cash_transactions: Number(pendingPettyTxns.count),
    users: userStats,
    recent_expenses: recentExpenses,
    category_breakdown: categoryBreakdown,
  };
}

async function accountsHeadDashboard(userId) {
  const today = new Date().toISOString().split('T')[0];

  const pendingExpenses = await db('expenses')
    .where('status', 'pending')
    .select(db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(amount), 0) as amount'))
    .first();

  const pendingSettlements = await db('daily_settlements')
    .where('status', 'pending')
    .count('* as count')
    .first();

  const pendingPettyTxns = await db('petty_cash_transactions')
    .where('status', 'pending')
    .count('* as count')
    .first();

  // My expenses
  const myExpenses = await db('expenses')
    .where('created_by', userId)
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount")
    )
    .first();

  // Pending list for review
  const pendingExpensesList = await db('expenses')
    .leftJoin('users', 'expenses.created_by', 'users.id')
    .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
    .where('expenses.status', 'pending')
    .select('expenses.id', 'expenses.amount', 'expenses.date', 'expenses.explanation', 'users.name as created_by_name', 'expense_heads.name as head_name')
    .orderBy('expenses.created_at', 'asc')
    .limit(10);

  return {
    pending_expenses: { count: pendingExpenses.count, amount: pendingExpenses.amount },
    pending_settlements: Number(pendingSettlements.count),
    pending_petty_cash_transactions: Number(pendingPettyTxns.count),
    my_expenses: myExpenses,
    pending_expenses_list: pendingExpensesList,
  };
}

async function employeeDashboard(userId) {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  const [expenseStats] = await db('expenses')
    .where('created_by', userId)
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount"),
      db.raw("SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount"),
      db.raw("SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END) as rejected_amount")
    );

  const [monthExpenses] = await db('expenses')
    .where('created_by', userId)
    .whereRaw("strftime('%Y-%m', date) = ?", [thisMonth])
    .select(db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(amount), 0) as amount'));

  const [settlementStats] = await db('daily_settlements')
    .where('employee_id', userId)
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count"),
      db.raw("SUM(CASE WHEN status = 'approved' THEN total_expenses ELSE 0 END) as approved_expenses")
    );

  const todaySettlement = await db('daily_settlements')
    .where({ employee_id: userId, date: today })
    .first();

  // Recent expenses
  const recentExpenses = await db('expenses')
    .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
    .where('expenses.created_by', userId)
    .select('expenses.id', 'expenses.amount', 'expenses.status', 'expenses.date', 'expense_heads.name as head_name')
    .orderBy('expenses.created_at', 'desc')
    .limit(5);

  return {
    expenses: expenseStats,
    month_expenses: monthExpenses,
    settlements: settlementStats,
    today_settlement: todaySettlement || null,
    recent_expenses: recentExpenses,
  };
}

// GET /api/dashboard/reports/monthly — monthly summary report
router.get('/reports/monthly', authenticate, async (req, res) => {
  try {
    const { year, employee_id } = req.query;
    const targetYear = year || new Date().getFullYear();

    let query = db('expenses')
      .leftJoin('users', 'expenses.created_by', 'users.id')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .whereRaw("strftime('%Y', expenses.date) = ?", [String(targetYear)])
      .where('expenses.status', 'approved')
      .select(
        db.raw("strftime('%m', expenses.date) as month"),
        db.raw('SUM(expenses.amount) as total_amount'),
        db.raw('COUNT(*) as expense_count')
      )
      .groupBy(db.raw("strftime('%m', expenses.date)"))
      .orderBy('month', 'asc');

    if (employee_id) query = query.where('expenses.created_by', employee_id);

    const monthly = await query;

    // By category
    let catQuery = db('expenses')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .whereRaw("strftime('%Y', expenses.date) = ?", [String(targetYear)])
      .where('expenses.status', 'approved')
      .select('expense_heads.name as head_name', db.raw('SUM(expenses.amount) as total_amount'))
      .groupBy('expense_heads.name')
      .orderBy('total_amount', 'desc');

    if (employee_id) catQuery = catQuery.where('expenses.created_by', employee_id);

    const byCategory = await catQuery;

    res.json({ year: Number(targetYear), monthly, by_category: byCategory });
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/dashboard/reports/employee — employee comparison
router.get('/reports/employee', authenticate, async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear();

    const breakdown = await db('expenses')
      .leftJoin('users', 'expenses.created_by', 'users.id')
      .whereRaw("strftime('%Y', expenses.date) = ?", [String(targetYear)])
      .where('expenses.status', 'approved')
      .select(
        'users.name as employee_name',
        db.raw('SUM(expenses.amount) as total_amount'),
        db.raw('COUNT(*) as expense_count')
      )
      .groupBy('expenses.created_by')
      .orderBy('total_amount', 'desc');

    res.json({ year: Number(targetYear), employees: breakdown });
  } catch (err) {
    console.error('Employee report error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
