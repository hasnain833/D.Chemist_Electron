/**
 * repositories/auditRepository.cjs
 */
const { query, queryOne } = require('../pool.cjs');

const AuditRepository = {
  async getAll({ limit = 200, userId, action, date } = {}) {
    let sql = `
      SELECT al.id, al.user_id, u.username, al.action, al.details, al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;
    const params = [];
    if (userId) { params.push(userId); sql += ` AND al.user_id = $${params.length}`; }
    if (action) { params.push(`%${action}%`); sql += ` AND al.action ILIKE $${params.length}`; }
    if (date)   { params.push(date); sql += ` AND al.created_at::date = $${params.length}`; }
    
    params.push(limit);
    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length}`;
    return query(sql, params);
  },

  async log({ userId, action, details }) {
    return query(`
      INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)
    `, [userId, action, details]);
  },
};

module.exports = AuditRepository;
