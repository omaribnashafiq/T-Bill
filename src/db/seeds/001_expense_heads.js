exports.seed = async function (knex) {
  // Clear existing heads
  await knex('expense_heads').del();

  // Reset sequences
  const isSQLite = knex.client.config.client === 'better-sqlite3';
  if (isSQLite) {
    await knex.raw("DELETE FROM sqlite_sequence WHERE name='expense_heads'");
  } else {
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

  // Reset sequence again after explicit ID inserts so subheads get correct auto IDs
  if (!isSQLite) {
    await knex.raw("ALTER SEQUENCE expense_heads_id_seq RESTART WITH 11");
  }

  // Insert subheads
  const subheads = [
    // Transportation
    { name: 'Product Delivery', parent_id: 1 },
    { name: 'Service Visit', parent_id: 1 },
    { name: 'Staff Commute', parent_id: 1 },
    // Food & Groceries
    { name: 'Staff Meals', parent_id: 3 },
    { name: 'Client Entertainment', parent_id: 3 },
    // Repair & Maintenance
    { name: 'Equipment Repair', parent_id: 4 },
    { name: 'Office Maintenance', parent_id: 4 },
    // Utilities
    { name: 'Electricity', parent_id: 5 },
    { name: 'Internet', parent_id: 5 },
    { name: 'Water', parent_id: 5 },
    // Communication
    { name: 'Phone Bills', parent_id: 8 },
    { name: 'SMS Packs', parent_id: 8 },
    // Staff Allowances
    { name: 'Travel Allowance', parent_id: 9 },
    { name: 'Overtime', parent_id: 9 },
  ];

  await knex('expense_heads').insert(subheads);
};
