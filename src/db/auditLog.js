const db = require('./index');

async function log({ action, entity, entity_id, details, performed_by, ip_address }) {
  try {
    await db('audit_log').insert({
      action,
      entity,
      entity_id: entity_id || null,
      details: details ? JSON.stringify(details) : null,
      performed_by: performed_by || null,
      ip_address: ip_address || null,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = { log };
