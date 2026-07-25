exports.up = function (knex) {
  return knex.schema.createTable('budgets', (table) => {
    table.increments('id').primary();
    table.string('year_month').notNullable(); // YYYY-MM format
    table.integer('head_id').unsigned().notNullable().references('id').inTable('expense_heads');
    table.decimal('amount', 12, 2).notNullable();
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['year_month', 'head_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('budgets');
};
