exports.up = function (knex) {
  const isSQLite = knex.client.config.client === 'better-sqlite3';

  if (isSQLite) {
    // SQLite doesn't support ALTER COLUMN, so recreate the table
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
      return knex.raw(`INSERT INTO attachments_new (id, expense_id, entity_type, entity_id, file_url, file_type, uploaded_by, uploaded_at) SELECT id, expense_id, entity_type, entity_id, file_url, file_type, uploaded_by, uploaded_at FROM attachments`);
    }).then(() => {
      return knex.raw('DROP TABLE attachments');
    }).then(() => {
      return knex.raw('ALTER TABLE attachments_new RENAME TO attachments');
    }).then(() => {
      return knex.raw('CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id)');
    });
  }

  // PostgreSQL supports ALTER COLUMN
  return knex.schema.alterTable('attachments', (table) => {
    table.integer('expense_id').unsigned().nullable().alter();
  }).then(() => {
    return knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id)');
  });
};

exports.down = function (knex) {
  const isSQLite = knex.client.config.client === 'better-sqlite3';

  if (isSQLite) {
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
      return knex.raw(`INSERT INTO attachments_old (id, expense_id, entity_type, entity_id, file_url, file_type, uploaded_by, uploaded_at) SELECT id, expense_id, entity_type, entity_id, file_url, file_type, uploaded_by, uploaded_at FROM attachments`);
    }).then(() => {
      return knex.raw('DROP TABLE attachments');
    }).then(() => {
      return knex.raw('ALTER TABLE attachments_old RENAME TO attachments');
    });
  }

  return knex.schema.alterTable('attachments', (table) => {
    table.integer('expense_id').unsigned().notNullable().alter();
  });
};
