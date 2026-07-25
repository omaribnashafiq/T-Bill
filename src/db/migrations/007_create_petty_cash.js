exports.up = function (knex) {
  return knex.schema
    .createTable('petty_cash', (table) => {
      table.increments('id').primary();
      table.date('date').notNullable();
      table.decimal('opening_balance', 12, 2).notNullable();
      table.decimal('current_balance', 12, 2).notNullable();
      table.string('status').notNullable().defaultTo('active');
      table.integer('created_by').unsigned().notNullable().references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('petty_cash_transactions', (table) => {
      table.increments('id').primary();
      table.integer('petty_cash_id').unsigned().notNullable().references('id').inTable('petty_cash').onDelete('CASCADE');
      table.date('date').notNullable();
      table.string('type').notNullable(); // dispense or replenish
      table.decimal('amount', 12, 2).notNullable();
      table.text('explanation');
      table.string('receipt_url');
      table.integer('head_id').unsigned().references('id').inTable('expense_heads');
      table.string('status').notNullable().defaultTo('pending');
      table.integer('created_by').unsigned().notNullable().references('id').inTable('users');
      table.integer('approved_by').unsigned().references('id').inTable('users');
      table.timestamp('approved_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('petty_cash_transactions')
    .dropTableIfExists('petty_cash');
};
