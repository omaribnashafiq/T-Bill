const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // Skip if users already exist (besides admin)
  const userCount = await knex('users').count('* as count').first();
  if (userCount.count > 1) return;

  // Create employees
  const passwordHash = await bcrypt.hash('pass123', 10);
  const employees = [
    { name: 'Rahim Uddin', email: 'rahim@tbill.com', phone: '01711111111', password_hash: passwordHash, role: 'employee' },
    { name: 'Karim Ahmed', email: 'karim@tbill.com', phone: '01722222222', password_hash: passwordHash, role: 'employee' },
    { name: 'Fatima Begum', email: 'fatima@tbill.com', phone: '01733333333', password_hash: passwordHash, role: 'employee' },
  ];
  await knex('users').insert(employees);

  // Create accounts_head
  await knex('users').insert({
    name: 'Nargis Akter',
    email: 'nargis@tbill.com',
    phone: '01744444444',
    password_hash: passwordHash,
    role: 'accounts_head',
  });

  const rahim = await knex('users').where({ email: 'rahim@tbill.com' }).first();
  const karim = await knex('users').where({ email: 'karim@tbill.com' }).first();
  const fatima = await knex('users').where({ email: 'fatima@tbill.com' }).first();
  const nargis = await knex('users').where({ email: 'nargis@tbill.com' }).first();

  // Get expense heads
  const transportation = await knex('expense_heads').where({ name: 'Transportation' }).first();
  const officeRent = await knex('expense_heads').where({ name: 'Office Rent' }).first();
  const food = await knex('expense_heads').where({ name: 'Food & Groceries' }).first();
  const utilities = await knex('expense_heads').where({ name: 'Utilities' }).first();
  const supplies = await knex('expense_heads').where({ name: 'Office Supplies' }).first();
  const communication = await knex('expense_heads').where({ name: 'Communication' }).first();
  const misc = await knex('expense_heads').where({ name: 'Miscellaneous' }).first();

  const productDelivery = await knex('expense_heads').where({ name: 'Product Delivery' }).first();
  const staffMeals = await knex('expense_heads').where({ name: 'Staff Meals' }).first();
  const electricity = await knex('expense_heads').where({ name: 'Electricity' }).first();
  const internet = await knex('expense_heads').where({ name: 'Internet' }).first();

  // Sample expenses (last 30 days)
  const today = new Date();
  const expenses = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    if (i % 2 === 0) {
      expenses.push({ date: dateStr, head_id: transportation.id, subhead_id: productDelivery.id, amount: 800 + Math.floor(Math.random() * 700), explanation: 'Product delivery to Banani', status: i < 5 ? 'pending' : 'approved', created_by: rahim.id, approved_by: i < 5 ? null : nargis.id, approved_at: i < 5 ? null : new Date(d.getTime() + 86400000).toISOString() });
    }
    if (i % 3 === 0) {
      expenses.push({ date: dateStr, head_id: food.id, subhead_id: staffMeals.id, amount: 1200 + Math.floor(Math.random() * 800), explanation: 'Staff lunch - Gulshan office', status: i < 3 ? 'pending' : 'approved', created_by: rahim.id, approved_by: i < 3 ? null : nargis.id, approved_at: i < 3 ? null : new Date(d.getTime() + 86400000).toISOString() });
    }

    if (i % 2 === 1) {
      expenses.push({ date: dateStr, head_id: transportation.id, subhead_id: productDelivery.id, amount: 600 + Math.floor(Math.random() * 500), explanation: 'Delivery to Dhanmondi', status: i < 7 ? 'pending' : 'approved', created_by: karim.id, approved_by: i < 7 ? null : nargis.id, approved_at: i < 7 ? null : new Date(d.getTime() + 86400000).toISOString() });
    }
    if (i % 4 === 0) {
      expenses.push({ date: dateStr, head_id: utilities.id, subhead_id: electricity.id, amount: 3500, explanation: 'Monthly electricity bill', status: i < 4 ? 'pending' : 'approved', created_by: karim.id, approved_by: i < 4 ? null : nargis.id, approved_at: i < 4 ? null : new Date(d.getTime() + 86400000).toISOString() });
    }

    if (i % 3 === 1) {
      expenses.push({ date: dateStr, head_id: supplies.id, amount: 500 + Math.floor(Math.random() * 1000), explanation: 'Printer paper and pens', status: i < 2 ? 'pending' : i < 6 ? 'rejected' : 'approved', created_by: fatima.id, approved_by: i < 2 ? null : nargis.id, approved_at: i < 2 ? null : new Date(d.getTime() + 86400000).toISOString() });
    }
    if (i % 5 === 0) {
      expenses.push({ date: dateStr, head_id: communication.id, amount: 300 + Math.floor(Math.random() * 200), explanation: 'Phone recharge', status: 'approved', created_by: fatima.id, approved_by: nargis.id, approved_at: new Date(d.getTime() + 86400000).toISOString() });
    }

    if (i === 15) {
      expenses.push({ date: dateStr, head_id: officeRent.id, amount: 25000, explanation: 'Monthly office rent - Uttara', status: 'approved', created_by: rahim.id, approved_by: nargis.id, approved_at: new Date(d.getTime() + 86400000).toISOString() });
    }

    if (i === 10) {
      expenses.push({ date: dateStr, head_id: utilities.id, subhead_id: internet.id, amount: 1500, explanation: 'Monthly internet bill', status: 'approved', created_by: karim.id, approved_by: nargis.id, approved_at: new Date(d.getTime() + 86400000).toISOString() });
    }
  }

  await knex('expenses').insert(expenses);

  const settlements = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const exp = 2000 + Math.floor(Math.random() * 3000);
    const unspent = Math.floor(Math.random() * 500);

    settlements.push(
      { date: dateStr, employee_id: rahim.id, total_expenses: exp, total_unspent: unspent, bank_deposit_amount: exp + unspent, status: i < 2 ? 'pending' : 'approved', approved_by: i < 2 ? null : nargis.id, approved_at: i < 2 ? null : new Date(d.getTime() + 86400000).toISOString() },
      { date: dateStr, employee_id: karim.id, total_expenses: 1500 + Math.floor(Math.random() * 2000), total_unspent: Math.floor(Math.random() * 300), bank_deposit_amount: 1800 + Math.floor(Math.random() * 2000), status: i < 3 ? 'pending' : 'approved', approved_by: i < 3 ? null : nargis.id, approved_at: i < 3 ? null : new Date(d.getTime() + 86400000).toISOString() }
    );
  }
  await knex('daily_settlements').insert(settlements);

  const [fund] = await knex('petty_cash')
    .insert({ date: today.toISOString().split('T')[0], opening_balance: 10000, current_balance: 4500, created_by: 1 })
    .returning('*');

  await knex('petty_cash_transactions').insert([
    { petty_cash_id: fund.id, date: today.toISOString().split('T')[0], type: 'dispense', amount: 1500, explanation: 'Tea and snacks for meeting', head_id: misc.id, status: 'approved', created_by: rahim.id, approved_by: nargis.id, approved_at: new Date().toISOString() },
    { petty_cash_id: fund.id, date: today.toISOString().split('T')[0], type: 'dispense', amount: 2000, explanation: 'Courier charges', head_id: misc.id, status: 'approved', created_by: karim.id, approved_by: nargis.id, approved_at: new Date().toISOString() },
    { petty_cash_id: fund.id, date: today.toISOString().split('T')[0], type: 'dispense', amount: 1000, explanation: 'Office cleaning supplies', head_id: supplies.id, status: 'pending', created_by: fatima.id },
    { petty_cash_id: fund.id, date: today.toISOString().split('T')[0], type: 'dispense', amount: 500, explanation: 'Auto-rickshaw for delivery', head_id: transportation.id, status: 'pending', created_by: rahim.id },
    { petty_cash_id: fund.id, date: new Date(today.getTime() - 86400000).toISOString().split('T')[0], type: 'replenish', amount: 5000, explanation: 'Fund replenishment', status: 'approved', created_by: 1, approved_by: 1, approved_at: new Date().toISOString() },
  ]);

  const thisMonth = today.toISOString().slice(0, 7);
  await knex('budgets').insert([
    { year_month: thisMonth, head_id: transportation.id, amount: 25000, created_by: 1 },
    { year_month: thisMonth, head_id: food.id, amount: 15000, created_by: 1 },
    { year_month: thisMonth, head_id: utilities.id, amount: 10000, created_by: 1 },
    { year_month: thisMonth, head_id: supplies.id, amount: 5000, created_by: 1 },
    { year_month: thisMonth, head_id: communication.id, amount: 3000, created_by: 1 },
    { year_month: thisMonth, head_id: officeRent.id, amount: 25000, created_by: 1 },
    { year_month: thisMonth, head_id: misc.id, amount: 5000, created_by: 1 },
  ]);

  await knex('audit_log').insert([
    { action: 'create', entity: 'expense', entity_id: 1, details: JSON.stringify({ amount: 1200, head_id: transportation.id }), performed_by: rahim.id },
    { action: 'approve', entity: 'expense', entity_id: 1, details: JSON.stringify({ amount: 1200, created_by: rahim.id }), performed_by: nargis.id },
    { action: 'create', entity: 'expense', entity_id: 2, details: JSON.stringify({ amount: 1500, head_id: food.id }), performed_by: karim.id },
    { action: 'reject', entity: 'expense', entity_id: 5, details: JSON.stringify({ amount: 500, created_by: fatima.id }), performed_by: nargis.id },
    { action: 'approve', entity: 'settlement', entity_id: 1, details: JSON.stringify({ employee_id: rahim.id }), performed_by: nargis.id },
  ]);

  console.log('Sample data seeded successfully!');
};
