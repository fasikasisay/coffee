const { pool } = require('../config/db');

const Customer = {

  // Count active customers 
  async countActive() {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM customers WHERE is_active = 1`
    );
    return rows[0].cnt;
  },

  // ── Upsert by email (create or return existing) 
  async upsert({ name, email, company, country, phone }) {
    const [rows] = await pool.execute(
      `SELECT id FROM customers WHERE email = ? LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    if (rows.length > 0) {
      // Update details in case they changed
      await pool.execute(`
        UPDATE customers
        SET name = ?, company = ?, country = ?, phone = ?, updated_at = NOW()
        WHERE id = ?
      `, [name, company ?? null, country ?? null, phone ?? null, rows[0].id]);
      return rows[0].id;
    }

    const [result] = await pool.execute(`
      INSERT INTO customers (name, email, company, country, phone)
      VALUES (?, ?, ?, ?, ?)
    `, [name, email.toLowerCase().trim(), company ?? null, country ?? null, phone ?? null]);

    return result.insertId;
  },

  // ── Increment order stats after order creation 
  async incrementStats(id, amount) {
    await pool.execute(`
      UPDATE customers
      SET total_orders = total_orders + 1,
          total_spent  = total_spent  + ?,
          updated_at   = NOW()
      WHERE id = ?
    `, [amount, id]);
  },

  // ── Find all 
  async findAll() {
    const [rows] = await pool.execute(`
      SELECT id, name, email, company, country, phone,
             total_orders AS totalOrders,
             total_spent  AS totalSpent,
             notes, is_active AS isActive,
             created_at AS createdAt, updated_at AS updatedAt
      FROM customers
      ORDER BY created_at DESC
    `);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.execute(`
      SELECT id, name, email, company, country, phone,
             total_orders AS totalOrders,
             total_spent  AS totalSpent,
             notes, is_active AS isActive,
             created_at AS createdAt, updated_at AS updatedAt
      FROM customers WHERE id = ? LIMIT 1
    `, [id]);
    return rows[0] || null;
  },
};

module.exports = Customer;
