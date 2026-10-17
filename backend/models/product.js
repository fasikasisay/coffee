const { pool } = require('../config/db');
const Stock = require('./Stock');

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .slice(0, 200);
}

/** toSlug, but never empty (e.g. names written only in non-Latin script). */
function makeSlug(name, suffix) {
  const slug = toSlug(name);
  return /[a-z0-9]/.test(slug) ? slug : `product-${suffix}`;
}

const PRODUCT_COLS = `
  id, name, slug, category, description,
  price_per_kg AS pricePerKg, min_order_kg AS minOrderKg,
  stock, low_stock_threshold AS lowStockThreshold, origin, region, process, grade,
  is_available AS isAvailable, image,
  created_at AS createdAt, updated_at AS updatedAt
`;

const Product = {

  async findAll({ onlyAvailable = false } = {}) {
    const where = onlyAvailable ? 'WHERE is_available = 1' : '';
    const [rows] = await pool.execute(
      `SELECT ${PRODUCT_COLS} FROM products ${where} ORDER BY created_at DESC`
    );
    return rows;
  },

  async countAvailable() {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM products WHERE is_available = 1`
    );
    return rows[0].cnt;
  },

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT ${PRODUCT_COLS} FROM products WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  // ── findByIdWithLock — used inside transactions for stock checks ─
  async findByIdForUpdate(id, conn) {
    const [rows] = await conn.execute(
      `SELECT id, price_per_kg AS pricePerKg, min_order_kg AS minOrderKg,
              stock, is_available AS isAvailable, name
       FROM products WHERE id = ? LIMIT 1 FOR UPDATE`,
      [id]
    );
    return rows[0] || null;
  },

  async create(data, adminId = null) {
    const slug = makeSlug(data.name, Date.now().toString(36));
    const [result] = await pool.execute(`
      INSERT INTO products
        (name, slug, category, description, price_per_kg, min_order_kg,
         stock, low_stock_threshold, origin, region, process, grade, is_available, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.name.trim(), slug, data.category,
      data.description ? data.description.trim() : null,
      data.pricePerKg, data.minOrderKg ?? 1,
      data.stock ?? 0, data.lowStockThreshold ?? 100, data.origin ?? 'Ethiopia',
      data.region  ? data.region.trim()  : null,
      data.process ? data.process.trim() : null,
      data.grade   ? data.grade.trim()   : null,
      data.isAvailable !== false ? 1 : 0,
      data.image   ? data.image.trim()   : null,
    ]);

    // Stock history: record the starting quantity of a brand-new product
    const initial = Number(data.stock ?? 0);
    if (initial > 0) {
      try {
        await Stock.logMovement(pool, {
          productId: result.insertId, productName: data.name.trim(), type: 'initial',
          change: initial, before: 0, after: initial,
          reason: 'Initial stock when product was created', adminId,
        });
      } catch (e) {
        console.error('Stock history (initial) failed:', e.message);
      }
    }
    return Product.findById(result.insertId);
  },

  async update(id, data) {
    const fields = [];
    const values = [];

    if (data.name        !== undefined) { fields.push('name = ?', 'slug = ?'); values.push(data.name.trim(), makeSlug(data.name, id)); }
    if (data.category    !== undefined) { fields.push('category = ?');     values.push(data.category); }
    if (data.description !== undefined) { fields.push('description = ?');  values.push(data.description ? data.description.trim() : null); }
    if (data.pricePerKg  !== undefined) { fields.push('price_per_kg = ?'); values.push(Number(data.pricePerKg)); }
    if (data.minOrderKg  !== undefined) { fields.push('min_order_kg = ?'); values.push(Number(data.minOrderKg)); }
    if (data.stock       !== undefined) { fields.push('stock = ?');        values.push(Number(data.stock)); }
    if (data.lowStockThreshold !== undefined) { fields.push('low_stock_threshold = ?'); values.push(Number(data.lowStockThreshold)); }
    if (data.region      !== undefined) { fields.push('region = ?');       values.push(data.region ? data.region.trim() : null); }
    if (data.process     !== undefined) { fields.push('process = ?');      values.push(data.process ? data.process.trim() : null); }
    if (data.grade       !== undefined) { fields.push('grade = ?');        values.push(data.grade ? data.grade.trim() : null); }
    if (data.isAvailable !== undefined) { fields.push('is_available = ?'); values.push(data.isAvailable ? 1 : 0); }
    if (data.image       !== undefined) { fields.push('image = ?');        values.push(data.image ? data.image.trim() : null); }

    if (fields.length === 0) return Product.findById(id);

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    // Keep the stock-history name snapshot current, so history still reads
    // correctly if the product is deleted later. (Sale/order receipts keep
    // the name and price from the time of sale on purpose.)
    if (data.name !== undefined) {
      await pool.execute(
        `UPDATE stock_movements SET product_name = ? WHERE product_id = ?`,
        [data.name.trim(), id]
      );
    }
    return Product.findById(id);
  },

  async deductStock(id, quantity, conn) {
    const [result] = await conn.execute(
      `UPDATE products SET stock = stock - ?, updated_at = NOW()
       WHERE id = ? AND stock >= ?`,
      [quantity, id, quantity]
    );
    return result.affectedRows > 0;  // false = insufficient stock
  },

 async delete(id) {
  const [result] = await pool.execute(
   'DELETE FROM products WHERE id = ?',
    [id]
  );

  return result.affectedRows > 0;
},


  async findBySlug(slug) {
    const [rows] = await pool.execute(
      `SELECT ${PRODUCT_COLS} FROM products WHERE slug = ? LIMIT 1`,
      [slug]
    );
    return rows[0] || null;
  },
};

module.exports = Product;
