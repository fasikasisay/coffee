const { pool } = require('../config/db');


const Order = {

  async count() {
    const [rows] = await pool.execute(`SELECT COUNT(*) AS cnt FROM orders`);
    return rows[0].cnt;
  },

  async countInRange(from, to) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM orders WHERE created_at >= ? AND created_at < ?`,
      [from, to]
    );
    return rows[0].cnt;
  },

  async totalRevenue() {
    const [rows] = await pool.execute(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM orders WHERE status != 'cancelled'
    `);
    return Number(rows[0].total);
  },

  async countByStatus() {
    const [rows] = await pool.execute(
      `SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status`
    );
    return rows.reduce((acc, r) => { acc[r.status] = r.cnt; return acc; }, {});
  },

  async findRecent(limit = 5) {
    const [rows] = await pool.execute(`
      SELECT id, order_number AS orderNumber,
             customer_name  AS customerName,
             total_amount   AS totalAmount,
             status, created_at AS createdAt
      FROM orders
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);

    return rows.map(r => ({
      id:          r.id,
      orderNumber: r.orderNumber,
      customer:    { name: r.customerName },
      totalAmount: Number(r.totalAmount),
      status:      r.status,
      createdAt:   r.createdAt,
    }));
  },

  async findById(id) {
    const [[order]] = await pool.execute(`
      SELECT id, order_number AS orderNumber,
             customer_name    AS customerName,
             customer_email   AS customerEmail,
             customer_company AS customerCompany,
             customer_country AS customerCountry,
             customer_phone   AS customerPhone,
             total_amount     AS totalAmount,
             status, notes,
             shipping_street, shipping_city,
             shipping_country, shipping_postal_code AS shippingPostalCode,
             created_at AS createdAt, updated_at AS updatedAt
      FROM orders WHERE id = ? LIMIT 1
    `, [id]);
    if (!order) return null;

    const [items] = await pool.execute(`
      SELECT id, product_id AS productId, name,
             quantity, unit_price AS unitPrice
      FROM order_items WHERE order_id = ?
    `, [id]);

    return Order._shape(order, items);
  },

  async findAll() {
    const [orders] = await pool.execute(`
      SELECT id, order_number AS orderNumber,
             customer_name    AS customerName,
             customer_email   AS customerEmail,
             customer_company AS customerCompany,
             customer_country AS customerCountry,
             customer_phone   AS customerPhone,
             total_amount     AS totalAmount,
             status, notes,
             shipping_street, shipping_city,
             shipping_country, shipping_postal_code AS shippingPostalCode,
             created_at AS createdAt, updated_at AS updatedAt
      FROM orders ORDER BY created_at DESC
    `);
    if (orders.length === 0) return [];

    const ids = orders.map(o => o.id);

    // pool.query (not execute) supports IN(?) array expansion safely
    const placeholders = ids.map(() => '?').join(',');
    const [allItems] = await pool.execute(
      `SELECT id, order_id AS orderId, product_id AS productId,
              name, quantity, unit_price AS unitPrice
       FROM order_items WHERE order_id IN (${placeholders})`,
      ids
    );

    const itemsByOrder = {};
    allItems.forEach(item => {
      if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
      itemsByOrder[item.orderId].push(item);
    });

    return orders.map(o => Order._shape(o, itemsByOrder[o.id] || []));
  },
  
  async updateStatus(id, status) {
    const [result] = await pool.execute(
      `UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );
    if (result.affectedRows === 0) return null;
    return Order.findById(id);
  },

  _shape(o, items) {
    return {
      id:          o.id,
      orderNumber: o.orderNumber,
      customer: {
        name:    o.customerName,
        email:   o.customerEmail,
        company: o.customerCompany,
        country: o.customerCountry,
        phone:   o.customerPhone,
      },
      items: items.map(i => ({
        id:        i.id,
        productId: i.productId,
        name:      i.name,
        quantity:  i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      totalAmount: Number(o.totalAmount),
      status:      o.status,
      notes:       o.notes,
      shippingAddress: {
        street:     o.shipping_street,
        city:       o.shipping_city,
        country:    o.shipping_country,
        postalCode: o.shippingPostalCode,
      },
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  },
};

module.exports = Order;
