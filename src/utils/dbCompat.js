const db = require('../db');

const isPg = () => db.client.config.client === 'pg';

function dateTruncMonth(col = 'date') {
  if (isPg()) return db.raw(`to_char(??, 'YYYY-MM')`, [col]);
  return db.raw(`strftime('%Y-%m', ${col})`);
}

function dateTruncYear(col = 'date') {
  if (isPg()) return db.raw(`to_char(??, 'YYYY')`, [col]);
  return db.raw(`strftime('%Y', ${col})`);
}

function dateTruncMonthNum(col = 'date') {
  if (isPg()) return db.raw(`to_char(??, 'MM')`, [col]);
  return db.raw(`strftime('%m', ${col})`);
}

function strftimeMonth(col = 'date') {
  if (isPg()) return `to_char(${col}, 'YYYY-MM')`;
  return `strftime('%Y-%m', ${col})`;
}

function strftimeYear(col = 'date') {
  if (isPg()) return `to_char(${col}, 'YYYY')`;
  return `strftime('%Y', ${col})`;
}

function strftimeMonthNum(col = 'date') {
  if (isPg()) return `to_char(${col}, 'MM')`;
  return `strftime('%m', ${col})`;
}

module.exports = { isPg, dateTruncMonth, dateTruncYear, dateTruncMonthNum, strftimeMonth, strftimeYear, strftimeMonthNum };
