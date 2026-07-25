const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit-log — admin views audit trail
router.get('/', authenticate, authorize('admin', 'accounts_head'), async (req, res) => {
  try {
    const { entity, entity_id, action, performed_by, from, to, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('audit_log')
      .leftJoin('users', 'audit_log.performed_by', 'users.id')
      .select('audit_log.*', 'users.name as performed_by_name')
      .orderBy('audit_log.created_at', 'desc');

    if (entity) query = query.where('audit_log.entity', entity);
    if (entity_id) query = query.where('audit_log.entity_id', entity_id);
    if (action) query = query.where('audit_log.action', action);
    if (performed_by) query = query.where('audit_log.performed_by', performed_by);
    if (from) query = query.where('audit_log.created_at', '>=', from);
    if (to) query = query.where('audit_log.created_at', '<=', to);

    const countQuery = query.clone().clearSelect().clearOrder();
    const [{ count: total }] = await countQuery.count('* as count');
    const logs = await query.offset(offset).limit(limit);

    // Parse details JSON
    const parsed = logs.map((l) => ({
      ...l,
      details: l.details ? JSON.parse(l.details) : null,
    }));

    res.json({ logs: parsed, total: Number(total), page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List audit log error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
