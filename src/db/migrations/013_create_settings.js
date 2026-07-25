exports.up = function (knex) {
  return knex.schema.createTable('settings', (table) => {
    table.string('key').primary();
    table.text('value');
    table.integer('updated_by').unsigned().references('id').inTable('users');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('settings');
};
