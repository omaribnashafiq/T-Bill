const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { log } = require('../db/auditLog');
const cloudinaryUtil = require('../utils/cloudinary');

const router = express.Router();

// GET /api/settings/bill-amount — get preset bill amount
router.get('/settings/bill-amount', authenticate, async (req, res) => {
  try {
    const setting = await db('settings').where({ key: 'preset_bill_amount' }).first();
    res.json({ bill_amount: setting ? Number(setting.value) : 500 });
  } catch (err) {
    console.error('Get bill amount error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/settings/bill-amount — admin/accounts_head set preset bill amount
router.patch('/settings/bill-amount', authenticate, authorize('admin', 'accounts_head'), async (req, res) => {
  try {
    const { bill_amount } = req.body;
    if (!bill_amount || bill_amount <= 0) {
      return res.status(400).json({ error: 'Invalid bill amount.' });
    }
    await db('settings')
      .insert({ key: 'preset_bill_amount', value: String(bill_amount), updated_by: req.user.id, updated_at: db.fn.now() })
      .onConflict('key')
      .merge({ value: String(bill_amount), updated_by: req.user.id, updated_at: db.fn.now() });

    await log({
      action: 'update',
      entity: 'setting',
      entity_id: null,
      details: { key: 'preset_bill_amount', value: bill_amount },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.json({ bill_amount });
  } catch (err) {
    console.error('Set bill amount error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/collections — list collections
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, from, to, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('collections')
      .leftJoin('users as creator', 'collections.created_by', 'creator.id')
      .leftJoin('users as approver', 'collections.approved_by', 'approver.id')
      .select(
        'collections.*',
        'creator.name as created_by_name',
        'approver.name as approved_by_name'
      )
      .orderBy('collections.created_at', 'desc');

    if (req.user.role === 'employee') {
      query = query.where('collections.created_by', req.user.id);
    }

    if (status) query = query.where('collections.status', status);
    if (from) query = query.where('collections.date', '>=', from);
    if (to) query = query.where('collections.date', '<=', to);

    const [{ count: total }] = await query.clone().count('* as count');
    const collections = await query.offset(offset).limit(limit);

    res.json({ collections, total: Number(total), page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List collections error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/collections — create collection
router.post('/', authenticate, authorize('employee', 'admin'), upload.array('files', 5), async (req, res) => {
  try {
    const { date, bill_amount, number_of_cards, explanation } = req.body;

    if (!date || !bill_amount || !number_of_cards) {
      return res.status(400).json({ error: 'Date, bill amount, and number of cards are required.' });
    }

    const total = Number(bill_amount) * Number(number_of_cards);

    const [collection] = await db('collections')
      .insert({
        date,
        bill_amount,
        number_of_cards,
        total,
        explanation: explanation || null,
        status: 'pending',
        created_by: req.user.id,
      })
      .returning('*');

    // Save attachments
    const savedAttachments = [];
    if (req.files && req.files.length > 0) {
      const attachments = req.files.map((f) => ({
        entity_type: 'collection',
        entity_id: collection.id,
        file_url: f.cloudinaryUrl,
        cloudinary_public_id: f.cloudinaryPublicId,
        file_type: f.mimetype,
        uploaded_by: req.user.id,
      }));
      const inserted = await db('attachments').insert(attachments).returning('*');
      savedAttachments.push(...inserted);
    }

    await log({
      action: 'create',
      entity: 'collection',
      entity_id: collection.id,
      details: { bill_amount, number_of_cards, total },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.status(201).json({ collection });
  } catch (err) {
    console.error('Create collection error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/collections/:id/approve — approve collection
router.patch('/:id/approve', authenticate, authorize('accounts_head', 'admin'), async (req, res) => {
  try {
    const collection = await db('collections').where({ id: req.params.id }).first();
    if (!collection) return res.status(404).json({ error: 'Collection not found.' });
    if (collection.status !== 'pending') return res.status(400).json({ error: 'Only pending collections can be approved.' });

    const [updated] = await db('collections')
      .where({ id: req.params.id })
      .update({ status: 'approved', approved_by: req.user.id, approved_at: db.fn.now() })
      .returning('*');

    await log({
      action: 'approve',
      entity: 'collection',
      entity_id: collection.id,
      details: { total: collection.total, created_by: collection.created_by },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.json({ collection: updated });
  } catch (err) {
    console.error('Approve collection error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/collections/:id/reject — reject collection
router.patch('/:id/reject', authenticate, authorize('accounts_head', 'admin'), async (req, res) => {
  try {
    const collection = await db('collections').where({ id: req.params.id }).first();
    if (!collection) return res.status(404).json({ error: 'Collection not found.' });
    if (collection.status !== 'pending') return res.status(400).json({ error: 'Only pending collections can be rejected.' });

    const [updated] = await db('collections')
      .where({ id: req.params.id })
      .update({ status: 'rejected', approved_by: req.user.id, approved_at: db.fn.now() })
      .returning('*');

    await log({
      action: 'reject',
      entity: 'collection',
      entity_id: collection.id,
      details: { total: collection.total, created_by: collection.created_by },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.json({ collection: updated });
  } catch (err) {
    console.error('Reject collection error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/collections/:id — get single collection
router.get('/:id', authenticate, async (req, res) => {
  try {
    const collection = await db('collections')
      .leftJoin('users as creator', 'collections.created_by', 'creator.id')
      .leftJoin('users as approver', 'collections.approved_by', 'approver.id')
      .where('collections.id', req.params.id)
      .select(
        'collections.*',
        'creator.name as created_by_name',
        'approver.name as approved_by_name'
      )
      .first();

    if (!collection) return res.status(404).json({ error: 'Collection not found.' });
    if (req.user.role === 'employee' && collection.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json({ collection });
  } catch (err) {
    console.error('Get collection error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/collections/:id — delete collection
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const collection = await db('collections').where({ id: req.params.id }).first();
    if (!collection) return res.status(404).json({ error: 'Collection not found.' });

    const attachmentsToRemove = await db('attachments').where({ entity_type: 'collection', entity_id: collection.id });
    await Promise.all(attachmentsToRemove.map((a) => cloudinaryUtil.destroyAsset(a.cloudinary_public_id, a.file_type === 'application/pdf' ? 'raw' : 'image')));
    await db('attachments').where({ entity_type: 'collection', entity_id: collection.id }).del();
    await db('collections').where({ id: collection.id }).del();

    await log({
      action: 'delete',
      entity: 'collection',
      entity_id: collection.id,
      details: { total: collection.total, created_by: collection.created_by },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.json({ message: 'Collection deleted.' });
  } catch (err) {
    console.error('Delete collection error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
