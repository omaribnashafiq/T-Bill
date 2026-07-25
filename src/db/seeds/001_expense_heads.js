exports.seed = async function (knex) {
  // Skip if data already exists (idempotent for re-deploys)
  const existing = await knex('expense_heads').count('* as count').first();
  if (existing.count > 0) return;

  // Reset sequences
  const isSQLite = knex.client.config.client === 'better-sqlite3';
  if (!isSQLite) {
    await knex.raw("ALTER SEQUENCE expense_heads_id_seq RESTART WITH 1");
  }

  // Insert major heads
  const majorHeads = [
    { id: 1, name: 'Transportation' },
    { id: 2, name: 'Office Rent' },
    { id: 3, name: 'Food & Groceries' },
    { id: 4, name: 'Repair & Maintenance' },
    { id: 5, name: 'Utilities' },
    { id: 6, name: 'Service Transportation' },
    { id: 7, name: 'Office Supplies' },
    { id: 8, name: 'Communication' },
    { id: 9, name: 'Staff Allowances' },
    { id: 10, name: 'Miscellaneous' },
  ];

  await knex('expense_heads').insert(majorHeads);

  // Reset sequence after explicit ID inserts
  if (!isSQLite) {
    await knex.raw("ALTER SEQUENCE expense_heads_id_seq RESTART WITH 11");
  }

  // Insert subheads
  const subheads = [
    { name: 'Product Delivery', parent_id: 1 },
    { name: 'Service Visit', parent_id: 1 },
    { name: 'Staff Commute', parent_id: 1 },
    { name: 'Staff Meals', parent_id: 3 },
    { name: 'Client Entertainment', parent_id: 3 },
    { name: 'Equipment Repair', parent_id: 4 },
    { name: 'Office Maintenance', parent_id: 4 },
    { name: 'Electricity', parent_id: 5 },
    { name: 'Internet', parent_id: 5 },
    { name: 'Water', parent_id: 5 },
    { name: 'Phone Bills', parent_id: 8 },
    { name: 'SMS Packs', parent_id: 8 },
    { name: 'Travel Allowance', parent_id: 9 },
    { name: 'Overtime', parent_id: 9 },
  ];

  await knex('expense_heads').insert(subheads);
};
