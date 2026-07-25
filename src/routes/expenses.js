const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { log } = require('../db/auditLog');
const { enqueue } = require('../utils/compressionQueue');
const { getAttachmentUrl, isCloudinaryConfigured } = require('../utils/cloudinary');

const router = express.Router();

// POST /api/expenses — employee creates expense
router.post('/', authenticate, authorize('employee', 'admin'), upload.array('files', 5), async (req, res) => {
  try {
    const { date, head_id, subhead_id, amount, explanation } = req.body;

    if (!date || !head_id || !amount) {
      return res.status(400).json({ error: 'Date, head_id, and amount are required.' });
    }

    const head = await db('expense_heads').where({ id: head_id, is_active: true }).first();
    if (!head) {
      return res.status(400).json({ error: 'Invalid expense head.' });
    }

    if (subhead_id) {
      const subhead = await db('expense_heads').where({ id: subhead_id, parent_id: head_id, is_active: true }).first();
      if (!subhead) {
        return res.status(400).json({ error: 'Invalid subhead for the given head.' });
      }
    }

    const [expense] = await db('expenses')
      .insert({
        date,
        head_id,
        subhead_id: subhead_id || null,
        amount,
        explanation: explanation || null,
        status: 'pending',
        created_by: req.user.id,
      })
      .returning('*');

    // Save attachments with dual-write (expense_id + entity_type/entity_id)
    const savedAttachments = [];
    if (req.files && req.files.length > 0) {
      const attachments = req.files.map((f) => {
        const publicUrl = getAttachmentUrl(f);
        return {
          expense_id: expense.id,
          entity_type: 'expense',
          entity_id: expense.id,
          file_url: publicUrl,
          file_type: f.mimetype,
          uploaded_by: req.user.id,
        };
      });
      const inserted = await db('attachments').insert(attachments).returning('*');
      savedAttachments.push(...inserted);

      if (!isCloudinaryConfigured()) {
        inserted.forEach((att, idx) => {
          enqueue({
            filePath: req.files[idx].path,
            mimeType: req.files[idx].mimetype,
            entityType: 'expense',
            entityId: expense.id,
            attachmentId: att.id,
          });
        });
      }
    }

    // Fetch full expense with relations
    const full = await db('expenses')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .leftJoin('expense_heads as sub', 'expenses.subhead_id', 'sub.id')
      .leftJoin('users', 'expenses.created_by', 'users.id')
      .where('expenses.id', expense.id)
      .select(
        'expenses.*',
        'expense_heads.name as head_name',
        'sub.name as subhead_name',
        'users.name as created_by_name'
      )
      .first();

    const attachments = savedAttachments.length > 0
      ? savedAttachments
      : await db('attachments').where({ expense_id: expense.id });

    await log({
      action: 'create',
      entity: 'expense',
      entity_id: expense.id,
      details: { amount, head_id, date },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.status(201).json({ expense: { ...full, attachments } });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/expenses — list expenses (filtered by role)
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, head_id, from, to, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('expenses')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .leftJoin('expense_heads as sub', 'expenses.subhead_id', 'sub.id')
      .leftJoin('users as creator', 'expenses.created_by', 'creator.id')
      .leftJoin('users as approver', 'expenses.approved_by', 'approver.id')
      .select(
        'expenses.*',
        'expense_heads.name as head_name',
        'sub.name as subhead_name',
        'creator.name as created_by_name',
        'approver.name as approved_by_name'
      )
      .orderBy('expenses.created_at', 'desc');

    // Role-based filtering
    if (req.user.role === 'employee') {
      query = query.where('expenses.created_by', req.user.id);
    } else if (req.user.role === 'accounts_head') {
      // accounts_head sees all pending + their own approved
      query = query.where(function () {
        this.where('expenses.status', 'pending').orWhere('expenses.created_by', req.user.id);
      });
    }
    // admin sees everything

    // Optional filters
    if (status) query = query.where('expenses.status', status);
    if (head_id) query = query.where('expenses.head_id', head_id);
    if (from) query = query.where('expenses.date', '>=', from);
    if (to) query = query.where('expenses.date', '<=', to);

    const [{ count: total }] = await query.clone().count('* as count');
    const expenses = await query.offset(offset).limit(limit);

    // Attach files to each expense (check both expense_id and entity columns)
    const ids = expenses.map((e) => e.id);
    const allAttachments = ids.length
      ? await db('attachments').where(function () {
          this.whereIn('expense_id', ids).orWhere(function () {
            this.where('entity_type', 'expense').whereIn('entity_id', ids);
          });
        })
      : [];
    const byExpense = {};
    allAttachments.forEach((a) => {
      const key = a.expense_id || a.entity_id;
      (byExpense[key] = byExpense[key] || []).push(a);
    });

    const result = expenses.map((e) => ({ ...e, attachments: byExpense[e.id] || [] }));

    res.json({ expenses: result, total: Number(total), page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List expenses error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/expenses/:id — admin edits any expense
router.patch('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const expense = await db('expenses').where({ id: req.params.id }).first();
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const { date, head_id, subhead_id, amount, explanation, status } = req.body;

    const updateData = {};
    if (date !== undefined) updateData.date = date;
    if (head_id !== undefined) updateData.head_id = head_id;
    if (subhead_id !== undefined) updateData.subhead_id = subhead_id || null;
    if (amount !== undefined) updateData.amount = amount;
    if (explanation !== undefined) updateData.explanation = explanation || null;
    if (status !== undefined && ['pending', 'approved', 'rejected'].includes(status)) {
      updateData.status = status;
      updateData.approved_by = req.user.id;
      updateData.approved_at = db.fn.now();
    }

    const [updated] = await db('expenses')
      .where({ id: req.params.id })
      .update(updateData)
      .returning('*');

    await log({
      action: 'update',
      entity: 'expense',
      entity_id: expense.id,
      details: {
        before: { date: expense.date, amount: expense.amount, status: expense.status },
        after: { date: updated.date, amount: updated.amount, status: updated.status },
      },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    const full = await db('expenses')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .leftJoin('expense_heads as sub', 'expenses.subhead_id', 'sub.id')
      .leftJoin('users', 'expenses.created_by', 'users.id')
      .where('expenses.id', updated.id)
      .select(
        'expenses.*',
        'expense_heads.name as head_name',
        'sub.name as subhead_name',
        'users.name as created_by_name'
      )
      .first();

    res.json({ expense: full });
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/expenses/:id — get single expense
router.get('/:id', authenticate, async (req, res) => {
  try {
    const expense = await db('expenses')
      .leftJoin('expense_heads', 'expenses.head_id', 'expense_heads.id')
      .leftJoin('expense_heads as sub', 'expenses.subhead_id', 'sub.id')
      .leftJoin('users as creator', 'expenses.created_by', 'creator.id')
      .leftJoin('users as approver', 'expenses.approved_by', 'approver.id')
      .where('expenses.id', req.params.id)
      .select(
        'expenses.*',
        'expense_heads.name as head_name',
        'sub.name as subhead_name',
        'creator.name as created_by_name',
        'approver.name as approved_by_name'
      )
      .first();

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    // Employees can only see their own
    if (req.user.role === 'employee' && expense.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const attachments = await db('attachments').where(function () {
      this.where('expense_id', expense.id).orWhere(function () {
        this.where('entity_type', 'expense').where('entity_id', expense.id);
      });
    });
    const notes = await db('verification_notes')
      .leftJoin('users', 'verification_notes.created_by', 'users.id')
      .where('verification_notes.expense_id', expense.id)
      .select('verification_notes.*', 'users.name as created_by_name')
      .orderBy('verification_notes.created_at', 'desc');

    res.json({ expense: { ...expense, attachments, notes } });
  } catch (err) {
    console.error('Get expense error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/expenses/bulk-approve — approve multiple expenses
router.post('/bulk-approve', authenticate, authorize('accounts_head', 'admin'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No expense IDs provided.' });
    }

    const expenses = await db('expenses').whereIn('id', ids).where('status', 'pending');
    if (expenses.length === 0) {
      return res.status(400).json({ error: 'No pending expenses found for the given IDs.' });
    }

    const updatedIds = expenses.map(e => e.id);
    await db('expenses').whereIn('id', updatedIds).update({
      status: 'approved',
      approved_by: req.user.id,
      approved_at: db.fn.now(),
    });

    // Log each approval
    for (const e of expenses) {
      await log({
        action: 'approve',
        entity: 'expense',
        entity_id: e.id,
        details: { amount: e.amount, created_by: e.created_by },
        performed_by: req.user.id,
        ip_address: req.ip,
      });
    }

    res.json({ approved: updatedIds.length, ids: updatedIds });
  } catch (err) {
    console.error('Bulk approve expenses error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/expenses/:id/approve — accounts_head/admin approves
router.patch('/:id/approve', authenticate, authorize('accounts_head', 'admin'), async (req, res) => {
  try {
    const expense = await db('expenses').where({ id: req.params.id }).first();
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    if (expense.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending expenses can be approved.' });
    }

    const [updated] = await db('expenses')
      .where({ id: req.params.id })
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: db.fn.now(),
      })
      .returning('*');

    await log({
      action: 'approve',
      entity: 'expense',
      entity_id: expense.id,
      details: { amount: expense.amount, created_by: expense.created_by },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.json({ expense: updated });
  } catch (err) {
    console.error('Approve expense error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/expenses/:id/reject — accounts_head/admin rejects with a note
router.patch('/:id/reject', authenticate, authorize('accounts_head', 'admin'), async (req, res) => {
  try {
    const expense = await db('expenses').where({ id: req.params.id }).first();
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    if (expense.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending expenses can be rejected.' });
    }

    const [updated] = await db('expenses')
      .where({ id: req.params.id })
      .update({ status: 'rejected', approved_by: req.user.id, approved_at: db.fn.now() })
      .returning('*');

    await log({
      action: 'reject',
      entity: 'expense',
      entity_id: expense.id,
      details: { amount: expense.amount, created_by: expense.created_by },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.json({ expense: updated });
  } catch (err) {
    console.error('Reject expense error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/expenses/bulk-delete — delete multiple rejected expenses
router.post('/bulk-delete', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No expense IDs provided.' });
    }

    const expenses = await db('expenses').whereIn('id', ids).where('status', 'rejected');
    if (expenses.length === 0) {
      return res.status(400).json({ error: 'No rejected expenses found for the given IDs.' });
    }

    const deletedIds = expenses.map(e => e.id);

    for (const e of expenses) {
      await db('attachments').where({ expense_id: e.id }).del();
      await db('attachments').where({ entity_type: 'expense', entity_id: e.id }).del();
      await db('verification_notes').where({ expense_id: e.id }).del();
      await db('expenses').where({ id: e.id }).del();

      await log({
        action: 'delete',
        entity: 'expense',
        entity_id: e.id,
        details: { amount: e.amount, head_id: e.head_id, created_by: e.created_by },
        performed_by: req.user.id,
        ip_address: req.ip,
      });
    }

    res.json({ deleted: deletedIds.length, ids: deletedIds });
  } catch (err) {
    console.error('Bulk delete expenses error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/expenses/:id — admin deletes expense
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const expense = await db('expenses').where({ id: req.params.id }).first();
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    // Delete associated attachments
    await db('attachments').where({ expense_id: expense.id }).del();
    await db('attachments').where({ entity_type: 'expense', entity_id: expense.id }).del();
    // Delete associated notes
    await db('verification_notes').where({ expense_id: expense.id }).del();
    // Delete the expense
    await db('expenses').where({ id: expense.id }).del();

    await log({
      action: 'delete',
      entity: 'expense',
      entity_id: expense.id,
      details: { amount: expense.amount, head_id: expense.head_id, created_by: expense.created_by },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.json({ message: 'Expense deleted.' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/expenses/:id/notes — add verification note
router.post('/:id/notes', authenticate, authorize('accounts_head', 'admin'), upload.single('attachment'), async (req, res) => {
  try {
    const expense = await db('expenses').where({ id: req.params.id }).first();
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const { note } = req.body;
    if (!note) {
      return res.status(400).json({ error: 'Note text is required.' });
    }

    let attachment_url = null;
    if (req.file) {
      const pathParts = req.file.path.split(require('path').sep);
      const uploadsIdx = pathParts.indexOf('uploads');
      attachment_url = uploadsIdx >= 0
        ? '/' + pathParts.slice(uploadsIdx).join('/')
        : '/uploads/' + req.file.filename;
    }

    const [saved] = await db('verification_notes')
      .insert({
        expense_id: req.params.id,
        note,
        attachment_url,
        created_by: req.user.id,
      })
      .returning('*');

    res.status(201).json({ note: saved });
  } catch (err) {
    console.error('Add note error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/expenses/:id/notes — list verification notes
router.get('/:id/notes', authenticate, async (req, res) => {
  try {
    const notes = await db('verification_notes')
      .leftJoin('users', 'verification_notes.created_by', 'users.id')
      .where('verification_notes.expense_id', req.params.id)
      .select('verification_notes.*', 'users.name as created_by_name')
      .orderBy('verification_notes.created_at', 'desc');

    res.json({ notes });
  } catch (err) {
    console.error('List notes error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
