const knex = require('knex');
const knexConfig = require('../../knexfile');

// NOTE: this app currently always runs against the `development` (SQLite)
// config, regardless of NODE_ENV. Several queries (budgets.js, export.js) use
// raw `strftime(...)` calls, which are SQLite-specific and would break against
// the `production` (Postgres) config in knexfile.js as-is. That production
// config is unused dead code today — either wire it up for real (replacing the
// strftime calls with a portable date-part expression) or remove it so nobody
// assumes Postgres is actually supported.
const db = knex(knexConfig.development);

module.exports = db;
