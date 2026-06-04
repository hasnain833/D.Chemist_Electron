/**
 * repositories/batchRepository.cjs
 * Port of C# BatchRepository / InventoryBatch operations.
 */
const { query, queryOne } = require('../pool.cjs');

const BatchRepository = {
  async getByMedicineId(medicineId) {
    return query(`
      SELECT b.*, s.name AS supplier_name
      FROM inventory_batches b
      LEFT JOIN suppliers s ON s.id = b.supplier_id
      WHERE b.medicine_id = $1
      ORDER BY b.expiry_date ASC
    `, [medicineId]);
  },

  async getExpiringBatches(daysAhead = 90) {
    return query(`
      SELECT b.id AS batch_id, m.id AS medicine_id, m.name AS medicine_name,
        b.batch_no, b.remaining_units AS total_units, b.expiry_date
      FROM inventory_batches b
      JOIN medicines m ON m.id = b.medicine_id
      WHERE b.expiry_date <= NOW() + ($1 || ' days')::INTERVAL
        AND b.remaining_units > 0
      ORDER BY b.expiry_date ASC
    `, [daysAhead]);
  },

  async getLowStockBatches(threshold = 10) {
    return query(`
      SELECT m.id AS medicine_id, m.name AS medicine_name,
        COALESCE(SUM(b.remaining_units), 0)::int AS total_units
      FROM medicines m
      LEFT JOIN inventory_batches b ON b.medicine_id = m.id
      GROUP BY m.id, m.name
      HAVING COALESCE(SUM(b.remaining_units), 0) <= $1
      ORDER BY total_units ASC
    `, [threshold]);
  },

  async create({ medicineId, supplierId, batchNo, quantityUnits, purchaseTotalPrice, unitCost, sellingPrice, manufactureDate, expiryDate, invoiceNo, invoiceDate }) {
    return queryOne(`
      INSERT INTO inventory_batches
        (medicine_id, supplier_id, batch_no, quantity_units, purchase_total_price, unit_cost, selling_price, remaining_units, manufacture_date, expiry_date, invoice_no, invoice_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$4,$8,$9,$10,$11)
      RETURNING id
    `, [medicineId, supplierId, batchNo, quantityUnits, purchaseTotalPrice, unitCost, sellingPrice, manufactureDate, expiryDate, invoiceNo, invoiceDate]);
  },

  async deductUnits(batchId, qty) {
    return query(`
      UPDATE inventory_batches
      SET remaining_units = remaining_units - $1
      WHERE id = $2
    `, [qty, batchId]);
  },

  async restoreUnits(batchId, qty) {
    return query(`
      UPDATE inventory_batches
      SET remaining_units = remaining_units + $1
      WHERE id = $2
    `, [qty, batchId]);
  },

  async delete(id) {
    return query(`DELETE FROM inventory_batches WHERE id = $1`, [id]);
  },

  async updateStockManual(batchId, newQty, reason, userId) {
    const batch = await queryOne(`SELECT medicine_id, remaining_units FROM inventory_batches WHERE id = $1`, [batchId]);
    if (!batch) throw new Error('Batch not found');

    const oldQty = batch.remaining_units;
    await query(`UPDATE inventory_batches SET remaining_units = $1 WHERE id = $2`, [newQty, batchId]);

    // Audit Log
    const med = await queryOne(`SELECT name FROM medicines WHERE id = $1`, [batch.medicine_id]);
    const AuditRepo = require('./auditRepository.cjs');
    await AuditRepo.log({
      userId,
      action: 'Inventory Adjusted',
      details: `Stock for "${med.name}" adjusted from ${oldQty} to ${newQty}. Reason: ${reason}`
    });

    return true;
  },
};

module.exports = BatchRepository;
