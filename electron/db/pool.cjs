/**
 * db/pool.cjs
 * Singleton PostgreSQL connection pool for the Electron main process.
 * Config is loaded from electron-store so the user can change it from Settings.
 */

const { Pool } = require('pg');

let _pool = null;

/**
 * Build (or rebuild) the pool from the supplied config object.
 * @param {object} cfg  { host, port, database, user, password }
 */
function createPool(cfg) {
  if (_pool) {
    _pool.end().catch(() => { }); // close old pool gracefully
  }
  _pool = new Pool({
    host: cfg.host || 'localhost',
    port: cfg.port || 5432,
    database: cfg.database || 'pharmacy',
    user: cfg.user || 'postgres',
    password: cfg.password || 'h4276246',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  _pool.on('error', (err) => {
    console.error('[DB Pool] Unexpected error on idle client:', err);
  });

  return _pool;
}

/**
 * Returns the active pool. Throws if not yet initialised.
 */
function getPool() {
  if (!_pool) throw new Error('DB pool has not been initialised. Call createPool() first.');
  return _pool;
}

/**
 * Convenience wrapper – executes a query and returns rows.
 */
async function query(sql, params = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Convenience wrapper – executes a query and returns a single row (or null).
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

async function closePool() {
  if (_pool) {
    try {
      await _pool.end();
    } catch (err) {
      // ignore
    }
    _pool = null;
  }
}

module.exports = { createPool, getPool, query, queryOne, closePool };

