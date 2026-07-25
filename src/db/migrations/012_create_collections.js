exports.up = function (knex) {
  return knex.schema.createTable('collections', (table) => {
    table.increments('id').primary();
    table.date('date').notNullable();
    table.decimal('bill_amount', 12, 2).notNullable();
    table.integer('number_of_cards').notNullable().defaultTo(1);
    table.decimal('total', 14, 2).notNullable();
    table.text('explanation');
    table.string('status').notNullable().defaultTo('pending');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users');
    table.integer('approved_by').unsigned().references('id').inTable('users');
    table.timestamp('approved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('collections');
};
