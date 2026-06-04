import type { User, DashboardStats, FinancialReport, Medicine, InventoryBatch, Sale, Supplier, Customer } from './types/models';

export interface ElectronAPI {
  // DB queries
  dbQuery(queryName: string, args?: any): Promise<{ success: boolean; data?: any; error?: string }>;
  dbReconnect(config: any): Promise<{ success: boolean; error?: string }>;
  
  // Settings
  getSetting(key: string): Promise<any>;
  setSetting(key: string, value: any): void;
  
  // Services
  authLogin(username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }>;
  printReceipt(data: any): Promise<{ success: boolean; message?: string }>;
  createBackup(outputDirPath: string): Promise<{ success: boolean; filePath?: string; message?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
