require('dotenv').config();

module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: './dev.sqlite3',
    },
    migrations: {
      directory: './src/db/migrations',
    },
    seeds: {
      directory: './src/db/seeds',
    },
    useNullAsDefault: true,
  },
  // Not currently wired up — src/db/index.js always uses `development`.
  // See the NOTE in src/db/index.js before using this in a real deployment;
  // several queries elsewhere rely on SQLite-specific strftime() calls.
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: './src/db/migrations',
    },
    seeds: {
      directory: './src/db/seeds',
    },
  },
};
