const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const isDev = process.env.NODE_ENV !== 'production';

let store;

// ─── Store Setup ──────────────────────────────────────────────────────────────
async function setupStore() {
  const storeModule = (await import('electron-store')).default;
  store = new storeModule();

  // Provide safe defaults for app settings
  if (!store.has('TaxRate'))       store.set('TaxRate', 0.0);
  if (!store.has('db.host'))       store.set('db.host', 'localhost');
  if (!store.has('db.port'))       store.set('db.port', 5432);
  if (!store.has('db.database'))   store.set('db.database', 'pharmacy');
  if (!store.has('db.user'))       store.set('db.user', 'postgres');
  if (!store.has('db.password'))   store.set('db.password', 'h4276246');
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ─── App Ready ────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  await setupStore();

  // Initialise PostgreSQL pool and register all db:query IPC handlers
  const { registerDbHandlers, initDb } = require('./db/ipcHandlers.cjs');
  await initDb(store);
  registerDbHandlers();

  // ─── Daily Scheduled Auto Backup ──────────────────────────────────────────
  try {
    const autoBackupEnabled = store.get('db.autoBackupEnabled', true);
    const today = new Date().toISOString().split('T')[0];
    const lastBackupDate = store.get('db.lastBackupDate', '');
    if (autoBackupEnabled && lastBackupDate !== today) {
      setTimeout(async () => {
        try {
          const BackupService = require('./services/backupService.cjs');
          const AuditRepo = require('./db/repositories/auditRepository.cjs');
          const path = require('path');
          
          const dbCfg = {
            host:     store.get('db.host',     'localhost'),
            port:     store.get('db.port',     5432),
            database: store.get('db.database', 'pharmacy'),
            user:     store.get('db.user',     'postgres'),
            password: store.get('db.password', 'h4276246'),
          };
          const backupPath = store.get('db.backupPath', 'C:\\DChemist_Backups');

          console.log('[Backup] Running scheduled background auto-backup...');
          const res = await BackupService.createBackup(dbCfg, backupPath);
          if (res.success) {
            console.log(`[Backup] Auto-backup completed: ${res.filePath}`);
            store.set('db.lastBackupDate', today);
            
            await AuditRepo.log({
              userId: 0,
              action: 'System',
              details: `Automatic database backup created: ${path.basename(res.filePath)}`
            });
          } else {
            console.error('[Backup] Scheduled auto-backup failed:', res.message);
          }
        } catch (backupErr) {
          console.error('[Backup] Background auto-backup execution failed:', backupErr);
        }
      }, 5000); // Run 5 seconds after startup
    }
  } catch (schedErr) {
    console.error('[Backup] Scheduled auto-backup check failed:', schedErr);
  }

  // ── Store / Settings IPC ──────────────────────────────────────────────────
  ipcMain.handle('store:get', (_event, key) => store.get(key));
  ipcMain.on('store:set', (_event, key, val) => store.set(key, val));
  ipcMain.handle('app:version', () => app.getVersion());

  // ── DB Config reload (called from Settings page after user changes DB) ────
  ipcMain.handle('db:reconnect', async (_event, cfg) => {
    try {
      const { createPool } = require('./db/pool.cjs');
      // Persist new settings
      store.set('db.host',     cfg.host);
      store.set('db.port',     cfg.port);
      store.set('db.database', cfg.database);
      store.set('db.user',     cfg.user);
      store.set('db.password', cfg.password);
      createPool(cfg);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Services IPC Handlers ─────────────────────────────────────────────────
  const AuthService = require('./services/authService.cjs');
  const PrintService = require('./services/printService.cjs');
  const BackupService = require('./services/backupService.cjs');

  ipcMain.handle('auth:login', async (_event, username, password) => {
    return await AuthService.login(username, password);
  });

  ipcMain.handle('printer:print', async (_event, receiptData) => {
    const printerOptions = store.get('printerConfig', { interface: 'printer:Auto' });
    const storeInfo = store.get('storeInfo', { name: 'D.Chemist Pharmacy', address: '123 Main St' });
    const template = store.get('receiptTemplate', {
      header: 'D.CHEMIST',
      subHeader: 'PHARMACY & LABS',
      footer: 'Thank you for your visit!',
      showGeneric: true,
      showBatch: true,
      showExpiry: false
    });
    return await PrintService.printReceipt(printerOptions, receiptData, storeInfo, template);
  });

  ipcMain.handle('fiscal:report', async (_event, saleData) => {
    const fiscalSettings = {
      fbr_is_live: store.get('fbr.isLive', 'false'),
      fbr_api_url: store.get('fbr.apiUrl', ''),
      fbr_pos_id:  store.get('fbr.posId', ''),
      fbr_token:   store.get('fbr.token', ''),
      pharmacy_ntn: store.get('storeInfo.ntn', '')
    };
    const FiscalService = require('./services/fiscalService.cjs');
    return await FiscalService.reportSale(saleData, fiscalSettings);
  });

  ipcMain.handle('backup:create', async (_event, outputDirPath) => {
    const dbCfg = {
      host:     store.get('db.host',     'localhost'),
      port:     store.get('db.port',     5432),
      database: store.get('db.database', 'pharmacy'),
      user:     store.get('db.user',     'postgres'),
      password: store.get('db.password', 'h4276246'),
    };
    return await BackupService.createBackup(dbCfg, outputDirPath);
  });

  ipcMain.handle('backup:restore', async (event) => {
    const focusedWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(focusedWindow, {
      title: 'Select Backup SQL File',
      filters: [{ name: 'SQL Files', extensions: ['sql'] }],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'Restore cancelled.' };
    }

    const backupFilePath = result.filePaths[0];
    const dbCfg = {
      host:     store.get('db.host',     'localhost'),
      port:     store.get('db.port',     5432),
      database: store.get('db.database', 'pharmacy'),
      user:     store.get('db.user',     'postgres'),
      password: store.get('db.password', 'h4276246'),
    };

    try {
      const { closePool, createPool } = require('./db/pool.cjs');
      await closePool();

      const restoreRes = await BackupService.restoreBackup(dbCfg, backupFilePath);

      // Always recreate pool
      createPool(dbCfg);

      return restoreRes;
    } catch (err) {
      console.error('[DB] Error during backup restore:', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('reporting:export', async (event, suggestedName, csvContent) => {
    const focusedWindow = BrowserWindow.fromWebContents(event.sender);
    const ReportingService = require('./services/reportingService.cjs');
    return await ReportingService.exportToCSV(focusedWindow, suggestedName, csvContent);
  });

  ipcMain.handle('printer:list', async (event) => {
    const focusedWindow = BrowserWindow.fromWebContents(event.sender);
    if (!focusedWindow) return [];
    try {
      const printers = await focusedWindow.webContents.getPrintersAsync();
      return printers;
    } catch (err) {
      console.error('[Printer] Error listing printers:', err);
      return [];
    }
  });


  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // ── Auto Updater Initialization ───────────────────────────────────────────
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: 'A new version of D.Chemist is available. It will be downloaded in the background.',
      });
    });

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The application will restart to install the updates.',
        buttons: ['Restart Now']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
