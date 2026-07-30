const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Shared by admin + accounts_head dashboards: which expense heads are over
// (or close to) budget this month. Reuses the same spend calculation as
// budgets.js's /summary endpoint rather than duplicating the query logic.
async function budgetAlerts(currentMonth) {
  const budgets = await db('budgets')
    .leftJoin('expense_heads', 'budgets.head_id', 'expense_heads.id')
    .where('budgets.year_month', currentMonth)
    .select('budgets.head_id', 'expense_heads.name as head_name', 'budgets.amount as budgeted');

  if (budgets.length === 0) return [];

  const spending = await db('expenses')
    .where('expenses.status', 'approved')
    .whereRaw("strftime('%Y-%m', expenses.date) = ?", [currentMonth])
    .whereIn('expenses.head_id', budgets.map((b) => b.head_id))
    .select('expenses.head_id', db.raw('SUM(expenses.amount) as spent'))
    .groupBy('expenses.head_id');

  const spendingMap = {};
  spending.forEach((s) => { spendingMap[s.head_id] = Number(s.spent); });

  return budgets
    .map((b) => {
      const spent = spendingMap[b.head_id] || 0;
      const budgeted = Number(b.budgeted);
      return {
        head_id: b.head_id,
        head_name: b.head_name,
        budgeted,
        spent,
        utilization_pct: budgeted ? Math.round((spent / budgeted) * 10000) / 100 : 0,
      };
    })
    .filter((b) => b.utilization_pct >= 80)
    .sort((a, b) => b.utilization_pct - a.utilization_pct);
}

// Merges pending expenses, settlements, and petty cash transactions into a
// single "what needs my attention" queue, sorted by how long each item has
// been waiting — rather than three disconnected badge counts an approver has
// to check separately.
async function pendingQueue(limit = 10) {
  const [expenses, settlements, pettyCash] = await Promise.all([
    db('expenses')
      .leftJoin('users', 'expenses.created_by', 'users.id')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .where('expenses.status', 'pending')
      .select(
        'expenses.id',
        'expenses.amount',
        'expenses.created_at',
        'users.name as person',
        'expense_heads.name as label'
      ),
    db('daily_settlements')
      .leftJoin('users', 'daily_settlements.employee_id', 'users.id')
      .where('daily_settlements.status', 'pending')
      .select(
        'daily_settlements.id',
        'daily_settlements.total_expenses as amount',
        'daily_settlements.created_at',
        'users.name as person'
      ),
    db('petty_cash_transactions')
      .leftJoin('users', 'petty_cash_transactions.created_by', 'users.id')
      .where('petty_cash_transactions.status', 'pending')
      .select(
        'petty_cash_transactions.id',
        'petty_cash_transactions.amount',
        'petty_cash_transactions.created_at',
        'users.name as person',
        'petty_cash_transactions.type as label'
      ),
  ]);

  const combined = [
    ...expenses.map((e) => ({ type: 'expense', id: e.id, person: e.person, label: e.label || 'Expense', amount: Number(e.amount), created_at: e.created_at })),
    ...settlements.map((s) => ({ type: 'settlement', id: s.id, person: s.person, label: 'Settlement', amount: Number(s.amount), created_at: s.created_at })),
    ...pettyCash.map((p) => ({ type: 'petty_cash', id: p.id, person: p.person, label: p.label === 'dispense' ? 'Petty cash' : 'Petty cash top-up', amount: Number(p.amount), created_at: p.created_at })),
  ];

  combined.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return combined.slice(0, limit);
}

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

  // 6-month approved-spend trend, so a single month's snapshot has context
  const trendMonths = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    trendMonths.push(d.toISOString().slice(0, 7));
  }
  const trendRows = await db('expenses')
    .whereRaw(`strftime('%Y-%m', date) IN (${trendMonths.map(() => '?').join(',')})`, trendMonths)
    .where('status', 'approved')
    .select(db.raw("strftime('%Y-%m', date) as month"), db.raw('SUM(amount) as total'))
    .groupBy(db.raw("strftime('%Y-%m', date)"));
  const trendMap = {};
  trendRows.forEach((r) => { trendMap[r.month] = Number(r.total); });
  const spendTrend = trendMonths.map((m) => ({ month: m, total: trendMap[m] || 0 }));

  return {
    expenses: expenseStats,
    month_expenses: monthExpenses,
    settlements: settlementStats,
    petty_cash: pettyCashStats,
    pending_petty_cash_transactions: Number(pendingPettyTxns.count),
    users: userStats,
    recent_expenses: recentExpenses,
    category_breakdown: categoryBreakdown,
    budget_alerts: await budgetAlerts(thisMonth),
    pending_queue: await pendingQueue(),
    spend_trend: spendTrend,
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

  // How much this reviewer has cleared today — gives a sense of progress,
  // not just an ever-present backlog count.
  const reviewedToday = await db('expenses')
    .where('approved_by', userId)
    .whereIn('status', ['approved', 'rejected'])
    .whereRaw("date(approved_at) = ?", [today])
    .count('* as count')
    .first();

  return {
    pending_expenses: { count: pendingExpenses.count, amount: pendingExpenses.amount },
    pending_settlements: Number(pendingSettlements.count),
    pending_petty_cash_transactions: Number(pendingPettyTxns.count),
    my_expenses: myExpenses,
    pending_expenses_list: pendingExpensesList,
    pending_queue: await pendingQueue(),
    reviewed_today: Number(reviewedToday.count),
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
