/**
 * repositories/customerRepository.cjs
 */
const { query, queryOne } = require('../pool.cjs');

const CustomerRepository = {
  async getAll() {
    return query(`SELECT id, customer_name AS "customerName", contact_person AS "contactPerson", phone, email, address FROM customers ORDER BY customer_name`);
  },
  async getById(id) {
    return queryOne(`SELECT id, customer_name AS "customerName", contact_person AS "contactPerson", phone, email, address FROM customers WHERE id = $1`, [id]);
  },
  async search(term) {
    return query(`
      SELECT id, customer_name AS "customerName", contact_person AS "contactPerson", phone, email, address FROM customers
      WHERE customer_name ILIKE $1 OR phone ILIKE $1 OR contact_person ILIKE $1
      ORDER BY customer_name LIMIT 20
    `, [`%${term}%`]);
  },
  async create({ customerName, contactPerson, phone, email, address }) {
    return queryOne(`
      INSERT INTO customers (customer_name, contact_person, phone, email, address)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [customerName, contactPerson, phone, email, address]);
  },
  async update({ id, customerName, contactPerson, phone, email, address }) {
    return query(`UPDATE customers SET customer_name=$1, contact_person=$2, phone=$3, email=$4, address=$5 WHERE id=$6`, [customerName, contactPerson, phone, email, address, id]);
  },
  async delete(id) {
    return query(`DELETE FROM customers WHERE id = $1`, [id]);
  },
};

module.exports = CustomerRepository;
