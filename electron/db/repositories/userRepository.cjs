/**
 * repositories/userRepository.cjs
 * Port of C# UserRepository – all user-related DB operations.
 */
const { query, queryOne } = require('../pool.cjs');

const UserRepository = {
  async getAll() {
    return query(`
      SELECT id, username, full_name, role, status, must_change_password
      FROM users
      ORDER BY id
    `);
  },

  async getById(id) {
    return queryOne(`
      SELECT id, username, full_name, role, status, must_change_password
      FROM users WHERE id = $1
    `, [id]);
  },

  /** Used by AuthService – returns password hash too. */
  async getByUsername(username) {
    return queryOne(`
      SELECT id, username, password, full_name, role, status, must_change_password
      FROM users WHERE username = $1
    `, [username]);
  },

  async create({ username, password, fullName, role, status = 'Active', mustChangePassword = false }) {
    return queryOne(`
      INSERT INTO users (username, password, full_name, role, status, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [username, password, fullName, role, status, mustChangePassword]);
  },

  async update({ id, username, fullName, role, status, mustChangePassword }) {
    return query(`
      UPDATE users
      SET username = $1, full_name = $2, role = $3, status = $4, must_change_password = $5
      WHERE id = $6
    `, [username, fullName, role, status, mustChangePassword, id]);
  },

  async updatePassword(id, hashedPassword) {
    return query(`UPDATE users SET password = $1, must_change_password = FALSE WHERE id = $2`, [hashedPassword, id]);
  },

  async delete(id) {
    return query(`DELETE FROM users WHERE id = $1`, [id]);
  },
};

module.exports = UserRepository;
