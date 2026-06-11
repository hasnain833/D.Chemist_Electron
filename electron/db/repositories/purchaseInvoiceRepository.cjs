const { query, getPool } = require('../pool.cjs');

const PurchaseInvoiceRepository = {
  async getAll() {
    return query(`
      SELECT i.*, s.name as supplier_name
      FROM purchase_invoices i
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      ORDER BY i.invoice_date DESC
      LIMIT 500
    `);
  },

  async getInvoiceItems(invoiceId) {
    return query(`
      SELECT b.*, m.name as medicine_name, m.packets_per_box as packets_per_box
      FROM inventory_batches b
      JOIN medicines m ON m.id = b.medicine_id
      WHERE b.purchase_invoice_id = $1
    `, [invoiceId]);
  },

  async search(invoiceNo, supplierName, date) {
    let sql = `
      SELECT i.*, s.name as supplier_name
      FROM purchase_invoices i
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (invoiceNo) {
      sql += ` AND i.invoice_no ILIKE $${paramIndex++}`;
      params.push(`%${invoiceNo}%`);
    }
    if (supplierName) {
      sql += ` AND s.name ILIKE $${paramIndex++}`;
      params.push(`%${supplierName}%`);
    }
    if (date) {
      sql += ` AND i.invoice_date::date = $${paramIndex++}`;
      params.push(date);
    }

    sql += ` ORDER BY i.invoice_date DESC LIMIT 500`;
    return query(sql, params);
  },

  async delete(invoiceId) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE inventory_batches SET purchase_invoice_id = NULL WHERE purchase_invoice_id = $1`, [invoiceId]);
      await client.query(`DELETE FROM purchase_invoices WHERE id = $1`, [invoiceId]);
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async cleanupFullySoldInvoices() {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const findQuery = `
        SELECT i.id
        FROM purchase_invoices i
        WHERE EXISTS (
            SELECT 1 FROM inventory_batches b WHERE b.purchase_invoice_id = i.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM inventory_batches b 
            WHERE b.purchase_invoice_id = i.id AND b.remaining_units > 0
        )
      `;
      const res = await client.query(findQuery);
      if (res.rows.length > 0) {
        const ids = res.rows.map(r => r.id);
        await client.query(`UPDATE inventory_batches SET purchase_invoice_id = NULL WHERE purchase_invoice_id = ANY($1::int[])`, [ids]);
        const deleted = await client.query(`DELETE FROM purchase_invoices WHERE id = ANY($1::int[])`, [ids]);
        await client.query('COMMIT');
        return deleted.rowCount;
      }
      await client.query('COMMIT');
      return 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateInvoiceItems(invoiceId, items) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      for (const item of items) {
        let qtyDiff = item.editTotalUnits - item.originalQuantityUnits;
        let newRemaining = item.originalRemainingUnits + qtyDiff;
        if (newRemaining < 0) newRemaining = 0;

        let unitCost = item.editTotalUnits > 0 ? item.editTotalCost / item.editTotalUnits : 0;

        await client.query(`
          UPDATE inventory_batches
          SET batch_no = $1,
              quantity_units = $2,
              remaining_units = $3,
              purchase_total_price = $4,
              unit_cost = $5,
              pack_quantity = $6
          WHERE id = $7
        `, [
          item.editBatchNo,
          item.editTotalUnits,
          newRemaining,
          item.editTotalCost,
          unitCost,
          item.editPackQuantity,
          item.batchId
        ]);
      }

      await client.query(`
        UPDATE purchase_invoices
        SET total_amount = (
            SELECT COALESCE(SUM(purchase_total_price), 0)
            FROM inventory_batches
            WHERE purchase_invoice_id = $1
        )
        WHERE id = $1
      `, [invoiceId]);

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async processStockIn(supplierName, invoiceNo, date, items) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      // 1. Get or Create Supplier
      let supplierRes = await client.query(`SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1) LIMIT 1`, [supplierName]);
      let supplierId;
      if (supplierRes.rows.length === 0) {
        const insSupp = await client.query(`INSERT INTO suppliers (name) VALUES ($1) RETURNING id`, [supplierName]);
        supplierId = insSupp.rows[0].id;
      } else {
        supplierId = supplierRes.rows[0].id;
      }

      // 2. Create Purchase Invoice
      const totalAmount = items.reduce((acc, i) => acc + i.purchaseTotalPrice, 0);
      const invRes = await client.query(`
        INSERT INTO purchase_invoices (invoice_no, supplier_id, invoice_date, total_amount, status)
        VALUES ($1, $2, $3, $4, 'Completed')
        RETURNING id
      `, [invoiceNo, supplierId, date, totalAmount]);
      const invoiceId = invRes.rows[0].id;

      // 3. Process items
      for (const item of items) {
        const medRes = await client.query(`SELECT packets_per_box, units_per_pack, name FROM medicines WHERE id = $1`, [item.medicineId]);
        const med = medRes.rows[0];
        if (!med) continue;

        let packetsPerBox = med.packets_per_box || 1;
        let unitsPerPack = med.units_per_pack || 1;
        let medicineName = med.name || item.medicineName;

        let totalUnits = item.entryMode === "Box"
          ? item.packQuantity * packetsPerBox * unitsPerPack
          : item.packQuantity;

        let unitCost = totalUnits > 0 ? item.purchaseTotalPrice / totalUnits : 0;

        const batchRes = await client.query(`
          SELECT id, batch_no, quantity_units, purchase_total_price, unit_cost
          FROM inventory_batches
          WHERE medicine_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [item.medicineId]);
        const existingBatch = batchRes.rows[0];

        if (!existingBatch) {
          // PATH A: First-ever purchase
          await client.query(`
            INSERT INTO inventory_batches (
                medicine_id, supplier_id, batch_no, quantity_units,
                purchase_total_price, unit_cost, selling_price,
                remaining_units, expiry_date, invoice_no, invoice_date,
                entry_mode, units_per_pack, pack_quantity, purchase_invoice_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            item.medicineId, supplierId, item.batchNo, totalUnits,
            item.purchaseTotalPrice, unitCost, item.sellingPricePerUnit,
            totalUnits, item.expiryDate, invoiceNo, date,
            item.entryMode, unitsPerPack, item.packQuantity, invoiceId
          ]);
        } else {
          let batchId = existingBatch.id;
          let oldBatchNo = existingBatch.batch_no;
          let sameNo = oldBatchNo.toLowerCase() === item.batchNo.toLowerCase();

          if (!sameNo) {
            // PATH B: Different batch number, archive old
            // Assuming there's a batch_history table
            await client.query(`
              INSERT INTO batch_history (
                  medicine_id, medicine_name, old_batch_no, new_batch_no,
                  supplier_id, supplier_name, invoice_no, invoice_date,
                  quantity_units, purchase_total_price, unit_cost, inventory_batch_id, change_reason
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
              item.medicineId, medicineName, oldBatchNo, item.batchNo,
              supplierId, supplierName, invoiceNo, date,
              existingBatch.quantity_units || 0, existingBatch.purchase_total_price || 0,
              existingBatch.unit_cost || 0, batchId,
              `New purchase with batch '${item.batchNo}' replaced old batch '${oldBatchNo}' — archived for drug inspector traceability`
            ]).catch(() => { /* ignore if table not exists yet */ });

            await client.query(`
              UPDATE inventory_batches
              SET batch_no = $1,
              quantity_units = quantity_units + $2,
              remaining_units = remaining_units + $3,
              purchase_total_price = $4,
              unit_cost = $5,
              selling_price = $6,
              pack_quantity = pack_quantity + $7,
              entry_mode = $8,
              units_per_pack = $9,
              purchase_invoice_id = $10,
              expiry_date = $11,
              invoice_no = $12,
              invoice_date = $13
              WHERE id = $14
                `, [
              item.batchNo, totalUnits, totalUnits, item.purchaseTotalPrice, unitCost,
              item.sellingPricePerUnit, item.packQuantity, item.entryMode, unitsPerPack,
              invoiceId, item.expiryDate, invoiceNo, date, batchId
            ]);
          } else {
            // PATH C: Exact same batch
            await client.query(`
              UPDATE inventory_batches
              SET quantity_units = quantity_units + $1,
              remaining_units = remaining_units + $2,
              purchase_total_price = $3,
              unit_cost = $4,
              selling_price = $5,
              pack_quantity = pack_quantity + $6,
              entry_mode = $7,
              units_per_pack = $8,
              purchase_invoice_id = $9,
              expiry_date = $10
              WHERE id = $11
                `, [
              totalUnits, totalUnits, item.purchaseTotalPrice, unitCost, item.sellingPricePerUnit,
              item.packQuantity, item.entryMode, unitsPerPack, invoiceId, item.expiryDate, batchId
            ]);
          }
        }
      }

      await client.query('COMMIT');
      return invoiceId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
};

module.exports = PurchaseInvoiceRepository;
