exports.up = function (knex) {
  return knex.schema.createTable('daily_settlements', (table) => {
    table.increments('id').primary();
    table.date('date').notNullable();
    table.integer('employee_id').unsigned().notNullable().references('id').inTable('users');
    table.decimal('total_expenses', 12, 2).notNullable();
    table.decimal('total_unspent', 12, 2).notNullable();
    table.decimal('bank_deposit_amount', 12, 2).notNullable();
    table.string('bank_screenshot_url');
    table.string('status').notNullable().defaultTo('pending');
    table.integer('approved_by').unsigned().references('id').inTable('users');
    table.timestamp('approved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('daily_settlements');
};
