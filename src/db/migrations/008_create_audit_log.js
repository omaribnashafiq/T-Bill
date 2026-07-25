exports.up = function (knex) {
  return knex.schema.createTable('audit_log', (table) => {
    table.increments('id').primary();
    table.string('action').notNullable(); // create, update, delete, approve, reject, login
    table.string('entity').notNullable(); // expense, settlement, petty_cash, user, etc.
    table.integer('entity_id').unsigned();
    table.text('details'); // JSON string of changes
    table.integer('performed_by').unsigned().references('id').inTable('users');
    table.string('ip_address');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('audit_log');
};
