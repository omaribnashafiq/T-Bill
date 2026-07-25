exports.up = function (knex) {
  return knex.schema.createTable('attachments', (table) => {
    table.increments('id').primary();
    table.integer('expense_id').unsigned().notNullable().references('id').inTable('expenses').onDelete('CASCADE');
    table.string('file_url').notNullable();
    table.string('file_type').notNullable();
    table.integer('uploaded_by').unsigned().notNullable().references('id').inTable('users');
    table.timestamp('uploaded_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('attachments');
};
