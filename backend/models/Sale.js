const { pool } = require('../config/db');

const SALE_COLS = `
  s.id, s.sale_number AS saleNumber, s.sale_type AS saleType,
  s.payment_method AS paymentMethod,
  s.customer_name AS customerName, s.customer_phone AS customerPhone, s.notes,
  s.total_amount AS totalAmount, s.total_quantity AS totalQuantity,
  s.amount_paid AS amountPaid, s.credit_status AS creditStatus,
  s.status, s.voided_at AS voidedAt, s.void_reason AS voidReason,
  a.name AS adminName, s.created_at AS createdAt
`;

const toCents = (v) => Math.round(Number(v) * 100);

/** Adds `balance` to credit sales (total − paid), computed in cents. */
function withBalance(row) {
  if (row.saleType !== 'credit') return { ...row, balance: 0 };
  return { ...row, balance: (toCents(row.totalAmount) - toCents(row.amountPaid)) / 100 };
}

function dateClause(fromUtc, toUtc, params, col = 's.created_at') {
  const where = [];
  if (fromUtc) { where.push(`${col} >= ?`); params.push(fromUtc); }
  if (toUtc)   { where.push(`${col} < ?`);  params.push(toUtc); }
  return where;
}

async function attachItems(rows) {
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const marks = ids.map(() => '?').join(',');

  const [items] = await pool.execute(
    `SELECT id, sale_id AS saleId, product_id AS productId, name,
            quantity, unit_price AS unitPrice, line_total AS lineTotal
     FROM sale_items WHERE sale_id IN (${marks})
     ORDER BY id ASC`,
    ids
  );
  const bySale = {};
  for (const it of items) (bySale[it.saleId] ||= []).push(it);

  const creditIds = rows.filter(r => r.saleType === 'credit').map(r => r.id);
  const payBySale = {};
  if (creditIds.length) {
    const [pays] = await pool.execute(
      `SELECT cp.id, cp.sale_id AS saleId, cp.amount, cp.payment_method AS paymentMethod,
              cp.note, a.name AS adminName, cp.created_at AS createdAt
       FROM credit_payments cp LEFT JOIN admins a ON a.id = cp.admin_id
       WHERE cp.sale_id IN (${creditIds.map(() => '?').join(',')})
       ORDER BY cp.created_at ASC, cp.id ASC`,
      creditIds
    );
    for (const p of pays) (payBySale[p.saleId] ||= []).push(p);
  }

  return rows.map(r => withBalance({
    ...r,
    items: bySale[r.id] || [],
    payments: payBySale[r.id] || [],
  }));
}

/** Escape LIKE wildcards so user text is matched literally. */
const likeTerm = (q) => `%${String(q).replace(/[\\%_]/g, '\\$&')}%`;

