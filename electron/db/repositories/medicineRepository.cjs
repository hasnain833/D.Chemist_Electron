/**
 * repositories/medicineRepository.cjs
 * Port of C# MedicineRepository.
 */
const { getPool, query, queryOne } = require('../pool.cjs');

async function getOrCreateCategory(client, name) {
  if (!name) return null;
  const res = await client.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
  if (res.rows.length > 0) return res.rows[0].id;
  const ins = await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name]);
  return ins.rows[0].id;
}

async function getOrCreateManufacturer(client, name) {
  if (!name) return null;
  const res = await client.query('SELECT id FROM manufacturers WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
  if (res.rows.length > 0) return res.rows[0].id;
  const ins = await client.query('INSERT INTO manufacturers (name) VALUES ($1) RETURNING id', [name]);
  return ins.rows[0].id;
}

async function getOrCreateSupplier(client, name) {
  if (!name) return null;
  const res = await client.query('SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
  if (res.rows.length > 0) return res.rows[0].id;
  const ins = await client.query('INSERT INTO suppliers (name) VALUES ($1) RETURNING id', [name]);
  return ins.rows[0].id;
}

const MedicineRepository = {
  /** Full list with join data for the Inventory page. */
  async getAll() {
    return query(`
      SELECT 
        m.id, m.name, m.generic_name AS "genericName", 
        m.category_id AS "categoryId", m.manufacturer_id AS "manufacturerId",
        m.dosage_form AS "dosageForm", m.strength, m.barcode, 
        m.gst_percent AS "gstPercent", m.created_at AS "createdAt",
        m.units_per_pack AS "unitsPerPack", m.packets_per_box AS "packetsPerBox", m.default_entry_mode AS "defaultEntryMode",
        c.name AS "categoryName", 
        COALESCE(man.name, 'GSK') AS "manufacturerName",
        s.name AS "supplierName",
        b.batch_no AS "batchNo",
        b.remaining_units AS "stockQty",
        b.selling_price AS "sellingPrice",
        b.unit_cost AS "purchasePrice",
        b.expiry_date AS "expiryDate",
        b.id AS "batchId",
        b.entry_mode AS "batchEntryMode",
        b.units_per_pack AS "batchUnitsPerPack",
        b.pack_quantity AS "batchPackQuantity"
      FROM medicines m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN manufacturers man ON m.manufacturer_id = man.id
      LEFT JOIN inventory_batches b ON m.id = b.medicine_id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      ORDER BY m.name ASC, b.expiry_date ASC
    `);
  },

  async getById(id) {
    return queryOne(`
      SELECT 
        m.id, m.name, m.generic_name AS "genericName", 
        m.category_id AS "categoryId", m.manufacturer_id AS "manufacturerId",
        m.dosage_form AS "dosageForm", m.strength, m.barcode, 
        m.gst_percent AS "gstPercent", m.created_at AS "createdAt",
        m.units_per_pack AS "unitsPerPack", m.packets_per_box AS "packetsPerBox", m.default_entry_mode AS "defaultEntryMode",
        c.name AS "categoryName", 
        COALESCE(man.name, 'GSK') AS "manufacturerName",
        s.name AS "supplierName",
        b.batch_no AS "batchNo",
        b.remaining_units AS "stockQty",
        b.selling_price AS "sellingPrice",
        b.unit_cost AS "purchasePrice",
        b.expiry_date AS "expiryDate",
        b.id AS "batchId",
        b.entry_mode AS "batchEntryMode",
        b.units_per_pack AS "batchUnitsPerPack",
        b.pack_quantity AS "batchPackQuantity"
      FROM medicines m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN manufacturers man ON m.manufacturer_id = man.id
      LEFT JOIN inventory_batches b ON m.id = b.medicine_id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE m.id = $1
      ORDER BY b.expiry_date ASC
      LIMIT 1
    `, [id]);
  },

  async getByBarcode(barcode) {
    return queryOne(`
      SELECT 
        m.id, m.name, m.generic_name AS "genericName", 
        m.category_id AS "categoryId", m.manufacturer_id AS "manufacturerId",
        m.dosage_form AS "dosageForm", m.strength, m.barcode, 
        m.gst_percent AS "gstPercent", m.created_at AS "createdAt",
        m.units_per_pack AS "unitsPerPack", m.packets_per_box AS "packetsPerBox", m.default_entry_mode AS "defaultEntryMode",
        c.name AS "categoryName", 
        COALESCE(man.name, 'GSK') AS "manufacturerName",
        s.name AS "supplierName",
        b.batch_no AS "batchNo",
        b.remaining_units AS "stockQty",
        b.selling_price AS "sellingPrice",
        b.unit_cost AS "purchasePrice",
        b.expiry_date AS "expiryDate",
        b.id AS "batchId",
        b.entry_mode AS "batchEntryMode",
        b.units_per_pack AS "batchUnitsPerPack",
        b.pack_quantity AS "batchPackQuantity"
      FROM medicines m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN manufacturers man ON m.manufacturer_id = man.id
      LEFT JOIN inventory_batches b ON m.id = b.medicine_id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE m.barcode = $1
      ORDER BY b.expiry_date ASC
      LIMIT 1
    `, [barcode]);
  },

  async search(term) {
    return query(`
      SELECT DISTINCT ON (m.id)
        m.id, m.name, m.generic_name AS "genericName", 
        m.category_id AS "categoryId", m.manufacturer_id AS "manufacturerId",
        m.dosage_form AS "dosageForm", m.strength, m.barcode, 
        m.gst_percent AS "gstPercent", m.created_at AS "createdAt",
        m.units_per_pack AS "unitsPerPack", m.packets_per_box AS "packetsPerBox", m.default_entry_mode AS "defaultEntryMode",
        c.name AS "categoryName", 
        COALESCE(man.name, 'GSK') AS "manufacturerName",
        s.name AS "supplierName",
        b.batch_no AS "batchNo",
        b.remaining_units AS "stockQty",
        b.selling_price AS "sellingPrice",
        b.unit_cost AS "purchasePrice",
        b.expiry_date AS "expiryDate",
        b.id AS "batchId",
        b.entry_mode AS "batchEntryMode",
        b.units_per_pack AS "batchUnitsPerPack",
        b.pack_quantity AS "batchPackQuantity"
      FROM medicines m
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN manufacturers man ON m.manufacturer_id = man.id
      LEFT JOIN inventory_batches b ON m.id = b.medicine_id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE m.name ILIKE $1 
         OR m.generic_name ILIKE $1 
         OR m.barcode = $2
         OR man.name ILIKE $1
      ORDER BY m.id, b.expiry_date ASC
      LIMIT 50
    `, [`%${term}%`, term]);
  },

  async create({ name, genericName, categoryName, manufacturerName, supplierName, dosageForm, strength, barcode, gstPercent = 0, unitsPerPack = 1, packetsPerBox = 1, defaultEntryMode = 'Tablet', stockQty = 0, purchasePrice = 0, sellingPrice = 0, expiryDate = null }) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      const barcodeVal = barcode && barcode.trim() !== '' ? barcode.trim() : null;

      // 1. Resolve Category, Manufacturer, Supplier IDs
      let categoryId = null;
      if (categoryName && categoryName.trim() !== '') {
        categoryId = await getOrCreateCategory(client, categoryName.trim());
      }
      let manufacturerId = null;
      if (manufacturerName && manufacturerName.trim() !== '') {
        manufacturerId = await getOrCreateManufacturer(client, manufacturerName.trim());
      }
      let supplierId = null;
      if (supplierName && supplierName.trim() !== '') {
        supplierId = await getOrCreateSupplier(client, supplierName.trim());
      }

      // Check barcode uniqueness
      if (barcodeVal) {
        const check = await client.query('SELECT id FROM medicines WHERE barcode = $1 LIMIT 1', [barcodeVal]);
        if (check.rows.length > 0) {
          throw new Error(`A medicine with barcode '${barcodeVal}' already exists.`);
        }
      }

      // 2. Insert Medicine
      const medRes = await client.query(`
        INSERT INTO medicines (name, generic_name, category_id, manufacturer_id, dosage_form, strength, barcode, gst_percent, units_per_pack, packets_per_box, default_entry_mode)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [name, genericName, categoryId, manufacturerId, dosageForm, strength, barcodeVal, gstPercent, unitsPerPack, packetsPerBox, defaultEntryMode]);
      
      const medicineId = medRes.rows[0].id;

      // 3. Insert Initial Batch if stockQty > 0
      if (stockQty > 0) {
        const defaultExpiry = expiryDate ? new Date(expiryDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 1));
        await client.query(`
          INSERT INTO inventory_batches (medicine_id, supplier_id, batch_no, quantity_units, purchase_total_price, unit_cost, selling_price, remaining_units, expiry_date)
          VALUES ($1, $2, 'Standard', $3, $4, $5, $6, $3, $7)
        `, [
          medicineId,
          supplierId,
          stockQty,
          purchasePrice * stockQty,
          purchasePrice,
          sellingPrice,
          defaultExpiry
        ]);
      }

      await client.query('COMMIT');
      return medicineId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update({ id, name, genericName, categoryName, manufacturerName, supplierName, dosageForm, strength, barcode, gstPercent = 0, unitsPerPack = 1, packetsPerBox = 1, defaultEntryMode = 'Tablet', stockQty = 0, purchasePrice = 0, sellingPrice = 0, expiryDate = null }) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      const barcodeVal = barcode && barcode.trim() !== '' ? barcode.trim() : null;

      // 1. Resolve Category, Manufacturer, Supplier IDs
      let categoryId = null;
      if (categoryName && categoryName.trim() !== '') {
        categoryId = await getOrCreateCategory(client, categoryName.trim());
      }
      let manufacturerId = null;
      if (manufacturerName && manufacturerName.trim() !== '') {
        manufacturerId = await getOrCreateManufacturer(client, manufacturerName.trim());
      }
      let supplierId = null;
      if (supplierName && supplierName.trim() !== '') {
        supplierId = await getOrCreateSupplier(client, supplierName.trim());
      }

      // Check barcode uniqueness
      if (barcodeVal) {
        const check = await client.query('SELECT id FROM medicines WHERE barcode = $1 AND id != $2 LIMIT 1', [barcodeVal, id]);
        if (check.rows.length > 0) {
          throw new Error(`Barcode '${barcodeVal}' is already assigned to another medicine.`);
        }
      }

      // 2. Update Medicine Metadata
      await client.query(`
        UPDATE medicines
        SET name = $1, generic_name = $2, category_id = $3, manufacturer_id = $4,
            dosage_form = $5, strength = $6, barcode = $7, gst_percent = $8,
            units_per_pack = $9, packets_per_box = $10, default_entry_mode = $11
        WHERE id = $12
      `, [name, genericName, categoryId, manufacturerId, dosageForm, strength, barcodeVal, gstPercent, unitsPerPack, packetsPerBox, defaultEntryMode, id]);

      // 3. Update selling price on all active batches
      if (sellingPrice > 0) {
        await client.query(`
          UPDATE inventory_batches 
          SET selling_price = $1
          WHERE medicine_id = $2 AND remaining_units > 0
        `, [sellingPrice, id]);
      }

      // 4. Retrieve existing batches ordered by id DESC
      const batchesRes = await client.query(`
        SELECT id, remaining_units 
        FROM inventory_batches 
        WHERE medicine_id = $1 
        ORDER BY id DESC
      `, [id]);

      const defaultExpiry = expiryDate ? new Date(expiryDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 1));

      if (batchesRes.rows.length === 0) {
        if (stockQty > 0) {
          // No batches exist, create an adjustment batch
          const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
          await client.query(`
            INSERT INTO inventory_batches (medicine_id, supplier_id, batch_no, quantity_units, purchase_total_price, unit_cost, selling_price, remaining_units, expiry_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $4, $8)
          `, [
            id,
            supplierId,
            `ADJ-${todayStr}`,
            stockQty,
            purchasePrice * stockQty,
            purchasePrice,
            sellingPrice,
            defaultExpiry
          ]);
        }
      } else {
        // Balance stock against the latest batch
        const latestBatch = batchesRes.rows[0];
        let otherBatchesTotal = 0;
        for (let i = 1; i < batchesRes.rows.length; i++) {
          otherBatchesTotal += parseInt(batchesRes.rows[i].remaining_units || 0);
        }

        const newLatestQty = Math.max(0, stockQty - otherBatchesTotal);

        await client.query(`
          UPDATE inventory_batches
          SET unit_cost = $1,
              purchase_total_price = CAST($1 AS numeric) * quantity_units,
              remaining_units = $2,
              expiry_date = $3,
              supplier_id = COALESCE($4, supplier_id)
          WHERE id = $5
        `, [purchasePrice, newLatestQty, defaultExpiry, supplierId, latestBatch.id]);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async delete(id) {
    try {
      await query('DELETE FROM medicines WHERE id = $1', [id]);
      return { success: true };
    } catch (err) {
      if (err.code === '23503') {
        throw new Error(
          "Cannot delete this medicine — it has been used in past sales. " +
          "You can clear all sales data from Settings if you wish to remove it."
        );
      }
      throw err;
    }
  },

  async deleteBulk(ids) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM medicines WHERE id = ANY($1::int[])', [ids]);
      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23503') {
        throw new Error("Could not delete selected medicines because they are tied to existing sales. You must clear sales data first from Settings.");
      }
      throw err;
    } finally {
      client.release();
    }
  },

  async updateMetadata({ id, name, categoryName, sellingPrice, batchNo, batchId }) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      let categoryId = null;
      if (categoryName && categoryName.trim() !== '') {
        categoryId = await getOrCreateCategory(client, categoryName.trim());
      }

      await client.query(`
        UPDATE medicines
        SET name = $1,
            category_id = COALESCE($2, category_id)
        WHERE id = $3
      `, [name, categoryId, id]);

      if (sellingPrice > 0) {
        await client.query(`
          UPDATE inventory_batches
          SET selling_price = $1
          WHERE medicine_id = $2 AND remaining_units > 0
        `, [sellingPrice, id]);
      }

      if (batchNo && batchNo.trim() !== '' && batchId) {
        await client.query(`
          UPDATE inventory_batches
          SET batch_no = $1
          WHERE id = $2
        `, [batchNo.trim(), batchId]);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = MedicineRepository;
