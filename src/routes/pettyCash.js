const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinaryUtil = require('../utils/cloudinary');

const router = express.Router();

// POST /api/petty-cash — admin opens a new petty cash fund
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { date, opening_balance } = req.body;

    if (!date || opening_balance == null) {
      return res.status(400).json({ error: 'Date and opening_balance are required.' });
    }

    // Only one active fund at a time
    const active = await db('petty_cash').where({ status: 'active' }).first();
    if (active) {
      return res.status(409).json({ error: 'An active petty cash fund already exists. Close it first.' });
    }

    const [fund] = await db('petty_cash')
      .insert({
        date,
        opening_balance,
        current_balance: opening_balance,
        created_by: req.user.id,
      })
      .returning('*');

    res.status(201).json({ petty_cash: fund });
  } catch (err) {
    console.error('Create petty cash error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/petty-cash — list funds
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;

    let query = db('petty_cash')
      .leftJoin('users', 'petty_cash.created_by', 'users.id')
      .select('petty_cash.*', 'users.name as created_by_name')
      .orderBy('petty_cash.created_at', 'desc');

    if (status) query = query.where('petty_cash.status', status);

    const funds = await query;
    res.json({ petty_cash: funds });
  } catch (err) {
    console.error('List petty cash error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/petty-cash/active — get current active fund
router.get('/active', authenticate, async (req, res) => {
  try {
    const fund = await db('petty_cash')
      .leftJoin('users', 'petty_cash.created_by', 'users.id')
      .where('petty_cash.status', 'active')
      .select('petty_cash.*', 'users.name as created_by_name')
      .first();

    if (!fund) {
      return res.status(404).json({ error: 'No active petty cash fund.' });
    }

    res.json({ petty_cash: fund });
  } catch (err) {
    console.error('Get active petty cash error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/petty-cash/:id — fund detail with transactions
router.get('/:id', authenticate, async (req, res) => {
  try {
    const fund = await db('petty_cash')
      .leftJoin('users', 'petty_cash.created_by', 'users.id')
      .where('petty_cash.id', req.params.id)
      .select('petty_cash.*', 'users.name as created_by_name')
      .first();

    if (!fund) {
      return res.status(404).json({ error: 'Petty cash fund not found.' });
    }

    const transactions = await db('petty_cash_transactions')
      .leftJoin('expense_heads', 'petty_cash_transactions.head_id', 'expense_heads.id')
      .leftJoin('users as creator', 'petty_cash_transactions.created_by', 'creator.id')
      .leftJoin('users as approver', 'petty_cash_transactions.approved_by', 'approver.id')
      .where('petty_cash_transactions.petty_cash_id', req.params.id)
      .select(
        'petty_cash_transactions.*',
        'expense_heads.name as head_name',
        'creator.name as created_by_name',
        'approver.name as approved_by_name'
      )
      .orderBy('petty_cash_transactions.created_at', 'desc');

    res.json({ petty_cash: { ...fund, transactions } });
  } catch (err) {
    console.error('Get petty cash detail error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/petty-cash/:id/transactions — dispense cash
router.post('/:id/transactions', authenticate, authorize('employee', 'admin'), upload.single('receipt'), async (req, res) => {
  try {
    const fund = await db('petty_cash').where({ id: req.params.id, status: 'active' }).first();
    if (!fund) {
      return res.status(404).json({ error: 'Active petty cash fund not found.' });
    }

    const { date, amount, explanation, head_id } = req.body;

    if (!date || !amount || !explanation) {
      return res.status(400).json({ error: 'Date, amount, and explanation are required.' });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be positive.' });
    }

    // Reserve against pending dispenses too, not just current_balance — otherwise
    // multiple pending requests can each pass this check against the same
    // balance and later all get approved, overdrawing the fund.
    const [{ pending_total }] = await db('petty_cash_transactions')
      .where({ petty_cash_id: fund.id, type: 'dispense', status: 'pending' })
      .select(db.raw('COALESCE(SUM(amount), 0) as pending_total'));
    const available = Number(fund.current_balance) - Number(pending_total);

    if (Number(amount) > available) {
      return res.status(400).json({ error: 'Insufficient petty cash balance (including pending requests).' });
    }

    if (head_id) {
      const head = await db('expense_heads').where({ id: head_id, is_active: true }).first();
      if (!head) {
        return res.status(400).json({ error: 'Invalid expense head.' });
      }
    }

    let receipt_url = null;
    let receipt_public_id = null;
    if (req.file) {
      receipt_url = req.file.cloudinaryUrl;
      receipt_public_id = req.file.cloudinaryPublicId;
    }

    const [transaction] = await db('petty_cash_transactions')
      .insert({
        petty_cash_id: fund.id,
        date,
        type: 'dispense',
        amount,
        explanation,
        receipt_url,
        receipt_public_id,
        head_id: head_id || null,
        status: 'pending',
        created_by: req.user.id,
      })
      .returning('*');

    res.status(201).json({ transaction });
  } catch (err) {
    console.error('Create petty cash transaction error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/petty-cash/:id/replenish — admin replenishes the fund
router.post('/:id/replenish', authenticate, authorize('admin'), async (req, res) => {
  try {
    const fund = await db('petty_cash').where({ id: req.params.id, status: 'active' }).first();
    if (!fund) {
      return res.status(404).json({ error: 'Active petty cash fund not found.' });
    }

    const { date, amount, explanation } = req.body;

    if (!date || !amount) {
      return res.status(400).json({ error: 'Date and amount are required.' });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be positive.' });
    }

    const [transaction] = await db('petty_cash_transactions')
      .insert({
        petty_cash_id: fund.id,
        date,
        type: 'replenish',
        amount,
        explanation: explanation || null,
        status: 'approved',
        created_by: req.user.id,
        approved_by: req.user.id,
        approved_at: db.fn.now(),
      })
      .returning('*');

    // Update balance immediately (admin replenish is auto-approved)
    await db('petty_cash')
      .where({ id: fund.id })
      .increment('current_balance', Number(amount));

    res.status(201).json({ transaction });
  } catch (err) {
    console.error('Replenish petty cash error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/petty-cash/transactions/:id/approve — approve a dispense
router.patch('/transactions/:id/approve', authenticate, authorize('accounts_head', 'admin'), async (req, res) => {
  try {
    const txn = await db('petty_cash_transactions').where({ id: req.params.id }).first();
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    if (txn.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending transactions can be approved.' });
    }

    const [updated] = await db('petty_cash_transactions')
      .where({ id: req.params.id })
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: db.fn.now(),
      })
      .returning('*');

    // Deduct from fund balance on approval
    await db('petty_cash')
      .where({ id: txn.petty_cash_id })
      .decrement('current_balance', Number(txn.amount));

    res.json({ transaction: updated });
  } catch (err) {
    console.error('Approve petty cash transaction error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/petty-cash/transactions/:id/reject — reject a dispense
router.patch('/transactions/:id/reject', authenticate, authorize('accounts_head', 'admin'), async (req, res) => {
  try {
    const txn = await db('petty_cash_transactions').where({ id: req.params.id }).first();
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    if (txn.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending transactions can be rejected.' });
    }

    const [updated] = await db('petty_cash_transactions')
      .where({ id: req.params.id })
      .update({
        status: 'rejected',
        approved_by: req.user.id,
        approved_at: db.fn.now(),
      })
      .returning('*');

    res.json({ transaction: updated });
  } catch (err) {
    console.error('Reject petty cash transaction error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/petty-cash/:id/close — admin closes the fund
router.patch('/:id/close', authenticate, authorize('admin'), async (req, res) => {
  try {
    const fund = await db('petty_cash').where({ id: req.params.id }).first();
    if (!fund) {
      return res.status(404).json({ error: 'Petty cash fund not found.' });
    }
    if (fund.status !== 'active') {
      return res.status(400).json({ error: 'Fund is not active.' });
    }

    // Check for pending transactions
    const pending = await db('petty_cash_transactions')
      .where({ petty_cash_id: fund.id, status: 'pending' })
      .first();
    if (pending) {
      return res.status(400).json({ error: 'Cannot close fund with pending transactions.' });
    }

    const [updated] = await db('petty_cash')
      .where({ id: req.params.id })
      .update({ status: 'closed' })
      .returning('*');

    res.json({ petty_cash: updated });
  } catch (err) {
    console.error('Close petty cash error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/petty-cash/:id/summary — balance summary
router.get('/:id/summary', authenticate, async (req, res) => {
  try {
    const fund = await db('petty_cash').where({ id: req.params.id }).first();
    if (!fund) {
      return res.status(404).json({ error: 'Petty cash fund not found.' });
    }

    const [totals] = await db('petty_cash_transactions')
      .where({ petty_cash_id: fund.id })
      .select(
        db.raw("SUM(CASE WHEN type = 'dispense' AND status = 'approved' THEN amount ELSE 0 END) as total_dispensed"),
        db.raw("SUM(CASE WHEN type = 'dispense' AND status = 'pending' THEN amount ELSE 0 END) as pending_dispense"),
        db.raw("SUM(CASE WHEN type = 'replenish' THEN amount ELSE 0 END) as total_replenished")
      );

    res.json({
      petty_cash: fund,
      summary: {
        opening_balance: Number(fund.opening_balance),
        current_balance: Number(fund.current_balance),
        total_dispensed: Number(totals.total_dispensed),
        pending_dispense: Number(totals.pending_dispense),
        total_replenished: Number(totals.total_replenished),
      },
    });
  } catch (err) {
    console.error('Petty cash summary error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
