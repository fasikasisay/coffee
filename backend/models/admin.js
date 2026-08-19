const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../config/db');

// ── All Admin DB operations 
const Admin = {

  // ── Find admin by email, optionally selecting the hashed password ──
  async findByEmail(email, includePassword = false) {
    const cols = includePassword
      ? 'id, name, email, password, role, is_active AS isActive, last_login AS lastLogin, created_at AS createdAt, updated_at AS updatedAt'
      : 'id, name, email,           role, is_active AS isActive, last_login AS lastLogin, created_at AS createdAt, updated_at AS updatedAt';

    const [rows] = await pool.execute(
      `SELECT ${cols} FROM admins WHERE email = ? LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  },

  // ── Find admin by primary key 
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT id, name, email, role,
              is_active AS isActive,
              last_login AS lastLogin,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM admins WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  // ── Create a new admin (password is hashed here) 
  async create({ name, email, password, role = 'admin' }) {
    const salt   = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);

    const [result] = await pool.execute(
      `INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)`,
      [name.trim(), email.toLowerCase().trim(), hashed, role]
    );
    return Admin.findById(result.insertId);
  },

  // ── Update last_login timestamp 
  async updateLastLogin(id) {
    await pool.execute(
      `UPDATE admins SET last_login = NOW(), updated_at = NOW() WHERE id = ?`,
      [id]
    );
  },

  // ── Update password (re-hash before storing) 
  async updatePassword(id, newPassword) {
    const salt   = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(newPassword, salt);
    await pool.execute(
      `UPDATE admins SET password = ?, updated_at = NOW() WHERE id = ?`,
      [hashed, id]
    );
  },

  // ── Get raw hashed password for comparison 
  async getPasswordById(id) {
    const [rows] = await pool.execute(
      `SELECT password FROM admins WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0]?.password || null;
  },

  
  matchPassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  },

  getSignedJwtToken(admin) {
    return jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
  },
};

module.exports = Admin;
