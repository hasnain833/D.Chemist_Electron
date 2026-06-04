/**
 * repositories/supplierRepository.cjs
 */
const { query, queryOne } = require('../pool.cjs');

const SupplierRepository = {
  async getAll() {
    return query(`SELECT id, name, phone, address, created_at FROM suppliers ORDER BY name`);
  },
  async getById(id) {
    return queryOne(`SELECT * FROM suppliers WHERE id = $1`, [id]);
  },
  async create({ name, phone, address }) {
    return queryOne(`
      INSERT INTO suppliers (name, phone, address)
      VALUES ($1, $2, $3) RETURNING id
    `, [name, phone, address]);
  },
  async update({ id, name, phone, address }) {
    return query(`UPDATE suppliers SET name=$1, phone=$2, address=$3 WHERE id=$4`, [name, phone, address, id]);
  },
  async delete(id) {
    return query(`DELETE FROM suppliers WHERE id = $1`, [id]);
  },
};

module.exports = SupplierRepository;
