exports.up = function (knex) {
  return knex.schema.createTable('verification_notes', (table) => {
    table.increments('id').primary();
    table.integer('expense_id').unsigned().notNullable().references('id').inTable('expenses').onDelete('CASCADE');
    table.text('note').notNullable();
    table.string('attachment_url');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('verification_notes');
};
