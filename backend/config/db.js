const mysql = require('mysql2/promise');

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'JWT_COOKIE_EXPIRE'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`❌  Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

// JWT_SECRET 
if (process.env.JWT_SECRET.length < 32) {
  console.error('❌  JWT_SECRET is too short — minimum 32 characters required');
  process.exit(1);
}

// JWT_COOKIE_EXPIRE 
const _cookieExpireDays = Number(process.env.JWT_COOKIE_EXPIRE);
if (!Number.isFinite(_cookieExpireDays) || _cookieExpireDays <= 0) {
  console.error('❌  JWT_COOKIE_EXPIRE must be a positive number (days, e.g. 7)');
  process.exit(1);
}

// ── Connection pool 
const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  ssl:                process.env.DB_SSL === 'true'
                        ? { rejectUnauthorized: true }
                        : undefined,
  waitForConnections: true,
  connectionLimit:    Number(process.env.DB_POOL_LIMIT) || 10,
  queueLimit:         0,
  timezone:           '+00:00',   
  decimalNumbers:     true,       
  dateStrings:        false,    
  
  connectTimeout:     10_000,
});

// Verify connectivity at startup 
const connectDB = async () => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT VERSION() AS version');
    conn.release();
    // Only show version in development to avoid leaking DB details
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅  MySQL connected  (${rows[0].version})`);
    } else {
      console.log('✅  MySQL connected');
    }
  } catch (err) {
    console.error(`❌  MySQL connection error: ${err.message}`);
    process.exit(1);
  }
};

// ── Graceful shutdown on both SIGINT and SIGTERM
const shutdown = async (signal) => {
  console.log(`\n${signal} received — closing MySQL pool…`);
  try { await pool.end(); } catch {}
  process.exit(0);
};
process.once('SIGINT',  () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { pool, connectDB };
 