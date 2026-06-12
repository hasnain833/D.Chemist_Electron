/**
 * repositories/dashboardRepository.cjs
 * Port of C# DashboardRepository – all aggregate/reporting queries.
 */
const { query, queryOne } = require('../pool.cjs');

const DashboardRepository = {
  /** Key metrics for the top stats cards. */
  async getDashboardStats() {
    const todaySales = await queryOne(`
      SELECT COALESCE(SUM(grand_total), 0) AS total, COUNT(*) AS count
      FROM sales
      WHERE sale_date::date = CURRENT_DATE AND status != 'Returned'
    `);

    const monthlySales = await queryOne(`
      SELECT COALESCE(SUM(grand_total), 0) AS total
      FROM sales
      WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE) AND status != 'Returned'
    `);

    const totalMedicines = await queryOne(`SELECT COUNT(*) AS count FROM medicines`);
    const lowStock       = await queryOne(`
      SELECT COUNT(*) AS count FROM (
        SELECT medicine_id FROM inventory_batches
        GROUP BY medicine_id
        HAVING COALESCE(SUM(remaining_units), 0) <= 10
      ) AS low
    `);
    const expiringSoon = await queryOne(`
      SELECT COUNT(*) AS count FROM inventory_batches
      WHERE expiry_date <= NOW() + INTERVAL '90 days' AND remaining_units > 0
    `);

    return {
      todaySalesTotal:  parseFloat(todaySales.total),
      todaySalesCount:  parseInt(todaySales.count),
      monthlySalesTotal: parseFloat(monthlySales.total),
      totalMedicines:   parseInt(totalMedicines.count),
      lowStockCount:    parseInt(lowStock.count),
      expiringSoonCount: parseInt(expiringSoon.count),
    };
  },

  /** Actual list of low stock items. */
  async getLowStockList(limit = 10) {
    return query(`
      SELECT m.name, SUM(b.remaining_units) as stock_level
      FROM inventory_batches b
      JOIN medicines m ON m.id = b.medicine_id
      GROUP BY m.name
      HAVING COALESCE(SUM(b.remaining_units), 0) <= 10
      ORDER BY stock_level ASC
      LIMIT $1
    `, [limit]);
  },

  /** Actual list of expiring soon items. */
  async getExpiringSoonList(limit = 10) {
    return query(`
      SELECT m.name, b.batch_no, b.expiry_date
      FROM inventory_batches b
      JOIN medicines m ON m.id = b.medicine_id
      WHERE b.expiry_date <= NOW() + INTERVAL '90 days' AND b.remaining_units > 0
      ORDER BY b.expiry_date ASC
      LIMIT $1
    `, [limit]);
  },

  /** List of recent sales. */
  async getRecentSalesList(limit = 10) {
    return query(`
      SELECT bill_no AS invoice_no, sale_date AS date, grand_total AS total_amount
      FROM sales
      ORDER BY sale_date DESC
      LIMIT $1
    `, [limit]);
  },

  /** Sales chart data — last N days. */
  async getSalesTrend(days = 30) {
    return query(`
      SELECT sale_date::date AS date,
        COALESCE(SUM(grand_total), 0) AS total,
        COUNT(*) AS count
      FROM sales
      WHERE sale_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
        AND status != 'Returned'
      GROUP BY sale_date::date
      ORDER BY date ASC
    `, [days]);
  },

  /** Top selling medicines. */
  async getTopMedicines(limit = 10) {
    return query(`
      SELECT m.name AS medicine_name,
        SUM(si.quantity) AS total_qty,
        SUM(si.subtotal) AS total_revenue
      FROM sale_items si
      JOIN medicines m ON m.id = si.medicine_id
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status != 'Returned'
        AND s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY m.name
      ORDER BY total_revenue DESC
      LIMIT $1
    `, [limit]);
  },

  /** Financial report for a date range. */
  async getFinancialReport(startDate, endDate) {
    return query(`
      SELECT
        s.sale_date::date AS report_date,
        COALESCE(SUM(s.total_amount), 0)    AS gross_sales,
        COALESCE(SUM(s.tax_amount), 0)      AS total_tax,
        COALESCE(SUM(s.discount_amount), 0) AS total_discount,
        COALESCE(SUM(si.returned_qty * si.unit_price), 0) AS total_returns,
        COALESCE(SUM(s.grand_total), 0)     AS net_sales,
        COUNT(DISTINCT s.id)               AS total_sales_count,
        COUNT(DISTINCT CASE WHEN si.returned_qty > 0 THEN s.id END) AS returns_count,
        COUNT(DISTINCT CASE WHEN s.fbr_reported = true THEN s.id END) AS fbr_sales_count,
        COUNT(DISTINCT CASE WHEN s.fbr_reported = false THEN s.id END) AS internal_sales_count,
        COALESCE(SUM((si.quantity - si.returned_qty) * (si.unit_price - COALESCE(ib.unit_cost, 0))), 0) AS total_profit
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN inventory_batches ib ON ib.id = si.batch_id
      WHERE s.sale_date >= $1 AND s.sale_date <= $2 AND s.status != 'Voided'
      GROUP BY s.sale_date::date
      ORDER BY report_date ASC
    `, [startDate, endDate]);
  },
};

module.exports = DashboardRepository;
