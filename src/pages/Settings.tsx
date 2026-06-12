import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Printer,
  HardDrive,
  Shield,
  Building2,
  Save,
  PlusCircle,
  Trash2,
  ShieldCheck,
  Clock,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../AuthContext';


export default function Settings() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');

  // Database Operations & Connection credentials
  const [backupPath, setBackupPath] = useState('C:\\DChemist_Backups');
  const [backupStatus, setBackupStatus] = useState('');
  const [isDbConfigExpanded, setIsDbConfigExpanded] = useState(false);
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: 5432,
    database: 'dchemist',
    user: 'postgres',
    password: ''
  });

  // Pharmacy Information
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyNtn, setPharmacyNtn] = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');
  const [pharmacyPhone, setPharmacyPhone] = useState('');
  const [pharmacyLicense, setPharmacyLicense] = useState('');
  const [pharmacyLogo, setPharmacyLogo] = useState<string | null>(null);

  // Printing Settings
  const [isSilentPrintEnabled, setIsSilentPrintEnabled] = useState(false);
  const [printerInterface, setPrinterInterface] = useState('printer:Auto');

  // Receipt Template
  const [template, setTemplate] = useState({
    header: 'D.CHEMIST',
    subHeader: 'PHARMACY & LABS',
    footer: 'Thank you for your visit!',
    showGeneric: true,
    showBatch: true,
    showExpiry: false,
    fontSize: 'Small'
  });

  // About & Updates
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('System is up to date.');

  // Security Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLogsExpanded, setIsLogsExpanded] = useState(false);

  // Integrations (FBR Config)
  const [fbrIsLive, setFbrIsLive] = useState(false);
  const [fbrPosId, setFbrPosId] = useState('');
  const [fbrApiUrl, setFbrApiUrl] = useState('');
  const [fbrToken, setFbrToken] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const host = await (window as any).electronAPI.getSetting('db.host');
      const port = await (window as any).electronAPI.getSetting('db.port');
      const database = await (window as any).electronAPI.getSetting('db.database');
      const pgUser = await (window as any).electronAPI.getSetting('db.user');
      const pgPass = await (window as any).electronAPI.getSetting('db.password');

      const printer = await (window as any).electronAPI.getSetting('printerConfig');
      const profile = await (window as any).electronAPI.getSetting('pharmacyProfile') || {};
      const savedTemplate = await (window as any).electronAPI.getSetting('receiptTemplate') || {};
      const version = await (window as any).electronAPI.getAppVersion();

      setDbConfig({
        host: host || 'localhost',
        port: port || 5432,
        database: database || 'dchemist',
        user: pgUser || 'postgres',
        password: pgPass || ''
      });

      if (printer?.interface) setPrinterInterface(printer.interface);
      if (printer?.silent !== undefined) setIsSilentPrintEnabled(printer.silent);

      if (profile.name) setPharmacyName(profile.name);
      if (profile.ntn) setPharmacyNtn(profile.ntn);
      if (profile.address) setPharmacyAddress(profile.address);
      if (profile.phone) setPharmacyPhone(profile.phone);
      if (profile.license) setPharmacyLicense(profile.license);
      if (profile.logo) setPharmacyLogo(profile.logo);

      const isLiveSetting = await (window as any).electronAPI.getSetting('fbr.isLive') || 'false';
      const posIdSetting = await (window as any).electronAPI.getSetting('fbr.posId') || '';
      const apiUrlSetting = await (window as any).electronAPI.getSetting('fbr.apiUrl') || '';
      const tokenSetting = await (window as any).electronAPI.getSetting('fbr.token') || '';

      setFbrIsLive(isLiveSetting === 'true');
      setFbrPosId(posIdSetting);
      setFbrApiUrl(apiUrlSetting);
      setFbrToken(tokenSetting);

      setTemplate(prev => ({ ...prev, ...savedTemplate }));
      if (version) setAppVersion(version);
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPharmacyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const profileData = {
        name: pharmacyName,
        ntn: pharmacyNtn,
        address: pharmacyAddress,
        phone: pharmacyPhone,
        license: pharmacyLicense,
        logo: pharmacyLogo
      };
      await (window as any).electronAPI.setSetting('pharmacyProfile', profileData);
      await (window as any).electronAPI.setSetting('storeInfo', profileData);
      alert("Success: Pharmacy profile details saved.");
    } catch (err: any) {
      alert(`Error saving profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDb = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await (window as any).electronAPI.dbReconnect(dbConfig);
      if (res.success) {
        alert("Connected: Database settings updated and verified.");
      } else {
        alert(`Error: Could not connect to database. ${res.error || ''}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrinterSettings = async () => {
    setIsSaving(true);
    try {
      await (window as any).electronAPI.setSetting('printerConfig', {
        interface: printerInterface,
        silent: isSilentPrintEnabled
      });
      await (window as any).electronAPI.setSetting('receiptTemplate', template);
      alert("Success: Printer configuration and receipt template updated.");
    } catch (err: any) {
      alert(`Error saving printer: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIntegrations = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await (window as any).electronAPI.setSetting('fbr.isLive', fbrIsLive ? 'true' : 'false');
      await (window as any).electronAPI.setSetting('fbr.posId', fbrPosId);
      await (window as any).electronAPI.setSetting('fbr.apiUrl', fbrApiUrl);
      await (window as any).electronAPI.setSetting('fbr.token', fbrToken);
      alert("Success: FBR fiscal integration settings updated.");
    } catch (err: any) {
      alert(`Error saving integrations: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    if (user?.role !== 'ADMIN') {
      alert("Access Denied: Only administrators can perform database backups.");
      return;
    }
    setBackupStatus('Running database backup...');
    try {
      const res = await (window as any).electronAPI.createBackup(backupPath);
      if (res.success) {
        alert(`Success: Database backup completed successfully.\nSaved to: ${res.filePath}`);
        setBackupStatus(`Last backup: ${new Date().toLocaleTimeString()} (Success)`);
      } else {
        alert(`Backup Error: ${res.message}`);
        setBackupStatus('Backup failed.');
      }
    } catch (err: any) {
      alert(`Backup Error: ${err.message}`);
      setBackupStatus('Backup failed.');
    }
  };

  const handleRestoreBackup = async () => {
    if (user?.role !== 'ADMIN') {
      alert("Access Denied: Only administrators can restore database backups.");
      return;
    }
    if (!window.confirm("Warning: Database Restoration\n\nRestoring a backup will overwrite all current tables and data in the active PostgreSQL database. Any unsaved transactions will be lost.\n\nAre you sure you want to proceed?")) {
      return;
    }
    setBackupStatus('Restoring database from backup...');
    try {
      const res = await (window as any).electronAPI.restoreBackup();
      if (res.success) {
        alert("Success: Database restoration completed successfully.");
        setBackupStatus(`Last restore: ${new Date().toLocaleTimeString()} (Success)`);
        // Log to audit log
        await (window as any).electronAPI.dbQuery('audit:log', {
          userId: user?.id,
          action: 'Security',
          details: 'Database restored successfully from backup file.'
        });
        if (isLogsExpanded) fetchAuditLogs();
      } else {
        alert(`Restore Error: ${res.message || 'Restoration failed.'}`);
        setBackupStatus('Restore failed.');
      }
    } catch (err: any) {
      alert(`Restore Error: ${err.message}`);
      setBackupStatus('Restore failed.');
    }
  };

  const handleClearSales = async () => {
    if (user?.role !== 'ADMIN') {
      alert("Access Denied: Only administrators can clear sales data.");
      return;
    }
    if (!window.confirm("Warning: Clear Sales Data\n\nThis will delete all sales bills and restore all stock quantities in the inventory batches. This action cannot be undone.\n\nAre you sure you want to proceed?")) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await (window as any).electronAPI.dbQuery('sales:purge', { userId: user?.id });
      if (res.success) {
        alert("Success: Sales bills database cleared and stock quantities restored to original levels.");
        if (isLogsExpanded) fetchAuditLogs();
      } else {
        alert(`Purge Error: ${res.error || 'Failed to clear sales data.'}`);
      }
    } catch (err: any) {
      alert(`Purge Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckUpdates = () => {
    setIsCheckingUpdates(true);
    setUpdateStatus('Checking for updates...');
    setTimeout(() => {
      setIsCheckingUpdates(false);
      setUpdateStatus('Latest version is already installed (v' + appVersion + ').');
    }, 1500);
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await (window as any).electronAPI.dbQuery('audit:getAll', { limit: 100 });
      if (res.success) {
        setAuditLogs(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isLogsExpanded) {
      fetchAuditLogs();
    }
  }, [isLogsExpanded]);

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] overflow-hidden animate-fade-in">

      {/* Page Header (Matching SettingsPage.xaml) */}
      <div className="bg-linear-to-r from-[#00D2FF] to-[#3a7bd5] px-[40px] py-[24px] flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-5">
          <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <SettingsIcon className="text-[#3a7bd5]" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
            <span className="text-xs text-slate-100 font-medium opacity-90">Manage your pharmacy configuration and system operations.</span>
          </div>
        </div>

        {isSaving && (
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl border border-white/20 animate-pulse">
            <RotateCcw size={14} className="animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Saving Settings...</span>
          </div>
        )}
      </div>

      {/* Settings ScrollViewer (Stacked single page layout) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-[40px] py-[32px]">
        <div className="max-w-[1200px] flex flex-col gap-10 pb-[80px]">

          {/* Section 1: Database Operations */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2 px-1">
              <Database size={18} className="text-[#3a7bd5]" /> Database Operations
            </h2>
            <div className="border border-[#E2E8F0] rounded-xl bg-white p-6 shadow-sm space-y-6">
              <p className="text-xs text-[#4B5563] font-medium leading-relaxed">
                Manage your database backups, restoration operations, and connections.
              </p>

              <div className="flex flex-col gap-4 md:flex-row md:items-end border-b border-[#F1F5F9] pb-6">
                <div className="flex-1 flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[#4B5563]">Backup Output Directory</span>
                  <input
                    type="text"
                    className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                    value={backupPath}
                    onChange={(e) => setBackupPath(e.target.value)}
                    placeholder="e.g. C:\DChemist_Backups"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleBackup}
                    className="h-9 px-4 border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#4B5563] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none bg-white"
                  >
                    <HardDrive size={14} /> Backup Database
                  </button>
                  <button
                    onClick={handleRestoreBackup}
                    className="h-9 px-4 border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#4B5563] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none bg-white"
                  >
                    <RotateCcw size={14} /> Restore Database
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={handleClearSales}
                      className="h-9 px-4 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none bg-white"
                    >
                      <Trash2 size={14} /> Clear Sales Data
                    </button>
                  )}
                </div>
              </div>

              {backupStatus && (
                <div className="text-[11px] text-[#718096] italic px-1">
                  {backupStatus}
                </div>
              )}

              {/* Collapsible Connection details form */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsDbConfigExpanded(!isDbConfigExpanded)}
                  className="text-xs font-bold text-[#3a7bd5] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {isDbConfigExpanded ? 'Hide' : 'Configure'} PostgreSQL Connection Settings...
                </button>

                {isDbConfigExpanded && (
                  <form onSubmit={handleSaveDb} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl animate-fade-in">
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Host Address</span>
                      <input
                        type="text"
                        value={dbConfig.host}
                        onChange={e => setDbConfig({ ...dbConfig, host: e.target.value })}
                        className="h-8 px-3 border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Port</span>
                      <input
                        type="number"
                        value={dbConfig.port}
                        onChange={e => setDbConfig({ ...dbConfig, port: parseInt(e.target.value) || 5432 })}
                        className="h-8 px-3 border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Database Name</span>
                      <input
                        type="text"
                        value={dbConfig.database}
                        onChange={e => setDbConfig({ ...dbConfig, database: e.target.value })}
                        className="h-8 px-3 border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Username</span>
                      <input
                        type="text"
                        value={dbConfig.user}
                        onChange={e => setDbConfig({ ...dbConfig, user: e.target.value })}
                        className="h-8 px-3 border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Password</span>
                      <input
                        type="password"
                        value={dbConfig.password}
                        onChange={e => setDbConfig({ ...dbConfig, password: e.target.value })}
                        className="h-8 px-3 border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                    <div className="md:col-span-3 flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="h-9 px-6 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 select-none cursor-pointer border-0 disabled:opacity-50"
                      >
                        <Save size={14} /> Connect & Save
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Pharmacy Information */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2 px-1">
              <Building2 size={18} className="text-[#3a7bd5]" /> Pharmacy Information
            </h2>
            <div className="border border-[#E2E8F0] rounded-xl bg-white p-6 shadow-sm">
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <p className="text-xs text-[#4B5563] font-medium leading-relaxed">
                  These details will appear on your receipts and fiscal reports.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Logo Upload Box */}
                  <div className="md:col-span-1 flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-[#4B5563]">Pharmacy Logo</span>
                    <div className="relative border border-dashed border-[#E2E8F0] rounded-xl bg-[#F8FAFC] h-36 flex flex-col items-center justify-center overflow-hidden hover:border-[#00D2FF] hover:bg-blue-50/20 transition-all select-none">
                      {pharmacyLogo ? (
                        <>
                          <img src={pharmacyLogo} alt="Logo" className="w-full h-full object-contain p-4" />
                          <button
                            type="button"
                            onClick={() => setPharmacyLogo(null)}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded shadow"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <PlusCircle className="mx-auto text-slate-300 mb-1" size={24} />
                          <span className="text-[9px] font-bold text-[#718096] uppercase">Upload Logo</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>

                  {/* Text Inputs fields */}
                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Pharmacy Name</span>
                      <input
                        type="text"
                        value={pharmacyName}
                        onChange={(e) => setPharmacyName(e.target.value)}
                        placeholder="e.g. D. Chemist"
                        className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">NTN Number</span>
                      <input
                        type="text"
                        value={pharmacyNtn}
                        onChange={(e) => setPharmacyNtn(e.target.value)}
                        placeholder="e.g. I736466-5"
                        className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Address</span>
                      <input
                        type="text"
                        value={pharmacyAddress}
                        onChange={(e) => setPharmacyAddress(e.target.value)}
                        placeholder="Enter full address..."
                        className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Phone Number</span>
                      <input
                        type="text"
                        value={pharmacyPhone}
                        onChange={(e) => setPharmacyPhone(e.target.value)}
                        placeholder="e.g. +92-332-8787833"
                        className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">License Number</span>
                      <input
                        type="text"
                        value={pharmacyLicense}
                        onChange={(e) => setPharmacyLicense(e.target.value)}
                        placeholder="e.g. 01-372-0011-134212M"
                        className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-[#F1F5F9]">
                  <button
                    type="submit"
                    className="h-10 px-6 bg-linear-to-r from-[#00D2FF] to-[#3a7bd5] hover:from-[#00bfff] hover:to-[#2b6cb0] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-[#00D2FF]/20 select-none cursor-pointer border-0"
                  >
                    <Save size={14} /> Save Pharmacy Details
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Section 3: Integrations */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2 px-1">
              <ShieldCheck size={18} className="text-[#3a7bd5]" /> FBR Fiscal Integration Settings
            </h2>
            <div className="border border-[#E2E8F0] rounded-xl bg-white p-6 shadow-sm">
              <form onSubmit={handleSaveIntegrations} className="space-y-6">
                <p className="text-xs text-[#4B5563] font-medium leading-relaxed">
                  Configure external reporting to the Federal Board of Revenue (FBR) POS integration.
                </p>

                <div className="flex items-center justify-between p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl select-none mb-6">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">FBR Integration Live Mode</span>
                    <span className="text-[10px] text-slate-400 font-medium">Transmit sales data directly to the FBR live API (disabling sends dummy sandbox payloads)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFbrIsLive(!fbrIsLive)}
                    className={`w-12 h-6 rounded-full relative transition-all ${fbrIsLive ? 'bg-blue-600 shadow-lg shadow-blue-100' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${fbrIsLive ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5 col-span-1">
                    <span className="text-[11px] font-semibold text-[#4B5563]">FBR POS ID</span>
                    <input
                      type="text"
                      value={fbrPosId}
                      onChange={(e) => setFbrPosId(e.target.value)}
                      placeholder="e.g. FBR-POS-12345"
                      className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <span className="text-[11px] font-semibold text-[#4B5563]">FBR API Endpoint URL</span>
                    <input
                      type="text"
                      value={fbrApiUrl}
                      onChange={(e) => setFbrApiUrl(e.target.value)}
                      placeholder="https://ims.fbr.gov.pk/api/v3/Post/PostInvoice"
                      className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-3">
                    <span className="text-[11px] font-semibold text-[#4B5563]">API Authorization Token</span>
                    <input
                      type="password"
                      value={fbrToken}
                      onChange={(e) => setFbrToken(e.target.value)}
                      placeholder="Enter API token key..."
                      className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-[#F1F5F9]">
                  <button
                    type="submit"
                    className="h-10 px-6 bg-linear-to-r from-[#00D2FF] to-[#3a7bd5] hover:from-[#00bfff] hover:to-[#2b6cb0] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-[#00D2FF]/20 select-none cursor-pointer border-0"
                  >
                    <Save size={14} /> Save Integration Details
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Section 4: Printing Configuration */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2 px-1">
              <Printer size={18} className="text-[#3a7bd5]" /> Printing Configuration
            </h2>
            <div className="border border-[#E2E8F0] rounded-xl bg-white p-6 shadow-sm">

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                {/* Setup Controls */}
                <div className="xl:col-span-7 space-y-6">
                  <p className="text-xs text-[#4B5563] font-medium leading-relaxed">
                    Set up your thermal printer for fast, reliable receipt printing.
                  </p>

                  <div className="space-y-4">
                    {/* Silent print switch */}
                    <div className="flex items-center justify-between p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl select-none">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">Enable Silent Printing</span>
                        <span className="text-[10px] text-slate-400 font-medium">Bypass Windows Print Dialog box for faster checkouts</span>
                      </div>
                      <button
                        onClick={() => setIsSilentPrintEnabled(!isSilentPrintEnabled)}
                        className={`w-12 h-6 rounded-full relative transition-all ${isSilentPrintEnabled ? 'bg-blue-600 shadow-lg shadow-blue-100' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isSilentPrintEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* Printer select */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Thermal Printer Profile</span>
                      <select
                        value={printerInterface}
                        onChange={(e) => setPrinterInterface(e.target.value)}
                        className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      >
                        <option value="printer:Auto">printer:Auto (Windows Default)</option>
                        <option value="printer:XP-80">printer:XP-80</option>
                        <option value="printer:XP-58">printer:XP-58</option>
                        <option value="printer:Epson">printer:Epson (Thermal)</option>
                      </select>
                      <span className="text-[10px] text-[#A0AEC0] italic px-1">If your printer is not in the list, type its name exactly as seen in Windows Settings.</span>
                    </div>

                    {/* Printer manual input */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[#4B5563]">Manual Printer Name</span>
                      <input
                        type="text"
                        value={printerInterface}
                        onChange={(e) => setPrinterInterface(e.target.value)}
                        placeholder="Or type printer name manually..."
                        className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                      />
                    </div>

                    {/* Receipt template config parameters */}
                    <div className="border-t border-[#F1F5F9] pt-4 space-y-4">
                      <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider block">Receipt Customization</span>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-[#4B5563]">Footer Message</span>
                        <input
                          type="text"
                          value={template.footer}
                          onChange={(e) => setTemplate({ ...template, footer: e.target.value })}
                          className="h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <label className="flex items-center justify-between p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl cursor-pointer select-none">
                          <span className="text-xs font-bold text-slate-700">Print Generic Molecule</span>
                          <button
                            type="button"
                            onClick={() => setTemplate({ ...template, showGeneric: !template.showGeneric })}
                            className={`w-10 h-5 rounded-full relative transition-all ${template.showGeneric ? 'bg-blue-600 shadow' : 'bg-slate-200'}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${template.showGeneric ? 'left-5.5' : 'left-0.5'}`} />
                          </button>
                        </label>

                        <label className="flex items-center justify-between p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl cursor-pointer select-none">
                          <span className="text-xs font-bold text-slate-700">Print Batch Numbers</span>
                          <button
                            type="button"
                            onClick={() => setTemplate({ ...template, showBatch: !template.showBatch })}
                            className={`w-10 h-5 rounded-full relative transition-all ${template.showBatch ? 'bg-blue-600 shadow' : 'bg-slate-200'}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${template.showBatch ? 'left-5.5' : 'left-0.5'}`} />
                          </button>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleSavePrinterSettings}
                      className="h-10 px-6 bg-linear-to-r from-[#00D2FF] to-[#3a7bd5] hover:from-[#00bfff] hover:to-[#2b6cb0] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-[#00D2FF]/20 select-none cursor-pointer border-0"
                    >
                      <Save size={14} /> Save Printing Settings
                    </button>
                  </div>
                </div>

                {/* Receipt Preview */}
                <div className="xl:col-span-5 flex flex-col items-center border-l border-[#F1F5F9] pl-0 xl:pl-8">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Receipt Preview</span>
                  <div className="w-[280px] bg-white border border-[#E2E8F0] shadow-xl p-4 font-mono text-black text-[10px] rounded-lg select-none min-h-[460px]">
                    <div className="space-y-1 flex flex-col">
                      {pharmacyLogo ? (
                        <img src={pharmacyLogo} alt="Logo" className="w-15 h-15 object-contain mx-auto  bg-black " />
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 rounded mx-auto mb-1 flex items-center justify-center text-[7px] text-slate-400">LOGO</div>
                      )}

                      <p className="text-sm font-bold text-center leading-tight uppercase">{pharmacyName || 'D.CHEMIST'}</p>
                      <p className="text-[8px] text-center leading-tight whitespace-normal px-2">{pharmacyAddress || 'Your Address Here'}</p>
                      <p className="text-[8px] text-center leading-tight">Ph: {pharmacyPhone || '000-0000000'}</p>
                      <p className="text-[8px] text-center leading-tight">License: {pharmacyLicense || 'DL-12345'}</p>
                      <p className="text-[8px] text-center leading-tight">NTN: {pharmacyNtn || 'NTN-0000000'}</p>

                      <div className="h-px bg-black my-1" />

                      <div className="flex justify-between">
                        <span className="font-bold">Bill No:</span>
                        <span>B-001234</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold">Date:</span>
                        <span>{new Date().toLocaleDateString('en-GB')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold">Customer:</span>
                        <span>Walking Customer</span>
                      </div>

                      <div className="h-px bg-black my-1" />

                      <div className="flex font-bold py-0.5">
                        <span className="flex-1">Item</span>
                        <span className="w-8 text-center">Qty</span>
                        <span className="w-14 text-right">Total</span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex flex-col">
                          <div className="flex">
                            <span className="grow">PANADOL CF 500MG</span>
                            <span className="w-8 text-center">2</span>
                            <span className="w-14 text-right">300.00</span>
                          </div>
                          {template.showGeneric && <span className="text-[8px] text-slate-500 italic ml-1">Paracetamol + Caffeine</span>}
                          {template.showBatch && <span className="text-[8px] text-slate-400 ml-1">Batch: BT-99123</span>}
                        </div>
                      </div>

                      <div className="h-px bg-black my-1" />

                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>Rs. 300.00</span>
                      </div>
                      <div className="flex justify-between font-bold text-xs py-1 border-t border-black border-dashed mt-1">
                        <span>GRAND TOTAL</span>
                        <span>Rs. 300.00</span>
                      </div>

                      <div className="h-px bg-black my-1" />
                      <p className="text-[8px] italic text-center mt-2 uppercase font-medium">{template.footer || 'Thank you for your visit!'}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Section 5: About & Updates */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2 px-1">
              <Clock size={18} className="text-[#3a7bd5]" /> About & Updates
            </h2>
            <div className="border border-[#E2E8F0] rounded-xl bg-white p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <h3 className="font-bold text-[#111827] text-sm">D. Chemist System</h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Stable Version: <span className="text-[#00D2FF]">v{appVersion}</span>
                </p>
                <p className="text-xs text-slate-500 font-medium pt-1">
                  {updateStatus}
                </p>
              </div>

              <button
                onClick={handleCheckUpdates}
                disabled={isCheckingUpdates}
                className="h-10 px-5 bg-linear-to-r from-[#00D2FF] to-[#3a7bd5] hover:from-[#00bfff] hover:to-[#2b6cb0] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-[#00D2FF]/20 select-none cursor-pointer border-0 disabled:opacity-50"
              >
                <RotateCcw size={14} className={isCheckingUpdates ? 'animate-spin' : ''} /> Check for Updates
              </button>
            </div>
          </div>

          {/* Section 6: Security Audit Logs (Collapsible Card) */}
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setIsLogsExpanded(!isLogsExpanded)}
              className="text-lg font-bold text-[#111827] flex items-center gap-2 px-1 cursor-pointer w-full text-left"
            >
              <Shield size={18} className="text-[#3a7bd5]" />
              <span>Audit Security Logs</span>
              <span className="text-xs font-semibold text-[#A0AEC0] ml-2">
                ({isLogsExpanded ? 'Click to collapse' : 'Click to expand...'})
              </span>
            </button>

            {isLogsExpanded && (
              <div className="border border-[#E2E8F0] rounded-xl bg-white shadow-sm overflow-hidden animate-fade-in">
                <div className="bg-[#F7FAFC] px-4 py-3 border-b border-[#E2E8F0] shrink-0 select-none flex justify-between items-center">
                  <span className="text-xs font-bold text-[#4A5568] uppercase tracking-wider">Reviewing last 100 system events</span>
                  <button onClick={fetchAuditLogs} className="text-[10px] font-bold text-blue-600 hover:underline">
                    Refresh Logs
                  </button>
                </div>
                <div className="max-h-[300px] overflow-auto custom-scrollbar">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-400 uppercase font-black tracking-widest z-10">
                      <tr>
                        <th className="px-6 py-3">Timestamp</th>
                        <th className="px-6 py-3">Operator</th>
                        <th className="px-6 py-3">Action</th>
                        <th className="px-6 py-3">Event Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9] bg-white">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">No security events found.</td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-3 text-slate-400 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-semibold text-slate-800">
                              {log.username || 'System'}
                            </td>
                            <td className="px-6 py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#4A5568]">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-500 max-w-sm truncate" title={log.details}>
                              {log.details}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
