const { pool } = require('../config/db');

const ENQUIRY_COLS = `
  id, name, email, message, status,
  created_at AS createdAt, updated_at AS updatedAt
`;

const Enquiry = {

  async create(data) {
    const [result] = await pool.execute(
      `INSERT INTO enquiries (name, email, message) VALUES (?, ?, ?)`,
      [data.name.trim(), data.email.trim().toLowerCase(), data.message.trim()]
    );
    return Enquiry.findById(result.insertId);
  },

  async findAll() {
    const [rows] = await pool.execute(
      `SELECT ${ENQUIRY_COLS} FROM enquiries ORDER BY created_at DESC`
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT ${ENQUIRY_COLS} FROM enquiries WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async updateStatus(id, status) {
    await pool.execute(
      `UPDATE enquiries SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );
    return Enquiry.findById(id);
  },
};

module.exports = Enquiry;
