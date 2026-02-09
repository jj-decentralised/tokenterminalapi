// =============================================================================
// db.js — PostgreSQL connection pool & query helpers (server-side only)
// =============================================================================
// Used by server.js and sync.js. NOT loaded in the browser.
//
// Requires: DATABASE_URL environment variable (provided by Railway PostgreSQL)
// =============================================================================

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;

function getPool() {
  if (!pool && DATABASE_URL) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      console.error('[db] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

// Test connection
async function testConnection() {
  const p = getPool();
  if (!p) return false;
  try {
    const res = await p.query('SELECT 1 AS ok');
    return res.rows[0].ok === 1;
  } catch (e) {
    console.error('[db] Connection test failed:', e.message);
    return false;
  }
}

// Check if schema is initialized
async function isInitialized() {
  const p = getPool();
  if (!p) return false;
  try {
    const res = await p.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'protocols') AS exists"
    );
    return res.rows[0].exists;
  } catch (e) {
    return false;
  }
}

// Run raw SQL (for schema init)
async function execSQL(sql) {
  const p = getPool();
  if (!p) throw new Error('No database connection');
  await p.query(sql);
}

// Query helper
async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('No database connection');
  return p.query(text, params);
}

// Get a client for transactions
async function getClient() {
  const p = getPool();
  if (!p) throw new Error('No database connection');
  return p.connect();
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  testConnection,
  isInitialized,
  execSQL,
  query,
  getClient,
  close,
  get isConfigured() { return !!DATABASE_URL; },
};
