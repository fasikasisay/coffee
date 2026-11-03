/**
 * OPTIONAL one-off: register Daily Sales records for online orders that were
 * confirmed BEFORE the automatic registration existed.
 *
 *   npm run backfill:online-sales            # preview only (changes nothing)
 *   npm run backfill:online-sales -- --apply # actually create the sales
 *
 * Safe to re-run: an order that already has a sale is skipped (UNIQUE order_id).
 * Orders that are confirmed/processing/shipped/delivered get a sale; pending and
 * cancelled orders do not. Because the original confirmation time was never
 * stored, each backfilled sale is dated with the order's last-updated time
 * (the closest thing available). Stock is not touched.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { pool } = require('../config/db');
const Sale     = require('../models/Sale');
const Stock    = require('../models/Stock');

(async () => {
  const apply = process.argv.includes('--apply');
  const marks = Sale.SALE_ORDER_STATUSES.map(() => '?').join(',');
  const [orders] = await pool.execute(
    `SELECT o.id, o.order_number AS orderNumber, o.status, o.total_amount AS totalAmount, o.updated_at AS updatedAt
     FROM orders o
     WHERE o.status IN (${marks})
       AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = o.id)
     ORDER BY o.id`, Sale.SALE_ORDER_STATUSES
  );

  if (!orders.length) { console.log('Nothing to backfill — every confirmed order already has a sale.'); return; }
  console.log(`${orders.length} confirmed order(s) have no sale yet:`);
  orders.forEach((o) => console.log(`  ${o.orderNumber}  ${o.status.padEnd(10)}  ${o.totalAmount}  (dated ${o.updatedAt.toISOString()})`));
  if (!apply) { console.log('\nPreview only. Re-run with  -- --apply  to create these sales.'); return; }

  let created = 0;
  for (const o of orders) {
    await Stock.withTransaction(async (conn) => {
      await conn.execute(`SELECT id FROM orders WHERE id = ? FOR UPDATE`, [o.id]);
      const r = await Sale.syncFromOrder(conn, { orderId: o.id, status: o.status, adminId: null });
      if (r.action === 'created') {
        await conn.execute(`UPDATE sales SET created_at = ? WHERE id = ?`, [o.updatedAt, r.saleId]);
        created++;
      }
    });
  }
  console.log(`\n✅  ${created} sale(s) created.`);
})()
  .catch((err) => { console.error('❌  Backfill failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
