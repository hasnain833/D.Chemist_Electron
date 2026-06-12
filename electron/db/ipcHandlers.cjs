/**
 * db/ipcHandlers.cjs
 * Central IPC router — maps every 'db:query' call to the correct repository method.
 * Register all handlers here to keep main.cjs clean.
 */

const { ipcMain } = require('electron');
const bcrypt = require('bcryptjs');
const { createPool } = require('./pool.cjs');

const UserRepo         = require('./repositories/userRepository.cjs');
const MedicineRepo     = require('./repositories/medicineRepository.cjs');
const BatchRepo        = require('./repositories/batchRepository.cjs');
const SaleRepo         = require('./repositories/saleRepository.cjs');
const CategoryRepo     = require('./repositories/categoryRepository.cjs');
const ManufacturerRepo = require('./repositories/manufacturerRepository.cjs');
const SupplierRepo     = require('./repositories/supplierRepository.cjs');
const CustomerRepo     = require('./repositories/customerRepository.cjs');
const AuditRepo        = require('./repositories/auditRepository.cjs');
const DashboardRepo    = require('./repositories/dashboardRepository.cjs');
const PurchaseInvoiceRepo = require('./repositories/purchaseInvoiceRepository.cjs');

// ---------------------------------------------------------------------------
// Route map:  queryName → async (args) => result
// ---------------------------------------------------------------------------
const routes = {
  // ── Users ────────────────────────────────────────────────────────────────
  'users:getAll':          (a) => UserRepo.getAll(),
  'users:getById':         (a) => UserRepo.getById(a.id),
  'users:getByUsername':   (a) => UserRepo.getByUsername(a.username),
  'auth:login': async (a) => {
    const user = await UserRepo.getByUsername(a.username);
    if (!user) return null;
    const match = await bcrypt.compare(a.password, user.password);
    if (!match) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  },
  'auth:changePassword':   (a) => {
    const AuthService = require('../services/authService.cjs');
    return AuthService.changePassword(a.userId, a.newPassword);
  },
  'users:create':          (a) => UserRepo.create(a),
  'users:update':          (a) => UserRepo.update(a),
  'users:updatePassword':  (a) => UserRepo.updatePassword(a.id, a.hashedPassword),
  'users:delete':          (a) => UserRepo.delete(a.id),

  // ── Medicines ─────────────────────────────────────────────────────────────
  'medicines:getAll':      (a) => MedicineRepo.getAll(),
  'medicines:getById':     (a) => MedicineRepo.getById(a.id),
  'medicines:getByBarcode':(a) => MedicineRepo.getByBarcode(a.barcode),
  'medicines:search':      (a) => MedicineRepo.search(a.term),
  'medicines:create':      (a) => MedicineRepo.create(a),
  'medicines:update':      (a) => MedicineRepo.update(a),
  'medicines:delete':      (a) => MedicineRepo.delete(a.id),
  'medicines:deleteBulk':  (a) => MedicineRepo.deleteBulk(a.ids),
  'medicines:updateMetadata': (a) => MedicineRepo.updateMetadata(a),

  // ── Batches ───────────────────────────────────────────────────────────────
  'batches:getByMedicine': (a) => BatchRepo.getByMedicineId(a.medicineId),
  'batches:getExpiring':   (a) => BatchRepo.getExpiringBatches(a.daysAhead),
  'batches:getLowStock':   (a) => BatchRepo.getLowStockBatches(a.threshold),
  'batches:create':        (a) => BatchRepo.create(a),
  'batches:deduct':        (a) => BatchRepo.deductUnits(a.batchId, a.qty),
  'batches:restore':       (a) => BatchRepo.restoreUnits(a.batchId, a.qty),
  'batches:updateManual':  (a) => BatchRepo.updateStockManual(a.batchId, a.newQty, a.reason, a.userId),
  'batches:delete':        (a) => BatchRepo.delete(a.id),

  // ── Sales ─────────────────────────────────────────────────────────────────
  'sales:getAll':          (a) => SaleRepo.getAll(a),
  'sales:getById':         (a) => SaleRepo.getById(a.id),
  'sales:create':          (a) => SaleRepo.createSale(a),
  'sales:processReturn':   (a) => SaleRepo.processReturn(a.saleId, a.returnedItems, a.userId),
  'sales:void':            (a) => SaleRepo.voidSale(a.billNo, a.userId),
  'sales:purge':           (a) => SaleRepo.purgeSalesData(a.userId),
  'sales:generateBillNo':  (a) => SaleRepo.generateBillNo(),

  // ── Categories ────────────────────────────────────────────────────────────
  'categories:getAll':     (a) => CategoryRepo.getAll(),
  'categories:create':     (a) => CategoryRepo.create(a.name),
  'categories:update':     (a) => CategoryRepo.update(a.id, a.name),
  'categories:delete':     (a) => CategoryRepo.delete(a.id),

  // ── Manufacturers ─────────────────────────────────────────────────────────
  'manufacturers:getAll':  (a) => ManufacturerRepo.getAll(),
  'manufacturers:create':  (a) => ManufacturerRepo.create(a.name),
  'manufacturers:update':  (a) => ManufacturerRepo.update(a.id, a.name),
  'manufacturers:delete':  (a) => ManufacturerRepo.delete(a.id),

  // ── Suppliers ─────────────────────────────────────────────────────────────
  'suppliers:getAll':      (a) => SupplierRepo.getAll(),
  'suppliers:getById':     (a) => SupplierRepo.getById(a.id),
  'suppliers:create':      (a) => SupplierRepo.create(a),
  'suppliers:update':      (a) => SupplierRepo.update(a),
  'suppliers:delete':      (a) => SupplierRepo.delete(a.id),

  // ── Customers ─────────────────────────────────────────────────────────────
  'customers:getAll':      (a) => CustomerRepo.getAll(),
  'customers:search':      (a) => CustomerRepo.search(a.term),
  'customers:create':      (a) => CustomerRepo.create(a),
  'customers:update':      (a) => CustomerRepo.update(a),
  'customers:delete':      (a) => CustomerRepo.delete(a.id),

  // ── Audit Logs ────────────────────────────────────────────────────────────
  'audit:getAll':          (a) => AuditRepo.getAll(a),
  'audit:log':             (a) => AuditRepo.log(a),

  // ── Dashboard ─────────────────────────────────────────────────────────────
  'dashboard:getStats':    (a) => DashboardRepo.getDashboardStats(),
  'dashboard:getSalesTrend':(a) => DashboardRepo.getSalesTrend(a.days),
  'dashboard:getTopMedicines':(a) => DashboardRepo.getTopMedicines(a.limit),
  'dashboard:getFinancialReport':(a) => DashboardRepo.getFinancialReport(a.startDate, a.endDate),
  'dashboard:getLowStock': (a) => DashboardRepo.getLowStockList(a.limit),
  'dashboard:getExpiring': (a) => DashboardRepo.getExpiringSoonList(a.limit),
  'dashboard:getRecentSales': (a) => DashboardRepo.getRecentSalesList(a.limit),

  // ── Purchase Invoices ─────────────────────────────────────────────────────
  'invoices:getAll':       (a) => PurchaseInvoiceRepo.getAll(),
  'invoices:getItems':     (a) => PurchaseInvoiceRepo.getInvoiceItems(a.invoiceId),
  'invoices:search':       (a) => PurchaseInvoiceRepo.search(a.invoiceNo, a.supplierName, a.date),
  'invoices:delete':       (a) => PurchaseInvoiceRepo.delete(a.invoiceId),
  'invoices:cleanup':      (a) => PurchaseInvoiceRepo.cleanupFullySoldInvoices(),
  'invoices:update':       (a) => PurchaseInvoiceRepo.updateInvoiceItems(a.invoiceId, a.items),
  'invoices:stockIn':      (a) => PurchaseInvoiceRepo.processStockIn(a.supplierName, a.invoiceNo, a.date, a.items),
};

// ---------------------------------------------------------------------------

function registerDbHandlers() {
  ipcMain.handle('db:query', async (_event, queryName, args = {}) => {
    const handler = routes[queryName];
    if (!handler) {
      return { success: false, error: `Unknown query: "${queryName}"` };
    }
    try {
      const data = await handler(args);
      return { success: true, data };
    } catch (err) {
      console.error(`[DB] Error in "${queryName}":`, err);
      return { success: false, error: err.message };
    }
  });
}

const { initDbAndSchema } = require('./init.cjs');

async function initDb(store) {
  const cfg = {
    host:     store.get('db.host',     'localhost'),
    port:     store.get('db.port',     5432),
    database: store.get('db.database', 'pharmacy'),
    user:     store.get('db.user',     'postgres'),
    password: store.get('db.password', 'h4276246'),
  };
  try {
    await initDbAndSchema(cfg);
  } catch (err) {
    console.error('[DB] Failed to run database schema initialization and migrations:', err);
  }
  createPool(cfg);
  console.log(`[DB] Connected to PostgreSQL at ${cfg.host}:${cfg.port}/${cfg.database}`);
}

module.exports = { registerDbHandlers, initDb };
