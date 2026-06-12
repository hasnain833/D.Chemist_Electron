const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

/**
 * Initializes the database schema, versioned migrations, and default seed data.
 * @param {object} cfg { host, port, database, user, password }
 */
async function initDbAndSchema(cfg) {
  console.log(`[DB Init] Starting DB initialization for host: ${cfg.host}, port: ${cfg.port}, database: ${cfg.database}`);

  // 1. Ensure Database Exists (Connect to system 'postgres' DB)
  const sysClient = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: 'postgres'
  });

  try {
    await sysClient.connect();
    // Query database list
    const checkDbRes = await sysClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [cfg.database]
    );

    if (checkDbRes.rows.length === 0) {
      console.log(`[DB Init] Database "${cfg.database}" does not exist. Creating...`);
      // PostgreSQL doesn't support parameterized CREATE DATABASE.
      // Since database name is loaded from secure local store settings, we interpolate it.
      await sysClient.query(`CREATE DATABASE "${cfg.database}"`);
      console.log(`[DB Init] Database "${cfg.database}" created successfully.`);
    } else {
      console.log(`[DB Init] Database "${cfg.database}" already exists.`);
    }
  } catch (err) {
    console.error('[DB Init] Error checking/creating database:', err);
    throw err;
  } finally {
    await sysClient.end();
  }

  // 2. Connect to the application database to run migrations
  const appClient = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database
  });

  try {
    await appClient.connect();

    // Ensure schema_migrations table exists
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Apply versioned migrations in order
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`[DB Init] Migrations directory not found at: ${migrationsDir}`);
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      // Check if migration has already been applied
      const checkMigrationRes = await appClient.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1',
        [file]
      );

      if (checkMigrationRes.rows.length > 0) {
        console.log(`[DB Init] Migration already applied: ${file}`);
        continue;
      }

      console.log(`[DB Init] Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      // Execute migration within a transaction
      await appClient.query('BEGIN');
      try {
        await appClient.query(sql);
        await appClient.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await appClient.query('COMMIT');
        console.log(`[DB Init] Migration completed: ${file}`);
      } catch (migrationErr) {
        await appClient.query('ROLLBACK');
        console.error(`[DB Init] Error applying migration ${file}. Transaction rolled back.`, migrationErr);
        throw migrationErr;
      }
    }

    // 4. Ensure settings table exists & defaults are present
    await appClient.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    
    const settingsDefaults = [
      { key: 'tax_rate', value: '0.0' },
      { key: 'fbr_pos_id', value: 'DChemist-POS-001' },
      { key: 'fbr_api_url', value: 'https://ims.fbr.gov.pk/api/v3/Post/PostInvoice' },
      { key: 'fbr_is_live', value: 'false' },
      { key: 'fbr_token', value: '' }
    ];

    for (const s of settingsDefaults) {
      await appClient.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [s.key, s.value]
      );
    }

    // 5. Ensure default Admin user exists
    const checkAdminRes = await appClient.query(
      "SELECT id FROM users WHERE LOWER(username) = 'admin' LIMIT 1"
    );

    if (checkAdminRes.rows.length === 0) {
      console.log('[DB Init] Creating default Admin user...');
      const hashedPassword = await bcrypt.hash('@dmin8787', 10);
      await appClient.query(
        `INSERT INTO users (username, password, full_name, role, status, must_change_password)
         VALUES ('Admin', $1, 'Administrator', 'Admin', 'Active', TRUE)`,
        [hashedPassword]
      );
      console.log('[DB Init] Default Admin user created successfully.');
    }

    // 6. Seed sample data if database is empty
    const checkMedsRes = await appClient.query('SELECT COUNT(*) FROM medicines');
    const medsCount = parseInt(checkMedsRes.rows[0].count);

    if (medsCount === 0) {
      console.log('[DB Init] Database is empty. Seeding sample data...');
      await appClient.query('BEGIN');
      try {
        const catRes1 = await appClient.query("INSERT INTO categories (name) VALUES ('Pain Killer') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id");
        await appClient.query("INSERT INTO categories (name) VALUES ('Antibiotic') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name");
        await appClient.query("INSERT INTO categories (name) VALUES ('Cough Syrup') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name");
        
        const manRes1 = await appClient.query("INSERT INTO manufacturers (name) VALUES ('GSK') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id");
        await appClient.query("INSERT INTO manufacturers (name) VALUES ('Abbott') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name");
        await appClient.query("INSERT INTO manufacturers (name) VALUES ('Pfizer') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name");

        const supRes = await appClient.query("INSERT INTO suppliers (name, phone, address) VALUES ('ABC Pharma', '0300-1234567', 'Phase 6, Hayatabad, Peshawar') RETURNING id");

        const catId = catRes1.rows[0].id;
        const manId = manRes1.rows[0].id;
        const supId = supRes.rows[0].id;

        const medRes = await appClient.query(`
          INSERT INTO medicines (name, generic_name, category_id, manufacturer_id, dosage_form, strength, barcode)
          VALUES ('Panadol', 'Paracetamol', $1, $2, 'Tablet', '500mg', '625100123456')
          ON CONFLICT (barcode) DO NOTHING RETURNING id
        `, [catId, manId]);

        if (medRes.rows.length > 0) {
          const medId = medRes.rows[0].id;
          await appClient.query(`
            INSERT INTO inventory_batches (medicine_id, supplier_id, batch_no, quantity_units, purchase_total_price, unit_cost, selling_price, remaining_units, manufacture_date, expiry_date)
            VALUES ($1, $2, 'PK1023', 500, 750, 1.5, 2.0, 500, '2024-01-01', '2027-05-01')
          `, [medId, supId]);
        }

        await appClient.query('COMMIT');
        console.log('[DB Init] Seeding sample data completed successfully.');
      } catch (seedErr) {
        await appClient.query('ROLLBACK');
        console.error('[DB Init] Error seeding sample data:', seedErr);
        // Non-fatal, do not throw
      }
    }

    console.log('[DB Init] DB initialization completed successfully.');
  } catch (err) {
    console.error('[DB Init] Error during DB schema/migration init:', err);
    throw err;
  } finally {
    await appClient.end();
  }
}

module.exports = { initDbAndSchema };
