exports.up = function (knex) {
  return knex.schema
    .alterTable('attachments', (table) => {
      table.string('cloudinary_public_id');
    })
    .alterTable('daily_settlements', (table) => {
      table.string('bank_screenshot_public_id');
    })
    .alterTable('petty_cash_transactions', (table) => {
      table.string('receipt_public_id');
    });
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('attachments', (table) => {
      table.dropColumn('cloudinary_public_id');
    })
    .alterTable('daily_settlements', (table) => {
      table.dropColumn('bank_screenshot_public_id');
    })
    .alterTable('petty_cash_transactions', (table) => {
      table.dropColumn('receipt_public_id');
    });
};
