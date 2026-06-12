-- Base schema script for D.Chemist database
-- Creates all base tables and indexes

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50) NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    full_name   TEXT NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'Admin',
    status      VARCHAR(20) NOT NULL DEFAULT 'Active',
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manufacturers (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    phone       TEXT,
    address     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicines (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    generic_name    TEXT,
    category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    manufacturer_id INTEGER REFERENCES manufacturers(id) ON DELETE SET NULL,
    dosage_form     TEXT,
    strength        TEXT,
    barcode         TEXT UNIQUE,
    units_per_pack  INTEGER NOT NULL DEFAULT 1,
    packets_per_box INTEGER NOT NULL DEFAULT 1,
    default_entry_mode TEXT NOT NULL DEFAULT 'Tablet',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    id                    SERIAL PRIMARY KEY,
    medicine_id           INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    supplier_id           INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
    batch_no              TEXT NOT NULL,
    quantity_units        INTEGER NOT NULL DEFAULT 0,
    purchase_total_price  DECIMAL NOT NULL DEFAULT 0,
    unit_cost             DECIMAL NOT NULL DEFAULT 0,
    selling_price         DECIMAL NOT NULL DEFAULT 0,
    remaining_units       INTEGER NOT NULL DEFAULT 0,
    manufacture_date      DATE,
    expiry_date           DATE NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id              SERIAL PRIMARY KEY,
    customer_name   TEXT NOT NULL,
    phone           TEXT,
    email           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
    id                SERIAL PRIMARY KEY,
    bill_no           TEXT NOT NULL UNIQUE,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    customer_id       INTEGER REFERENCES customers(id),
    total_amount      DECIMAL NOT NULL DEFAULT 0,
    tax_amount        DECIMAL NOT NULL DEFAULT 0,
    discount_amount   DECIMAL NOT NULL DEFAULT 0,
    grand_total       DECIMAL NOT NULL DEFAULT 0,
    fbr_reported      BOOLEAN NOT NULL DEFAULT FALSE,
    fbr_invoice_no    TEXT UNIQUE,
    fbr_response      TEXT,
    status            VARCHAR(20) NOT NULL DEFAULT 'Completed',
    sale_date         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
    id            SERIAL PRIMARY KEY,
    sale_id       INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    medicine_id   INTEGER REFERENCES medicines(id),
    batch_id      INTEGER REFERENCES inventory_batches(id),
    quantity      INTEGER NOT NULL DEFAULT 0,
    unit_price    DECIMAL NOT NULL,
    subtotal      DECIMAL NOT NULL,
    returned_qty  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_medicines_name_lower ON medicines(lower(name));
CREATE INDEX IF NOT EXISTS idx_medicines_generic_lower ON medicines(lower(generic_name));
CREATE INDEX IF NOT EXISTS idx_batches_medicine_id ON inventory_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_desc ON sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(50) NOT NULL,
    details     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS error_logs (
    id          SERIAL PRIMARY KEY,
    message     TEXT NOT NULL,
    stack_trace TEXT,
    source      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
