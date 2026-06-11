/**
 * repositories/medicineRepository.cjs
 * Port of C# MedicineRepository.
 */
const { query, queryOne } = require('../pool.cjs');

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
        c.name  AS "categoryName",
        mf.name AS "manufacturerName",
        COALESCE(SUM(b.remaining_units), 0)::int AS "stockQty",
        MAX(b.selling_price)                      AS "sellingPrice",
        MIN(b.expiry_date)                        AS "expiryDate"
      FROM medicines m
      LEFT JOIN categories    c  ON c.id  = m.category_id
      LEFT JOIN manufacturers mf ON mf.id = m.manufacturer_id
      LEFT JOIN inventory_batches b ON b.medicine_id = m.id
      GROUP BY m.id, c.name, mf.name, m.units_per_pack, m.packets_per_box, m.default_entry_mode
      ORDER BY m.name
    `);
  },

  async getById(id) {
    return queryOne(`
      SELECT m.id, m.name, m.generic_name AS "genericName", 
        m.category_id AS "categoryId", m.manufacturer_id AS "manufacturerId",
        m.dosage_form AS "dosageForm", m.strength, m.barcode, 
        m.gst_percent AS "gstPercent", m.created_at AS "createdAt",
        m.units_per_pack AS "unitsPerPack", m.packets_per_box AS "packetsPerBox", m.default_entry_mode AS "defaultEntryMode",
        c.name AS "categoryName", mf.name AS "manufacturerName",
        COALESCE(SUM(b.remaining_units), 0)::int AS "stockQty",
        MAX(b.selling_price) AS "sellingPrice",
        MIN(b.expiry_date)   AS "expiryDate"
      FROM medicines m
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN manufacturers mf ON mf.id = m.manufacturer_id
      LEFT JOIN inventory_batches b ON b.medicine_id = m.id
      WHERE m.id = $1
      GROUP BY m.id, c.name, mf.name, m.units_per_pack, m.packets_per_box, m.default_entry_mode
    `, [id]);
  },

  async getByBarcode(barcode) {
    return queryOne(`
      SELECT m.id, m.name, m.generic_name AS "genericName", 
        m.category_id AS "categoryId", m.manufacturer_id AS "manufacturerId",
        m.dosage_form AS "dosageForm", m.strength, m.barcode, 
        m.gst_percent AS "gstPercent", m.created_at AS "createdAt",
        m.units_per_pack AS "unitsPerPack", m.packets_per_box AS "packetsPerBox", m.default_entry_mode AS "defaultEntryMode",
        c.name AS "categoryName",
        COALESCE(SUM(b.remaining_units), 0)::int AS "stockQty",
        MAX(b.selling_price) AS "sellingPrice",
        MIN(b.expiry_date)   AS "expiryDate"
      FROM medicines m
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN inventory_batches b ON b.medicine_id = m.id
      WHERE m.barcode = $1
      GROUP BY m.id, c.name, m.units_per_pack, m.packets_per_box, m.default_entry_mode
    `, [barcode]);
  },

  async search(term) {
    return query(`
      SELECT m.id, m.name, m.generic_name AS "genericName", 
        m.barcode, m.dosage_form AS "dosageForm", m.strength,
        m.gst_percent AS "gstPercent", c.name AS "categoryName",
        m.units_per_pack AS "unitsPerPack", m.packets_per_box AS "packetsPerBox", m.default_entry_mode AS "defaultEntryMode",
        mf.name AS "manufacturerName",
        COALESCE(SUM(b.remaining_units), 0)::int AS "stockQty",
        MAX(b.selling_price) AS "sellingPrice",
        MIN(b.expiry_date)   AS "expiryDate"
      FROM medicines m
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN manufacturers mf ON mf.id = m.manufacturer_id
      LEFT JOIN inventory_batches b ON b.medicine_id = m.id
      WHERE m.name ILIKE $1 OR m.generic_name ILIKE $1 OR m.barcode ILIKE $1
      GROUP BY m.id, c.name, m.units_per_pack, m.packets_per_box, m.default_entry_mode, mf.name
      ORDER BY m.name
      LIMIT 50
    `, [`%${term}%`]);
  },

  async create({ name, genericName, categoryId, manufacturerId, dosageForm, strength, barcode, gstPercent = 0 }) {
    return queryOne(`
      INSERT INTO medicines (name, generic_name, category_id, manufacturer_id, dosage_form, strength, barcode, gst_percent)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
    `, [name, genericName, categoryId, manufacturerId, dosageForm, strength, barcode, gstPercent]);
  },

  async update({ id, name, genericName, categoryId, manufacturerId, dosageForm, strength, barcode, gstPercent }) {
    return query(`
      UPDATE medicines
      SET name=$1, generic_name=$2, category_id=$3, manufacturer_id=$4,
          dosage_form=$5, strength=$6, barcode=$7, gst_percent=$8
      WHERE id=$9
    `, [name, genericName, categoryId, manufacturerId, dosageForm, strength, barcode, gstPercent, id]);
  },

  async delete(id) {
    return query(`DELETE FROM medicines WHERE id = $1`, [id]);
  },
};

module.exports = MedicineRepository;
