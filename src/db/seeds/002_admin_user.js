const bcrypt = require('bcryptjs');
const crypto = require('crypto');

exports.seed = async function (knex) {
  // Check if admin already exists
  const existing = await knex('users').where({ email: 'admin@tbill.com' }).first();
  if (existing) return;

  // Generate a random one-time password instead of a hardcoded literal, so a
  // forgotten/unseen deployment doesn't sit on the internet with admin123.
  const tempPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await knex('users').insert({
    name: 'Admin',
    email: 'admin@tbill.com',
    phone: '01700000000',
    password_hash: passwordHash,
    role: 'admin',
    is_active: true,
  });

  console.log('='.repeat(60));
  console.log('Admin account created: admin@tbill.com');
  console.log(`Temporary password: ${tempPassword}`);
  console.log('Log in and change this password immediately.');
  console.log('='.repeat(60));
};
