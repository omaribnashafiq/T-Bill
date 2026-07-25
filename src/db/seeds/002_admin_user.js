const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  const existing = await knex('users').where({ email: 'admin@tbill.com' }).first();
  if (existing) return;

  const passwordHash = await bcrypt.hash('admin123', 10);

  await knex('users').insert({
    name: 'Admin',
    email: 'admin@tbill.com',
    phone: '01700000000',
    password_hash: passwordHash,
    role: 'admin',
    is_active: true,
  });
};
