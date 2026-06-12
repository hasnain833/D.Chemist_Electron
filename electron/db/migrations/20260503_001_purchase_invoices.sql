CREATE TABLE IF NOT EXISTS purchase_invoices (
    id                SERIAL PRIMARY KEY,
    invoice_no        TEXT NOT NULL UNIQUE,
    supplier_id       INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
    invoice_date      TIMESTAMPTZ NOT NULL,
    total_amount      DECIMAL NOT NULL DEFAULT 0,
    status            VARCHAR(20) NOT NULL DEFAULT 'Completed',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS purchase_invoice_id INTEGER REFERENCES purchase_invoices(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_no ON purchase_invoices(invoice_no);
