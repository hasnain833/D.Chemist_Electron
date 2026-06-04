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
});
