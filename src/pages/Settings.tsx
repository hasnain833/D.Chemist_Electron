import React, { useState, useEffect } from 'react';
import {
  Database,
  Printer,
  HardDrive,
  Shield,
  Cpu,
  ChevronRight,
  UserCircle,
  Globe,
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Clock,
  ExternalLink,
  ShieldCheck,
  Building2,
  Phone,
  FileText,
  Key,
  PlusCircle,
  Trash2,
  Tag
} from 'lucide-react';
import { useAuth } from '../AuthContext';

type TabType = 'profile' | 'db' | 'printer' | 'template' | 'backup' | 'audit';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  // Profile Settings
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyNtn, setPharmacyNtn] = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');
  const [pharmacyPhone, setPharmacyPhone] = useState('');
  const [pharmacyLicense, setPharmacyLicense] = useState('');
  const [pharmacyLogo, setPharmacyLogo] = useState<string | null>(null);

  // DB Settings
  const [dbConfig, setDbConfig] = useState({ host: 'localhost', port: 5432, database: 'dchemist', user: 'postgres', password: '' });

  // Printer Settings
  const [printerInterface, setPrinterInterface] = useState('printer:Auto');

  // Receipt Template Settings
  const [template, setTemplate] = useState({
    header: 'D.CHEMIST',
    subHeader: 'PHARMACY & LABS',
    footer: 'Thank you for your visit!',
    showGeneric: true,
    showBatch: true,
    showExpiry: false,
    fontSize: 'Small'
  });

  const [auditLogs, setAuditLogs] = useState<any[]>([]);

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

      setDbConfig({ host: host || 'localhost', port: port || 5432, database: database || 'dchemist', user: pgUser || 'postgres', password: pgPass || '' });
      if (printer?.interface) setPrinterInterface(printer.interface);
      if (profile.name) setPharmacyName(profile.name);
      if (profile.ntn) setPharmacyNtn(profile.ntn);
      if (profile.address) setPharmacyAddress(profile.address);
      if (profile.phone) setPharmacyPhone(profile.phone);
      if (profile.license) setPharmacyLicense(profile.license);
      if (profile.logo) setPharmacyLogo(profile.logo);

      setTemplate(prev => ({ ...prev, ...savedTemplate }));
      setAppVersion(version);
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
      alert("Saved: Pharmacy profile updated.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDb = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await (window as any).electronAPI.dbReconnect(dbConfig);
      if (res.success) alert("Connected: Database settings updated and verified.");
      else alert("Error: Could not connect to database.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrinter = async () => {
    setIsSaving(true);
    try {
      await (window as any).electronAPI.setSetting('printerConfig', { interface: printerInterface });
      alert("Saved: Printer interface updated.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    try {
      await (window as any).electronAPI.setSetting('receiptTemplate', template);
      alert("Saved: Receipt template updated.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col animate-in fade-in duration-700 pb-8">
      {/* Premium Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <SettingsIcon size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Settings</h1>
          </div>
          <p className="text-slate-400 text-sm font-medium ml-1">Configure your pharmacy hardware, database, and tax compliance.</p>
        </div>

        {isSaving && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 animate-pulse">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Saving Changes...</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-10 min-h-0">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-72 space-y-2 shrink-0">
          {[
            { id: 'profile', title: 'Your Pharmacy', icon: Building2, desc: 'Identity & Branding' },
            { id: 'db', title: 'Database', icon: Database, desc: 'Connection Settings' },
            { id: 'printer', title: 'Thermal Printer', icon: Printer, desc: 'ESC/POS Configuration' },
            { id: 'template', title: 'Receipt Template', icon: FileText, desc: 'Header, Footer & Fields' },
            { id: 'backup', title: 'Data Backup', icon: HardDrive, desc: 'Safety & Exports' },
            { id: 'audit', title: 'Security Logs', icon: Shield, desc: 'User Activity History' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`w-full text-left p-5 rounded-3xl border-2 transition-all flex items-center group relative overflow-hidden ${activeTab === tab.id
                ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200'
                : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                }`}
            >
              <div className={`p-2.5 rounded-2xl mr-4 transition-colors ${activeTab === tab.id ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                }`}>
                <tab.icon size={18} />
              </div>
              <div className="flex-1">
                <h3 className={`font-black text-xs uppercase tracking-wider ${activeTab === tab.id ? 'text-white' : 'text-slate-800'}`}>{tab.title}</h3>
                <p className={`text-[10px] font-medium mt-0.5 ${activeTab === tab.id ? 'text-slate-400' : 'text-slate-400'}`}>{tab.desc}</p>
              </div>
              <ChevronRight size={16} className={`transition-all ${activeTab === tab.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`} />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">
                {activeTab === 'profile' && 'Pharmacy Profile'}
                {activeTab === 'db' && 'Database Engine'}
                {activeTab === 'printer' && 'Thermal Printing'}
                {activeTab === 'template' && 'Receipt Template'}
                {activeTab === 'backup' && 'System Backup'}
                {activeTab === 'audit' && 'Activity Logs'}
              </h2>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">v{appVersion}-stable</p>
          </div>

          <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-8 max-w-4xl animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {/* Logo Upload Section */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Pharmacy Logo</label>
                    <div className="relative group">
                      <div className="w-full aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-blue-400 group-hover:bg-blue-50">
                        {pharmacyLogo ? (
                          <img src={pharmacyLogo} alt="Logo" className="w-full h-full object-contain p-8" />
                        ) : (
                          <div className="text-center p-6">
                            <PlusCircle className="mx-auto text-slate-300 mb-2" size={32} />
                            <p className="text-[10px] font-black text-slate-400 uppercase">Upload Logo</p>
                          </div>
                        )}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                      {pharmacyLogo && (
                        <button
                          type="button"
                          onClick={() => setPharmacyLogo(null)}
                          className="absolute -top-2 -right-2 bg-rose-500 text-white p-2 rounded-xl shadow-lg hover:bg-rose-600 transition-all z-10"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400 font-black uppercase text-center tracking-tighter opacity-60">Best for Thermal: B&W Square</p>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-2 gap-8">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2 px-1">
                        <Building2 size={12} /> Pharmacy Legal Name
                      </label>
                      <input
                        value={pharmacyName}
                        onChange={e => setPharmacyName(e.target.value)}
                        placeholder="e.g. D.Chemist Pharmacy & Labs"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:border-blue-600 focus:bg-white outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2 px-1">
                        <ShieldCheck size={12} /> NTN Number
                      </label>
                      <input value={pharmacyNtn} onChange={e => setPharmacyNtn(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-600 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2 px-1">
                        <FileText size={12} /> Drug License No
                      </label>
                      <input value={pharmacyLicense} onChange={e => setPharmacyLicense(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-600 outline-none transition-all" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2 px-1">
                        <Phone size={12} /> Official Contact
                      </label>
                      <input value={pharmacyPhone} onChange={e => setPharmacyPhone(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-600 outline-none transition-all" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">Full Address</label>
                      <textarea
                        value={pharmacyAddress}
                        onChange={e => setPharmacyAddress(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold resize-none focus:border-blue-600 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-10 h-16 rounded-[1.5rem] font-black text-sm flex items-center gap-2 shadow-xl shadow-blue-100 active:scale-95 transition-all">
                  <Save size={20} />
                  Save Pharmacy Identity
                </button>
              </form>
            )}

            {activeTab === 'db' && (
              <form onSubmit={handleSaveDb} className="space-y-8 max-w-2xl animate-in fade-in duration-500">
                <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-3xl flex items-start gap-4">
                  <div className="p-2 bg-blue-600 text-white rounded-xl">
                    <Database size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm">PostgreSQL Engine</h4>
                    <p className="text-xs text-blue-700 mt-1">Ensure the database server is running and accessible from this machine.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2">Host Address (IP/Localhost)</label>
                    <input value={dbConfig.host} onChange={e => setDbConfig({ ...dbConfig, host: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-600 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2">Port</label>
                    <input type="number" value={dbConfig.port} onChange={e => setDbConfig({ ...dbConfig, port: Number(e.target.value) })} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-600 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2">Database Name</label>
                    <input value={dbConfig.database} onChange={e => setDbConfig({ ...dbConfig, database: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-600 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2">Username</label>
                    <input value={dbConfig.user} onChange={e => setDbConfig({ ...dbConfig, user: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-600 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2">Password</label>
                    <input type="password" value={dbConfig.password} onChange={e => setDbConfig({ ...dbConfig, password: e.target.value })} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:border-blue-600 outline-none transition-all" />
                  </div>
                </div>
                <button type="submit" className="bg-slate-900 hover:bg-black text-white px-8 h-14 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-slate-100 active:scale-95 transition-all">
                  <RefreshCw size={18} />
                  Connect & Save
                </button>
              </form>
            )}

            {activeTab === 'printer' && (
              <div className="space-y-8 max-w-2xl animate-in fade-in duration-500">
                <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
                      <Printer size={32} className="text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">Thermal Receipt Setup</h3>
                      <p className="text-xs text-slate-400 font-medium">80mm Thermal Printer (ESC/POS)</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Printer Interface Name</label>
                      <div className="relative">
                        <Printer className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          value={printerInterface}
                          onChange={e => setPrinterInterface(e.target.value)}
                          placeholder="e.g. printer:XP-80 or TCP:192.168.1.100"
                          className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:border-blue-600 outline-none transition-all shadow-sm"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 italic px-1">Use 'printer:Auto' for default system printer.</p>
                    </div>
                  </div>
                </div>

                <button onClick={handleSavePrinter} className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-14 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-blue-100 active:scale-95 transition-all">
                  <Save size={18} />
                  Update Printer Config
                </button>
              </div>
            )}

            {activeTab === 'template' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 animate-in fade-in duration-500">
                {/* Editor Side */}
                <div className="space-y-8">
                  <div className="p-8 bg-blue-50 border-2 border-blue-100 rounded-[2.5rem] flex items-start gap-4">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl">
                      <Tag size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-blue-900 text-sm uppercase tracking-wider">Profile-Linked Template</h4>
                      <p className="text-[11px] text-blue-700 font-medium mt-1">This template automatically uses your Pharmacy Name, Logo, and Address from the Profile tab to ensure brand consistency.</p>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Receipt Customization</p>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Footer Message (Bottom)</label>
                        <textarea value={template.footer} onChange={e => setTemplate({ ...template, footer: e.target.value })} rows={2} className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 text-sm font-bold resize-none focus:border-blue-600 outline-none transition-all" />
                      </div>

                      <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-200">
                        <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer group">
                          <span className="text-xs font-bold text-slate-700">Print Generic Molecule Name</span>
                          <div className={`w-12 h-6 rounded-full relative transition-all ${template.showGeneric ? 'bg-blue-600 shadow-lg shadow-blue-100' : 'bg-slate-200'}`}>
                            <input type="checkbox" checked={template.showGeneric} onChange={e => setTemplate({ ...template, showGeneric: e.target.checked })} className="hidden" />
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${template.showGeneric ? 'left-7' : 'left-1'}`} />
                          </div>
                        </label>
                        <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer group">
                          <span className="text-xs font-bold text-slate-700">Print Batch Numbers</span>
                          <div className={`w-12 h-6 rounded-full relative transition-all ${template.showBatch ? 'bg-blue-600 shadow-lg shadow-blue-100' : 'bg-slate-200'}`}>
                            <input type="checkbox" checked={template.showBatch} onChange={e => setTemplate({ ...template, showBatch: e.target.checked })} className="hidden" />
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${template.showBatch ? 'left-7' : 'left-1'}`} />
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  <button onClick={handleSaveTemplate} className="w-full bg-slate-900 hover:bg-black text-white h-16 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-slate-100 active:scale-95 transition-all">
                    <Save size={20} />
                    Apply Template Changes
                  </button>
                </div>

                {/* Preview Side */}
                <div className="flex flex-col items-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Live Receipt Preview</p>

                  <div className="w-[280px] bg-white shadow-2xl p-[10px] font-sans text-black relative min-h-[500px]">
                    <div className="space-y-[4px] flex flex-col">
                      {/* Header Section */}
                      {pharmacyLogo ? (
                        <img src={pharmacyLogo} alt="Logo" className="w-[56px] h-[56px] object-contain mx-auto mb-[4px]" />
                      ) : (
                        <div className="w-[56px] h-[56px] bg-slate-100 rounded mx-auto mb-[4px] flex items-center justify-center text-[8px] text-slate-300">LOGO</div>
                      )}

                      <p className="text-[16px] font-bold text-center leading-tight uppercase">{pharmacyName || 'D.CHEMIST'}</p>
                      <p className="text-[10px] text-center leading-tight whitespace-normal px-2">{pharmacyAddress || 'Your Address Here'}</p>
                      <p className="text-[10px] text-center leading-tight">Ph: {pharmacyPhone || '000-0000000'}</p>
                      <p className="text-[10px] text-center leading-tight">License: {pharmacyLicense || 'DL-12345'}</p>
                      <p className="text-[10px] text-center leading-tight">NTN: {pharmacyNtn || 'NTN-0000000'}</p>

                      <div className="h-px bg-black my-[5px]" />

                      {/* Sale Info */}
                      <div className="flex justify-between text-[10px]">
                        <span className="font-semibold">Bill No:</span>
                        <span>B-001234</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="font-semibold">Date:</span>
                        <span>{new Date().toLocaleDateString()}</span>
                      </div>

                      <div className="flex justify-between text-[10px]">
                        <span className="font-semibold">Customer:</span>
                        <span>Walking Customer</span>
                      </div>

                      <div className="h-px bg-black my-[5px]" />

                      {/* Items Header */}
                      <div className="flex text-[10px] font-bold py-[2px]">
                        <span className="flex-1">Item</span>
                        <span className="w-[30px] text-center">Qty</span>
                        <span className="w-[60px] text-right">Total</span>
                      </div>

                      {/* Dynamic Items Preview */}
                      <div className="space-y-[2px]">
                        <div className="flex text-[10px]">
                          <div className="flex-1 flex flex-col">
                            <span>PANADOL CF 500MG</span>
                            {template.showGeneric && <span className="text-[9px] text-slate-500 italic ml-1">Paracetamol + Caffeine</span>}
                            {template.showBatch && <span className="text-[8px] text-slate-400 ml-1">Batch: BT-99123</span>}
                          </div>
                          <span className="w-[30px] text-center">2</span>
                          <span className="w-[60px] text-right">300.00</span>
                        </div>
                      </div>

                      <div className="h-[1px] bg-black my-[5px]" />

                      {/* Totals */}
                      <div className="flex justify-between text-[10px] py-[2px]">
                        <span>Subtotal:</span>
                        <span>Rs. 300.00</span>
                      </div>
                      <div className="flex justify-between text-[10px] py-[2px]">
                        <span>Tax (0%):</span>
                        <span>Rs. 0.00</span>
                      </div>
                      <div className="flex justify-between text-[12px] font-bold my-[5px]">
                        <span>GRAND TOTAL</span>
                        <span>Rs. 300.00</span>
                      </div>

                      <div className="h-[1px] bg-black my-[5px]" />

                      <p className="text-[10px] italic text-center mt-[10px] uppercase font-medium">{template.footer || 'Thank you for your visit!'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-8 max-w-2xl animate-in fade-in duration-500">
                <div className="p-10 bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] flex flex-col items-center text-center space-y-6">
                  <div className="p-6 bg-white rounded-[2rem] shadow-sm border border-emerald-100">
                    <ShieldCheck size={48} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-emerald-900">Protect Your Data</h3>
                    <p className="text-sm text-emerald-700 mt-2 max-w-md mx-auto leading-relaxed">
                      Create a complete cryptographic backup of your database, settings, and logs. Store it safely on an external drive.
                    </p>
                  </div>
                  <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 h-16 rounded-[1.5rem] font-black text-sm flex items-center gap-3 shadow-xl shadow-emerald-100 active:scale-95 transition-all">
                    <HardDrive size={20} />
                    Run Full System Backup
                  </button>
                </div>

                <div className="flex items-center justify-between p-6 border-2 border-slate-100 rounded-3xl">
                  <div className="flex items-center gap-3 text-slate-500">
                    <Clock size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Last Backup: Never</span>
                  </div>
                  <button className="text-[10px] font-black uppercase text-blue-600 hover:underline flex items-center gap-1">
                    Manage Old Backups <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-slate-500">Reviewing last 100 system events.</p>
                  <button onClick={() => window.location.href = '/audit'} className="text-xs font-black text-blue-600 hover:underline">View Full Audit Page</button>
                </div>
                <div className="bg-slate-50 border-2 border-slate-100 rounded-[2rem] overflow-hidden h-[500px]">
                  <div className="overflow-auto h-full custom-scrollbar">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="sticky top-0 bg-slate-100/80 backdrop-blur-md border-b border-slate-200 text-slate-400 uppercase font-black tracking-widest z-10">
                        <tr>
                          <th className="px-6 py-4">Timestamp</th>
                          <th className="px-6 py-4">Operator</th>
                          <th className="px-6 py-4">Action</th>
                          <th className="px-6 py-4">Event Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {auditLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-6 py-4 font-black text-slate-800">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">{log.username?.charAt(0).toUpperCase()}</div>
                                {log.username}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-bold">
                              <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{log.action}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
