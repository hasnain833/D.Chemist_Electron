/**
 * repositories/saleRepository.cjs
 * Port of C# SaleRepository – Sales & SaleItems CRUD + billing logic.
 */
const { query, queryOne, getPool } = require('../pool.cjs');
const AuditRepo = require('./auditRepository.cjs');

const SaleRepository = {
  async getAll({ startDate, endDate, status } = {}) {
    let sql = `
      SELECT s.id, s.bill_no, s.user_id, s.customer_id, s.total_amount, s.tax_amount,
        s.discount_amount, s.grand_total, s.sale_date, s.status, s.fbr_reported,
        u.full_name AS cashier_name,
        c.customer_name
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE 1=1
    `;
    const params = [];
    if (startDate) { params.push(startDate); sql += ` AND s.sale_date >= $${params.length}`; }
    if (endDate)   { params.push(endDate);   sql += ` AND s.sale_date <= $${params.length}`; }
    if (status)    { params.push(status);    sql += ` AND s.status = $${params.length}`; }
    sql += ` ORDER BY s.sale_date DESC`;
    return query(sql, params);
  },

  async getById(id) {
    const sale = await queryOne(`
      SELECT s.*, u.full_name AS cashier_name, c.customer_name
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.id = $1
    `, [id]);
    if (!sale) return null;
    sale.items = await query(`
      SELECT si.*, m.name AS medicine_name, COALESCE(ib.unit_cost, 0) AS purchase_price
      FROM sale_items si
      LEFT JOIN medicines m ON m.id = si.medicine_id
      LEFT JOIN inventory_batches ib ON ib.id = si.batch_id
      WHERE si.sale_id = $1
    `, [id]);
    return sale;
  },

  /** Create a full sale with items in a single transaction with FIFO stock deduction. */
  async createSale({ billNo, userId, customerId, totalAmount, taxAmount, discountAmount, grandTotal, items, fbrReported = false, fbrInvoiceNo = null, fbrResponse = null }) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      // 1. Pre-validation (Stock Check)
      for (const item of items) {
        if (!item.medicineId) continue;

        const stockRow = await client.query(`
          SELECT COALESCE(SUM(remaining_units), 0) AS available
          FROM inventory_batches
          WHERE medicine_id = $1 AND remaining_units > 0
        `, [item.medicineId]);

        const available = parseInt(stockRow.rows[0].available);
        if (available < item.quantity) {
          throw new Error(`Insufficient stock for "${item.medicineName}". Available: ${available}, Requested: ${item.quantity}`);
        }
      }

      // 2. Insert Sale Record
      const saleRes = await client.query(`
        INSERT INTO sales (bill_no, user_id, customer_id, total_amount, tax_amount, discount_amount, grand_total, fbr_reported, fbr_invoice_no, fbr_response)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
      `, [billNo, userId, customerId, totalAmount, taxAmount, discountAmount, grandTotal, fbrReported, fbrInvoiceNo, fbrResponse]);
      const saleId = saleRes.rows[0].id;

      // 3. Insert Sale Items & Deduct Stock (FIFO)
      for (const item of items) {
        // We will insert multiple sale_items entries if the quantity spans multiple batches, 
        // OR we follow the C# pattern of recording one sale_item but linking it to the primary batch and deducting from others.
        // Actually, the original C# code links a single sale_item to ONE batchId but then deducts from multiple. 
        // Wait, if it spans multiple batches, which batchId does it store in sale_items?
        // Let's re-read SaleRepository.cs:70-116.
        // It inserts ONE sale_item with a batchId (likely the first one found or passed in) 
        // then loops through available batches to deduct.
        
        // Find batches to deduct from (FIFO: expiry_date ASC, created_at ASC)
        const batchesRes = await client.query(`
          SELECT id, remaining_units 
          FROM inventory_batches 
          WHERE medicine_id = $1 AND remaining_units > 0 
          ORDER BY expiry_date ASC, created_at ASC 
          FOR UPDATE
        `, [item.medicineId]);

        let remainingToDeduct = item.quantity;
        let primaryBatchId = item.batchId; // Use provided batchId as primary if available

        for (const batch of batchesRes.rows) {
          if (remainingToDeduct <= 0) break;
          
          if (!primaryBatchId) primaryBatchId = batch.id;

          const deductFromBatch = Math.min(remainingToDeduct, batch.remaining_units);
          await client.query(`UPDATE inventory_batches SET remaining_units = remaining_units - $1 WHERE id = $2`, [deductFromBatch, batch.id]);
          remainingToDeduct -= deductFromBatch;
        }

        if (remainingToDeduct > 0) {
          throw new Error(`Insufficient total stock for "${item.medicineName}" during processing.`);
        }

        await client.query(`
          INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, subtotal)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [saleId, item.medicineId, primaryBatchId, item.quantity, item.unitPrice, item.subtotal]);
      }

      await client.query('COMMIT');
      
      // Audit Log
      await AuditRepo.log({
        userId,
        action: 'Sale Created',
        details: `Bill No: ${billNo}, Total: ${grandTotal}`
      });

      return { id: saleId, billNo };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Void a sale and restore all inventory. */
  async voidSale(billNo, userId) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      const sale = await queryOne(`SELECT id, status, grand_total FROM sales WHERE bill_no = $1`, [billNo]);
      if (!sale) throw new Error('Sale not found.');
      if (sale.status === 'Voided') throw new Error('Sale is already voided.');

      // 1. Update Sale Status
      await client.query(`UPDATE sales SET status = 'Voided' WHERE id = $1`, [sale.id]);

      // 2. Restore Inventory
      const items = await query(`SELECT medicine_id, batch_id, quantity FROM sale_items WHERE sale_id = $1`, [sale.id]);
      for (const item of items) {
        if (item.batch_id) {
          await client.query(`UPDATE inventory_batches SET remaining_units = remaining_units + $1 WHERE id = $2`, [item.quantity, item.batch_id]);
        } else if (item.medicine_id) {
          // Fallback: Restore to the latest batch of this medicine
          await client.query(`
            UPDATE inventory_batches 
            SET remaining_units = remaining_units + $1 
            WHERE id = (
              SELECT id FROM inventory_batches 
              WHERE medicine_id = $2 
              ORDER BY expiry_date DESC LIMIT 1
            )
          `, [item.quantity, item.medicine_id]);
        }
      }

      await client.query('COMMIT');

      await AuditRepo.log({
        userId,
        action: 'Sale Voided',
        details: `Bill No: ${billNo} voided. Stock restored.`
      });

      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Returns a sale + its items, restores batch quantities, marks sale as Returned. */
  async processReturn(saleId, returnedItems, userId) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      let totalDeduction = 0;

      for (const ri of returnedItems) {
        // Fetch item to get price
        const item = await client.query(`SELECT medicine_id, unit_price FROM sale_items WHERE id = $1`, [ri.saleItemId]);
        const unitPrice = parseFloat(item.rows[0].unit_price);
        totalDeduction += (ri.returnQty * unitPrice);

        await client.query(`
          UPDATE sale_items SET returned_qty = returned_qty + $1 WHERE id = $2
        `, [ri.returnQty, ri.saleItemId]);

        if (ri.batchId) {
          await client.query(`
            UPDATE inventory_batches SET remaining_units = remaining_units + $1 WHERE id = $2
          `, [ri.returnQty, ri.batchId]);
        }
      }

      await client.query(`
        UPDATE sales 
        SET total_amount = total_amount - $1,
            grand_total = grand_total - $1,
            status = 'Returned' 
        WHERE id = $2
      `, [totalDeduction, saleId]);

      await client.query('COMMIT');

      await AuditRepo.log({
        userId,
        action: 'Item Returned',
        details: `Returned items for Sale ID: ${saleId}. Total adjusted by -${totalDeduction}`
      });

      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async purgeSalesData(userId) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE sale_items RESTART IDENTITY CASCADE');
      await client.query('TRUNCATE TABLE sales RESTART IDENTITY CASCADE');
      await client.query('UPDATE inventory_batches SET remaining_units = quantity_units');
      await client.query('COMMIT');

      await AuditRepo.log({
        userId,
        action: 'Sales Purged',
        details: 'All sales data removed. Inventory reset to original levels.'
      });
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async generateBillNo() {
    const row = await queryOne(`SELECT 'B-' || LPAD((COALESCE(MAX(id),0)+1)::TEXT, 6, '0') AS bill_no FROM sales`);
    return row.bill_no;
  },
};

module.exports = SaleRepository;