const Sale = {

  async create(conn, { saleType, paymentMethod, customerName, customerPhone, notes, adminId }) {
    // Temporary unique number; replaced with SL-<id> once the id is known.
    const temp = `TMP-${require('crypto').randomUUID()}`.slice(0, 40);
    const isCredit = saleType === 'credit';
    const [res] = await conn.execute(
      `INSERT INTO sales (sale_number, sale_type, payment_method, customer_name, customer_phone,
                          notes, total_amount, total_quantity, amount_paid, credit_status, admin_id)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
      [
        temp, isCredit ? 'credit' : 'paid',
        isCredit ? null : paymentMethod,
        customerName || null, customerPhone || null, notes || null,
        isCredit ? 'unpaid' : null,
        adminId ?? null,
      ]
    );
    const id = res.insertId;
    const saleNumber = `SL-${String(id).padStart(5, '0')}`;
    await conn.execute(`UPDATE sales SET sale_number = ? WHERE id = ?`, [saleNumber, id]);
    return { id, saleNumber };
  },

  async addItem(conn, saleId, { productId, name, quantity, unitPrice, lineTotal }) {
    await conn.execute(
      `INSERT INTO sale_items (sale_id, product_id, name, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [saleId, productId, name, quantity, unitPrice, lineTotal]
    );
  },

  async setTotals(conn, saleId, totalAmount, totalQuantity) {
    await conn.execute(
      `UPDATE sales SET total_amount = ?, total_quantity = ? WHERE id = ?`,
      [totalAmount, totalQuantity, saleId]
    );
  },

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT ${SALE_COLS} FROM sales s LEFT JOIN admins a ON a.id = s.admin_id
       WHERE s.id = ? LIMIT 1`, [id]
    );
    if (!rows[0]) return null;
    return (await attachItems(rows))[0];
  },

  /** Lock a sale row inside a transaction (used by void / record payment). */
  async lockById(conn, id) {
    const [rows] = await conn.execute(
      `SELECT id, sale_number AS saleNumber, sale_type AS saleType, status,
              total_amount AS totalAmount, amount_paid AS amountPaid, credit_status AS creditStatus
       FROM sales WHERE id = ? LIMIT 1 FOR UPDATE`, [id]
    );
    return rows[0] || null;
  },

  async itemsForSale(conn, saleId) {
    const [rows] = await conn.execute(
      `SELECT product_id AS productId, name, quantity FROM sale_items
       WHERE sale_id = ? ORDER BY product_id ASC`, [saleId]
    );
    return rows;
  },

  async markVoided(conn, id, reason) {
    await conn.execute(
      `UPDATE sales SET status = 'voided', voided_at = NOW(), void_reason = ? WHERE id = ?`,
      [reason, id]
    );
  },

  /** Record a payment against a credit sale and update paid amount + status. */
  async addCreditPayment(conn, sale, { amountCents, paymentMethod, note, adminId }) {
    await conn.execute(
      `INSERT INTO credit_payments (sale_id, amount, payment_method, note, admin_id)
       VALUES (?, ?, ?, ?, ?)`,
      [sale.id, amountCents / 100, paymentMethod, note || null, adminId ?? null]
    );
    const newPaidCents = toCents(sale.amountPaid) + amountCents;
    const totalCents   = toCents(sale.totalAmount);
    const creditStatus = newPaidCents >= totalCents ? 'paid' : 'partial';
    await conn.execute(
      `UPDATE sales SET amount_paid = ?, credit_status = ? WHERE id = ?`,
      [newPaidCents / 100, creditStatus, sale.id]
    );
    return { creditStatus, balanceCents: totalCents - newPaidCents };
  },

  async findAll({ fromUtc, toUtc, saleType, paymentMethod, status, creditStatus, q, limit, offset }) {
    const params = [];
    const where = dateClause(fromUtc, toUtc, params);
    if (saleType)      { where.push('s.sale_type = ?');      params.push(saleType); }
    if (paymentMethod) { where.push('s.payment_method = ?'); params.push(paymentMethod); }
    if (status)        { where.push('s.status = ?');         params.push(status); }
    if (creditStatus)  { where.push('s.credit_status = ?');  params.push(creditStatus); }
    if (q) {
      where.push('(s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.sale_number LIKE ?)');
      const t = likeTerm(q);
      params.push(t, t, t);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM sales s ${clause}`, params
    );
    const [rows] = await pool.execute(
      `SELECT ${SALE_COLS}
       FROM sales s LEFT JOIN admins a ON a.id = s.admin_id
       ${clause}
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );
    return { rows: await attachItems(rows), total };
  },

  /**
   * Aggregates for the selected range — completed sales only (voided excluded).
   *   paid   = sales paid at the counter
   *   credit = sales given on credit in the range (full value)
   *   outstandingCredit = ALL unpaid credit right now (not limited to the range)
   *   credit.collected  = credit payments received during the range
   * `tz` = browser getTimezoneOffset() so the daily breakdown buckets by local day.
   */
  async stats({ fromUtc, toUtc, tz }) {
    const offset = Number(tz) || 0;                       // validated integer
    const params = [];
    const where  = dateClause(fromUtc, toUtc, params);
    where.push(`s.status = 'completed'`);
    const clause = `WHERE ${where.join(' AND ')}`;

    const [[totals]] = await pool.execute(
      `SELECT COUNT(*) AS transactions,
              COALESCE(SUM(s.total_amount), 0)   AS revenue,
              COALESCE(SUM(s.total_quantity), 0) AS itemsSold,
              COALESCE(SUM(s.sale_type = 'paid'), 0)   AS paidCount,
              COALESCE(SUM(CASE WHEN s.sale_type = 'paid'   THEN s.total_amount ELSE 0 END), 0) AS paidAmount,
              COALESCE(SUM(s.sale_type = 'credit'), 0) AS creditCount,
              COALESCE(SUM(CASE WHEN s.sale_type = 'credit' THEN s.total_amount ELSE 0 END), 0) AS creditAmount
       FROM sales s ${clause}`, params
    );

    // payment-method breakdown only makes sense for paid sales
    const [byPayment] = await pool.execute(
      `SELECT s.payment_method AS paymentMethod, COUNT(*) AS transactions,
              COALESCE(SUM(s.total_amount), 0) AS revenue
       FROM sales s ${clause} AND s.sale_type = 'paid'
       GROUP BY s.payment_method ORDER BY revenue DESC`, params
    );

    // group by product id so a renamed product stays one row, and show its current name
    const [topProducts] = await pool.execute(
      `SELECT COALESCE(p.name, si.name) AS name,
              SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       ${clause}
       GROUP BY si.product_id, COALESCE(p.name, si.name)
       ORDER BY revenue DESC, quantity DESC LIMIT 5`, params
    );

    const [daily] = await pool.execute(
      `SELECT DATE_FORMAT(DATE_SUB(s.created_at, INTERVAL ${offset} MINUTE), '%Y-%m-%d') AS day,
              COUNT(*) AS transactions,
              COALESCE(SUM(s.total_amount), 0)   AS revenue,
              COALESCE(SUM(s.total_quantity), 0) AS itemsSold,
              COALESCE(SUM(CASE WHEN s.sale_type = 'paid'   THEN s.total_amount ELSE 0 END), 0) AS paidAmount,
              COALESCE(SUM(CASE WHEN s.sale_type = 'credit' THEN s.total_amount ELSE 0 END), 0) AS creditAmount
       FROM sales s ${clause}
       GROUP BY day ORDER BY day DESC`, params
    );

    const vParams = [];
    const vWhere  = dateClause(fromUtc, toUtc, vParams);
    vWhere.push(`s.status = 'voided'`);
    const [[voided]] = await pool.execute(
      `SELECT COUNT(*) AS c FROM sales s WHERE ${vWhere.join(' AND ')}`, vParams
    );

    // Credit payments received during the range
    const cParams = [];
    const cWhere  = dateClause(fromUtc, toUtc, cParams, 'cp.created_at');
    cWhere.push(`s.status = 'completed'`);
    const [[collected]] = await pool.execute(
      `SELECT COALESCE(SUM(cp.amount), 0) AS amount
       FROM credit_payments cp JOIN sales s ON s.id = cp.sale_id
       WHERE ${cWhere.join(' AND ')}`, cParams
    );

    // Everything still owed — deliberately not limited to the date range
    const [[owed]] = await pool.execute(
      `SELECT COUNT(*) AS accounts,
              COALESCE(SUM(total_amount - amount_paid), 0) AS amount
       FROM sales
       WHERE sale_type = 'credit' AND status = 'completed' AND credit_status <> 'paid'`
    );

    const transactions = Number(totals.transactions);
    const revenue      = Number(totals.revenue);
    return {
      transactions,
      revenue,
      itemsSold:   Number(totals.itemsSold),
      averageSale: transactions > 0 ? Math.round((revenue / transactions) * 100) / 100 : 0,
      voidedCount: Number(voided.c),
      paid:   { transactions: Number(totals.paidCount),   amount: Number(totals.paidAmount) },
      credit: { transactions: Number(totals.creditCount), amount: Number(totals.creditAmount),
                collected: Number(collected.amount) },
      outstandingCredit: { amount: Number(owed.amount), accounts: Number(owed.accounts) },
      byPayment:   byPayment.map(r => ({ ...r, transactions: Number(r.transactions), revenue: Number(r.revenue) })),
      topProducts: topProducts.map(r => ({ ...r, quantity: Number(r.quantity), revenue: Number(r.revenue) })),
      daily:       daily.map(r => ({
        day: r.day, transactions: Number(r.transactions),
        revenue: Number(r.revenue), itemsSold: Number(r.itemsSold),
        paidAmount: Number(r.paidAmount), creditAmount: Number(r.creditAmount),
      })),
    };
  },
};

module.exports = Sale;
