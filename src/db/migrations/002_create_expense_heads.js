exports.up = function (knex) {
  return knex.schema.createTable('expense_heads', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.integer('parent_id').unsigned().references('id').inTable('expense_heads').onDelete('SET NULL');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('expense_heads');
};
