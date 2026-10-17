/**
 * Idempotent migration for Stock Management + Daily Sales.
 *
 *   npm run migrate:stock
 *
 * Safe to run more than once. It:
 *   1. adds products.low_stock_threshold (if missing)
 *   2. creates stock_movements, sales, sale_items (if missing)
 *   3. adds credit-sale support: sales.sale_type / customer_phone /
 *      amount_paid / credit_status, and the credit_payments table
 *   4. writes an "opening balance" movement for every product that already
 *      has stock but no history yet, so the ledger starts consistent.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { DDL, ADD_THRESHOLD_COLUMN, ADD_CREDIT_COLUMNS } = require('./stockSalesSchema');

async function isMigrated(pool) {
  const [[col]] = await pool.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'low_stock_threshold'`
  );
  const [[credit]] = await pool.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'credit_status'`
  );
  const [tables] = await pool.execute(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('stock_movements','sales','sale_items','credit_payments')`
  );
  return col.c === 1 && credit.c === 1 && tables.length === 4;
}

async function migrate(pool) {
  const [[col]] = await pool.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'low_stock_threshold'`
  );
  if (col.c === 0) {
    await pool.query(ADD_THRESHOLD_COLUMN);
    console.log('✅  products.low_stock_threshold added');
  }

  for (const stmt of DDL) await pool.query(stmt);
  console.log('✅  stock_movements / sales / sale_items / credit_payments ready');

  // Existing databases: bring the older sales table up to date (existing rows become 'paid' sales)
  const [[hasCredit]] = await pool.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'sale_type'`
  );
  if (hasCredit.c === 0) {
    await pool.query(ADD_CREDIT_COLUMNS);
    console.log('✅  sales upgraded for credit sales (existing sales kept as paid sales)');
  }

  const [result] = await pool.query(`
    INSERT INTO stock_movements
      (product_id, product_name, type, quantity_change, quantity_before, quantity_after, reason)
    SELECT p.id, p.name, 'initial', p.stock, 0, p.stock, 'Opening balance (existing stock)'
    FROM products p
    WHERE p.stock > 0
      AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.product_id = p.id)
  `);
  if (result.affectedRows > 0) {
    console.log(`✅  ${result.affectedRows} opening-balance movement(s) recorded`);
  }
}

module.exports = { isMigrated, migrate };

if (require.main === module) {
  const { pool } = require('../config/db');
  migrate(pool)
    .then(async () => { await pool.end(); console.log('\n🎉  Stock & sales migration complete.\n'); process.exit(0); })
    .catch((err) => { console.error('❌  Migration failed:', err.message); process.exit(1); });
}
