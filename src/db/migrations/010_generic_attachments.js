exports.up = function (knex) {
  return knex.schema.alterTable('attachments', (table) => {
    table.string('entity_type').index();
    table.integer('entity_id').unsigned().index();
  }).then(() => {
    return knex.raw(`UPDATE attachments SET entity_type = 'expense', entity_id = expense_id WHERE expense_id IS NOT NULL`);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('attachments', (table) => {
    table.dropColumn('entity_type');
    table.dropColumn('entity_id');
  });
};