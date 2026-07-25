exports.up = function (knex) {
  // SQLite doesn't support ALTER COLUMN, so recreate the table with expense_id nullable
  return knex.schema.raw(`
    CREATE TABLE attachments_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
      entity_type TEXT,
      entity_id INTEGER,
      file_url TEXT NOT NULL,
      file_type TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).then(() => {
    return knex.schema.raw(`
      INSERT INTO attachments_new (id, expense_id, entity_type, entity_id, file_url, file_type, uploaded_by, uploaded_at)
      SELECT id, expense_id, entity_type, entity_id, file_url, file_type, uploaded_by, uploaded_at FROM attachments;
    `);
  }).then(() => {
    return knex.schema.raw('DROP TABLE attachments;');
  }).then(() => {
    return knex.schema.raw('ALTER TABLE attachments_new RENAME TO attachments;');
  }).then(() => {
    return knex.schema.raw('CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);');
  });
};

exports.down = function (knex) {
  // Revert: make expense_id not nullable again
  return knex.schema.raw(`
    CREATE TABLE attachments_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      entity_type TEXT,
      entity_id INTEGER,
      file_url TEXT NOT NULL,
      file_type TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).then(() => {
    return knex.schema.raw(`
      INSERT INTO attachments_old (id, expense_id, entity_type, entity_id, file_url, file_type, uploaded_by, uploaded_at)
      SELECT id, expense_id, entity_type, entity_id, file_url, file_type, uploaded_by, uploaded_at FROM attachments;
    `);
  }).then(() => {
    return knex.schema.raw('DROP TABLE attachments;');
  }).then(() => {
    return knex.schema.raw('ALTER TABLE attachments_old RENAME TO attachments;');
  });
};
