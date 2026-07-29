const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { log } = require('../db/auditLog');
const { enqueue } = require('../utils/compressionQueue');

const router = express.Router();

const VALID_ENTITY_TYPES = ['expense', 'settlement'];

// Employees may only see attachments on their own expenses/settlements — this
// returns the owning user id for a given entity so callers can check it against
// req.user.id, rather than trusting entity_type/entity_id from the query string.
async function getOwnerId(entity_type, entity_id) {
  if (entity_type === 'expense') {
    const row = await db('expenses').where({ id: entity_id }).first();
    return row ? row.created_by : null;
  }
  if (entity_type === 'settlement') {
    const row = await db('daily_settlements').where({ id: entity_id }).first();
    return row ? row.employee_id : null;
  }
  return null;
}

// GET /api/attachments — list attachments for any entity
router.get('/', authenticate, async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;

    if (!entity_type || !entity_id) {
      return res.status(400).json({ error: 'entity_type and entity_id are required.' });
    }

    if (!VALID_ENTITY_TYPES.includes(entity_type)) {
      return res.status(400).json({ error: 'Invalid entity_type.' });
    }

    if (req.user.role === 'employee') {
      const ownerId = await getOwnerId(entity_type, entity_id);
      if (ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    const attachments = await db('attachments')
      .leftJoin('users', 'attachments.uploaded_by', 'users.id')
      .where({ entity_type, entity_id })
      .select('attachments.*', 'users.name as uploaded_by_name')
      .orderBy('attachments.uploaded_at', 'desc');

    res.json({ attachments });
  } catch (err) {
    console.error('List attachments error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/attachments/count — get attachment counts for multiple entities
router.get('/count', authenticate, async (req, res) => {
  try {
    const { entity_type, entity_ids } = req.query;

    if (!entity_type || !entity_ids) {
      return res.status(400).json({ error: 'entity_type and entity_ids are required.' });
    }

    let ids = entity_ids.split(',').map(Number).filter(Boolean);
    if (ids.length === 0) return res.json({ counts: {} });

    if (req.user.role === 'employee') {
      const table = entity_type === 'expense' ? 'expenses' : entity_type === 'settlement' ? 'daily_settlements' : null;
      const ownerCol = entity_type === 'expense' ? 'created_by' : 'employee_id';
      if (!table) return res.json({ counts: {} });
      const owned = await db(table).whereIn('id', ids).where(ownerCol, req.user.id).select('id');
      ids = owned.map((o) => o.id);
      if (ids.length === 0) return res.json({ counts: {} });
    }

    const counts = await db('attachments')
      .where('entity_type', entity_type)
      .whereIn('entity_id', ids)
      .select('entity_id')
      .count('* as count')
      .groupBy('entity_id');

    const countMap = {};
    counts.forEach(c => { countMap[c.entity_id] = Number(c.count); });

    res.json({ counts: countMap });
  } catch (err) {
    console.error('Count attachments error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/attachments — upload files (admin + employee for own expenses, admin for settlements)
router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  try {
    const { entity_type, entity_id } = req.body;

    if (!entity_type || !entity_id) {
      return res.status(400).json({ error: 'entity_type and entity_id are required.' });
    }

    if (!VALID_ENTITY_TYPES.includes(entity_type)) {
      return res.status(400).json({ error: 'Invalid entity_type.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required.' });
    }

    // Permission check: employees can only upload to their own expenses
    if (req.user.role === 'employee') {
      if (entity_type === 'expense') {
        const expense = await db('expenses').where({ id: entity_id }).first();
        if (!expense || expense.created_by !== req.user.id) {
          return res.status(403).json({ error: 'You can only attach files to your own expenses.' });
        }
      } else {
        return res.status(403).json({ error: 'Employees can only attach files to expenses.' });
      }
    }

    const attachments = req.files.map(f => {
      // Build date-based URL from file path
      const pathParts = f.path.split(require('path').sep);
      const uploadsIdx = pathParts.indexOf('uploads');
      const publicUrl = uploadsIdx >= 0
        ? '/' + pathParts.slice(uploadsIdx).join('/')
        : '/uploads/' + f.filename;

      return {
        entity_type,
        entity_id: Number(entity_id),
        file_url: publicUrl,
        file_type: f.mimetype,
        uploaded_by: req.user.id,
      };
    });

    const saved = await db('attachments').insert(attachments).returning('*');

    // Enqueue background compression for each file
    saved.forEach((att, idx) => {
      enqueue({
        filePath: req.files[idx].path,
        mimeType: req.files[idx].mimetype,
        entityType: entity_type,
        entityId: Number(entity_id),
        attachmentId: att.id,
      });
    });

    await log({
      action: 'upload',
      entity: 'attachment',
      entity_id: Number(entity_id),
      details: { entity_type, file_count: saved.length, files: saved.map(a => a.file_url) },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.status(201).json({ attachments: saved });
  } catch (err) {
    console.error('Upload attachment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/attachments/:id — delete attachment (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const attachment = await db('attachments').where({ id: req.params.id }).first();
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found.' });
    }

    // Remove file from disk
    const filePath = path.join(__dirname, '..', '..', attachment.file_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db('attachments').where({ id: req.params.id }).del();

    await log({
      action: 'delete',
      entity: 'attachment',
      entity_id: attachment.entity_id,
      details: { entity_type: attachment.entity_type, file_url: attachment.file_url },
      performed_by: req.user.id,
      ip_address: req.ip,
    });

    res.json({ message: 'Attachment deleted.' });
  } catch (err) {
    console.error('Delete attachment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
