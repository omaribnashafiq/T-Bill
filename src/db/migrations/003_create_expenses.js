exports.up = function (knex) {
  return knex.schema.createTable('expenses', (table) => {
    table.increments('id').primary();
    table.date('date').notNullable();
    table.integer('head_id').unsigned().notNullable().references('id').inTable('expense_heads');
    table.integer('subhead_id').unsigned().references('id').inTable('expense_heads');
    table.decimal('amount', 12, 2).notNullable();
    table.text('explanation');
    table.string('status').notNullable().defaultTo('pending');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users');
    table.integer('approved_by').unsigned().references('id').inTable('users');
    table.timestamp('approved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('expenses');
};
