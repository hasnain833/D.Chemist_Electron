const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // DB & Repository Channels
  dbQuery: (queryName, args) => ipcRenderer.invoke('db:query', queryName, args),
  
  // DB specific reconnect utility
  dbReconnect: (config) => ipcRenderer.invoke('db:reconnect', config),
  
  // Settings & Configuration mapping (electron-store)
  getSetting: (key) => ipcRenderer.invoke('store:get', key),
  setSetting: (key, value) => ipcRenderer.send('store:set', key, value),
  getAppVersion: () => ipcRenderer.invoke('app:version'),

  // Services Channels
  authLogin: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  
  printReceipt: (data) => ipcRenderer.invoke('printer:print', data),
  fiscalReport: (saleData) => ipcRenderer.invoke('fiscal:report', saleData),
  
  createBackup: (outputDirPath) => ipcRenderer.invoke('backup:create', outputDirPath),
  restoreBackup: () => ipcRenderer.invoke('backup:restore'),
  exportCSV: (suggestedName, csvContent) => ipcRenderer.invoke('reporting:export', suggestedName, csvContent),
  listPrinters: () => ipcRenderer.invoke('printer:list'),

  // Auto-updater — listen for status events pushed from main process
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, payload) => callback(payload));
    // Return a cleanup function
    return () => ipcRenderer.removeAllListeners('update-status');
  },
  // Trigger download or install from renderer
  downloadUpdate: () => ipcRenderer.send('update:download'),
  installUpdate: () => ipcRenderer.send('update:install'),
});

