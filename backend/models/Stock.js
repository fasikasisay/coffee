const { pool } = require('../config/db');
const ErrorResponse = require('../utils/errorResponse');

const MAX_STOCK = 10_000_000;   // kg — sanity cap

/** in_stock / low_stock / out_of_stock */
function statusOf(stock, threshold) {
  if (stock <= 0) return 'out_of_stock';
  if (stock <= threshold) return 'low_stock';
  return 'in_stock';
}

const STOCK_COLS = `
  p.id, p.name, p.category, p.stock,
  p.low_stock_threshold AS lowStockThreshold,
  p.price_per_kg        AS pricePerKg,
  p.is_available        AS isAvailable,
  p.updated_at          AS updatedAt,
  (SELECT MAX(m.created_at) FROM stock_movements m WHERE m.product_id = p.id) AS lastMovementAt
`;

function shape(row) {
  return { ...row, status: statusOf(row.stock, row.lowStockThreshold) };
}

const Stock = {
  statusOf,
  MAX_STOCK,

  /** Run fn(conn) inside a transaction; commit on success, roll back on any throw. */
  async withTransaction(fn) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      try { await conn.rollback(); } catch {}
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * THE single place stock changes. Locks the product row, enforces
   * 0 <= stock <= MAX_STOCK, updates products.stock and writes the
   * stock_movements row — all on the caller's transaction.
   *
   * meta: { type, reason, refType?, refId?, adminId? }
   * Returns { id, name, pricePerKg, before, after }.
   */
  async change(conn, productId, delta, meta) {
    const [rows] = await conn.execute(
      `SELECT id, name, stock, price_per_kg AS pricePerKg
       FROM products WHERE id = ? LIMIT 1 FOR UPDATE`,
      [productId]
    );
    const p = rows[0];
    if (!p) throw new ErrorResponse('Product not found', 404);

    const before = p.stock;
    const after  = before + delta;

    if (after < 0) {
      throw new ErrorResponse(
        `Insufficient stock for "${p.name}" — only ${before.toLocaleString('en-US')} kg available`,
        400
      );
    }
    if (after > MAX_STOCK) {
      throw new ErrorResponse(`Stock for "${p.name}" cannot exceed ${MAX_STOCK.toLocaleString('en-US')} kg`, 400);
    }

    await conn.execute(
      `UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?`,
      [after, productId]
    );
    await Stock.logMovement(conn, {
      productId, productName: p.name, type: meta.type,
      change: delta, before, after, reason: meta.reason,
      refType: meta.refType, refId: meta.refId, adminId: meta.adminId,
    });

    return { id: p.id, name: p.name, pricePerKg: p.pricePerKg, before, after };
  },

  /** Set stock to an exact count (stock-take). Returns same shape as change(). */
  async setTo(conn, productId, target, meta) {
    const [rows] = await conn.execute(
      `SELECT stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE`, [productId]
    );
    if (!rows[0]) throw new ErrorResponse('Product not found', 404);
    const delta = target - rows[0].stock;
    if (delta === 0) {
      throw new ErrorResponse(`Stock is already ${target.toLocaleString('en-US')} kg — nothing to change`, 400);
    }
    return Stock.change(conn, productId, delta, meta);
  },

  /** Insert a history row only (use when the products.stock update happened elsewhere). */
  async logMovement(conn, m) {
    await conn.execute(
      `INSERT INTO stock_movements
         (product_id, product_name, type, quantity_change, quantity_before,
          quantity_after, reason, reference_type, reference_id, admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.productId, m.productName, m.type, m.change, m.before, m.after,
        String(m.reason).slice(0, 255),
        m.refType ?? null, m.refId ?? null, m.adminId ?? null,
      ]
    );
  },

  async list() {
    const [rows] = await pool.execute(
      `SELECT ${STOCK_COLS} FROM products p ORDER BY p.name ASC`
    );
    return rows.map(shape);
  },

  async findOne(id) {
    const [rows] = await pool.execute(
      `SELECT ${STOCK_COLS} FROM products p WHERE p.id = ? LIMIT 1`, [id]
    );
    return rows[0] ? shape(rows[0]) : null;
  },

  summarize(items) {
    const s = { totalProducts: items.length, inStock: 0, lowStock: 0, outOfStock: 0, totalKg: 0 };
    for (const i of items) {
      s.totalKg += i.stock;
      if (i.status === 'in_stock') s.inStock++;
      else if (i.status === 'low_stock') s.lowStock++;
      else s.outOfStock++;
    }
    return s;
  },

  /** Cheap counts for the dashboard / sidebar badge. */
  async alertCounts() {
    const [[r]] = await pool.execute(
      `SELECT
         COALESCE(SUM(stock = 0), 0)                                   AS outCount,
         COALESCE(SUM(stock > 0 AND stock <= low_stock_threshold), 0)  AS lowCount
       FROM products`
    );
    return { low: Number(r.lowCount), out: Number(r.outCount) };
  },

  async setThreshold(id, value) {
    const [result] = await pool.execute(
      `UPDATE products SET low_stock_threshold = ?, updated_at = NOW() WHERE id = ?`,
      [value, id]
    );
    return result.affectedRows > 0;
  },

  /**
   * Paged movement history.
   * filters: { productId, type, fromUtc, toUtc, limit, offset }
   */
  async movements({ productId, type, fromUtc, toUtc, limit, offset }) {
    const where = [];
    const params = [];
    if (productId) { where.push('m.product_id = ?');  params.push(productId); }
    if (type)      { where.push('m.type = ?');        params.push(type); }
    if (fromUtc)   { where.push('m.created_at >= ?'); params.push(fromUtc); }
    if (toUtc)     { where.push('m.created_at < ?');  params.push(toUtc); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM stock_movements m ${clause}`, params
    );

    // limit/offset are validated integers (see parsePaging) — safe to inline
    const [rows] = await pool.execute(
      `SELECT m.id, m.product_id AS productId, COALESCE(p.name, m.product_name) AS productName,
              m.type, m.quantity_change AS quantityChange,
              m.quantity_before AS quantityBefore, m.quantity_after AS quantityAfter,
              m.reason, m.reference_type AS referenceType, m.reference_id AS referenceId,
              a.name AS adminName, m.created_at AS createdAt
       FROM stock_movements m
       LEFT JOIN admins a ON a.id = m.admin_id
       LEFT JOIN products p ON p.id = m.product_id
       ${clause}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );
    return { rows, total };
  },
};

module.exports = Stock;
