/**
 * repositories/manufacturerRepository.cjs
 */
const { query, queryOne } = require('../pool.cjs');

const ManufacturerRepository = {
  async getAll() {
    return query(`SELECT id, name, created_at FROM manufacturers ORDER BY name`);
  },
  async getById(id) {
    return queryOne(`SELECT * FROM manufacturers WHERE id = $1`, [id]);
  },
  async create(name) {
    return queryOne(`INSERT INTO manufacturers (name) VALUES ($1) RETURNING id, name`, [name]);
  },
  async update(id, name) {
    return query(`UPDATE manufacturers SET name = $1 WHERE id = $2`, [name, id]);
  },
  async delete(id) {
    return query(`DELETE FROM manufacturers WHERE id = $1`, [id]);
  },
};

module.exports = ManufacturerRepository;
