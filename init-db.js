// =============================================================================
// init-db.js — Initialize PostgreSQL schema
// =============================================================================
// Reads schema.sql and executes it. Safe to run multiple times (uses IF NOT EXISTS).
// Called automatically by server.js on startup if DB is not yet initialized.
//
// Can also be run manually: node init-db.js
// =============================================================================

const fs = require('fs');
const path = require('path');
const db = require('./db');

// We need CREATE TABLE IF NOT EXISTS instead of plain CREATE TABLE
// to make this idempotent. Transform the schema.sql accordingly.
function makeIdempotent(sql) {
  return sql
    .replace(/CREATE TABLE (\w+)/g, 'CREATE TABLE IF NOT EXISTS $1')
    .replace(/CREATE INDEX (\w+)/g, 'CREATE INDEX IF NOT EXISTS $1')
    .replace(/CREATE UNIQUE INDEX (\w+)/g, 'CREATE UNIQUE INDEX IF NOT EXISTS $1')
    .replace(/CREATE MATERIALIZED VIEW (\w+)/g, 'CREATE MATERIALIZED VIEW IF NOT EXISTS $1');
}

async function initDB() {
  if (!db.isConfigured) {
    console.log('[init-db] No DATABASE_URL configured, skipping');
    return false;
  }

  const connected = await db.testConnection();
  if (!connected) {
    console.error('[init-db] Cannot connect to database');
    return false;
  }

  const initialized = await db.isInitialized();
  if (initialized) {
    console.log('[init-db] Schema already exists, skipping');
    return true;
  }

  console.log('[init-db] Initializing database schema...');

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    let sql = fs.readFileSync(schemaPath, 'utf8');
    sql = makeIdempotent(sql);

    // Split on semicolons and execute each statement
    // (pg client can handle multi-statement, but splitting is safer)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (e) {
          // Skip errors for things like duplicate inserts on re-run
          if (e.code === '42P07' || // duplicate_table
              e.code === '42710' || // duplicate_object
              e.code === '23505') { // unique_violation
            continue;
          }
          console.warn('[init-db] Statement warning:', e.message.slice(0, 120));
        }
      }
      await client.query('COMMIT');
      console.log('[init-db] Schema initialized successfully');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[init-db] Failed:', e.message);
    return false;
  }
}

// Allow running directly: node init-db.js
if (require.main === module) {
  initDB().then((ok) => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { initDB };
