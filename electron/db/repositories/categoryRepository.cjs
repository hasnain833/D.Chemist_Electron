/**
 * repositories/categoryRepository.cjs
 */
const { query, queryOne } = require('../pool.cjs');

const CategoryRepository = {
  async getAll() {
    return query(`SELECT id, name, created_at FROM categories ORDER BY name`);
  },
  async getById(id) {
    return queryOne(`SELECT * FROM categories WHERE id = $1`, [id]);
  },
  async create(name) {
    return queryOne(`INSERT INTO categories (name) VALUES ($1) RETURNING id, name`, [name]);
  },
  async update(id, name) {
    return query(`UPDATE categories SET name = $1 WHERE id = $2`, [name, id]);
  },
  async delete(id) {
    return query(`DELETE FROM categories WHERE id = $1`, [id]);
  },
};

module.exports = CategoryRepository;
