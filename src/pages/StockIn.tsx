import { useState, useEffect } from 'react';
import type { Medicine, Category, Manufacturer, Supplier } from '../types/models';
import {
  Package,
  Trash2,
  Save,
  Barcode,
  ClipboardList,
  Plus,
  Calendar,
  Building2,
  Tag,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  Truck,
  FileText,
  RefreshCw
} from 'lucide-react';

export default function StockIn() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [selectedStock, setSelectedStock] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Session Level Info
  const [session, setSession] = useState({
    supplierId: '',
    invoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0]
  });

  // Entry Form Mode
  const [isNewMedicine, setIsNewMedicine] = useState(false);
  type InputMode = 'Box' | 'Packet' | 'Tablet';
  const [inputMode, setInputMode] = useState<InputMode>('Box');

  // Main Entry Form
  const [entryForm, setEntryForm] = useState({
    medicineId: 0,
    name: '',
    genericName: '',
    barcode: '',
    categoryId: '',
    manufacturerId: '',
    dosageForm: 'Tablet',
    strength: '',
    gstPercent: 0,
    batchNo: '',
    expiryDate: '',
    unitsPerPack: 10,
    packQty: 1,
    purchaseTotal: 0,
    sellingTotal: 0,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [catRes, mfgRes, supRes] = await Promise.all([
        (window as any).electronAPI.dbQuery('categories:getAll'),
        (window as any).electronAPI.dbQuery('manufacturers:getAll'),
        (window as any).electronAPI.dbQuery('suppliers:getAll')
      ]);
      if (catRes.success) setCategories(catRes.data);
      if (mfgRes.success) setManufacturers(mfgRes.data);
      if (supRes.success) setSuppliers(supRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    setEntryForm(prev => ({ ...prev, name: term }));
    if (term.length < 1) {
      setSearchResults([]);
      return;
    }
    const res = await (window as any).electronAPI.dbQuery('medicines:search', { term });
    if (res.success) setSearchResults(res.data);
  };

  const selectMedicine = (med: Medicine) => {
    setEntryForm({
      ...entryForm,
      medicineId: med.id,
      name: med.name,
      genericName: med.genericName || '',
      barcode: med.barcode || '',
      categoryId: med.categoryId?.toString() || '',
      manufacturerId: med.manufacturerId?.toString() || '',
      dosageForm: med.dosageForm || 'Tablet',
      strength: med.strength || '',
      gstPercent: med.gstPercent || 0,
      batchNo: `BT-${Date.now().toString().slice(-6)}`,
    });
    setIsNewMedicine(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  const calculateTotalUnits = () => {
    if (inputMode === 'Tablet') return entryForm.packQty;
    return entryForm.unitsPerPack * entryForm.packQty;
  };

  const handleAddToList = async () => {
    if (!entryForm.name || !entryForm.batchNo || !entryForm.expiryDate) {
      setMessage({ type: 'error', text: "Please fill Name, Batch and Expiry Date." });
      return;
    }

    let mid = entryForm.medicineId;

    if (isNewMedicine || mid === 0) {
      const res = await (window as any).electronAPI.dbQuery('medicines:create', {
        name: entryForm.name,
        genericName: entryForm.genericName,
        barcode: entryForm.barcode,
        categoryId: parseInt(entryForm.categoryId) || null,
        manufacturerId: parseInt(entryForm.manufacturerId) || null,
        dosageForm: entryForm.dosageForm,
        strength: entryForm.strength,
        gstPercent: entryForm.gstPercent
      });
      if (res.success) {
        mid = res.data.id;
      } else {
        setMessage({ type: 'error', text: "Could not register medicine: " + res.error });
        return;
      }
    }

    const totalUnits = calculateTotalUnits();
    const unitPurchase = entryForm.purchaseTotal / totalUnits;
    const unitSelling = entryForm.sellingTotal / totalUnits;

    setSelectedStock(prev => [...prev, {
      ...entryForm,
      medicineId: mid,
      totalUnits,
      unitPurchase,
      unitSelling,
      id: Date.now()
    }]);

    setEntryForm({
      medicineId: 0,
      name: '',
      genericName: '',
      barcode: '',
      categoryId: '',
      manufacturerId: '',
      dosageForm: 'Tablet',
      strength: '',
      gstPercent: 0,
      batchNo: '',
      expiryDate: '',
      unitsPerPack: 10,
      packQty: 1,
      purchaseTotal: 0,
      sellingTotal: 0,
    });
    setIsNewMedicine(false);
    setMessage({ type: 'success', text: "Added to pending stock list." });
  };

  const removeItem = (id: number) => {
    setSelectedStock(selectedStock.filter(item => item.id !== id));
  };

  const handleSaveAll = async () => {
    if (selectedStock.length === 0) return;
    setIsLoading(true);
    try {
      for (const item of selectedStock) {
        await (window as any).electronAPI.dbQuery('batches:create', {
          medicineId: item.medicineId,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          purchasePrice: item.unitPurchase,
          sellingPrice: item.unitSelling,
          remainingUnits: item.totalUnits,
          initialUnits: item.totalUnits,
          invoiceNo: session.invoiceNo,
          invoiceDate: session.invoiceDate,
          supplierId: parseInt(session.supplierId) || null
        });
      }
      setSelectedStock([]);
      setMessage({ type: 'success', text: "Stock saved and updated successfully." });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "Failed to save stock." });
    } finally {
      setIsLoading(false);
    }
  };

  const grandTotal = selectedStock.reduce((acc, s) => acc + s.purchaseTotal, 0);
  const profitMargin = entryForm.purchaseTotal > 0
    ? (((entryForm.sellingTotal - entryForm.purchaseTotal) / entryForm.purchaseTotal) * 100).toFixed(0)
    : "0";

  return (
    <div className="h-full flex flex-col gap-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
              <PlusCircle size={24} />
            </div>
            Inventory Inbound
          </h1>
          <p className="text-slate-400 text-sm font-medium">Record new stock arrivals and register new products.</p>
        </div>

        {message && (
          <div className={`px-6 py-3 rounded-2xl border flex items-center gap-3 animate-in slide-in-from-right-4 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
            }`}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-xs font-bold uppercase tracking-widest">{message.text}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
        {/* LEFT: Entry Form */}
        <div className="w-full lg:w-[420px] flex flex-col gap-6 shrink-0">
          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100 flex flex-col overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                <Tag size={16} className="text-indigo-600" />
                Product Details
              </h2>
              <button
                onClick={() => { setIsNewMedicine(!isNewMedicine); setEntryForm({ ...entryForm, medicineId: 0 }); }}
                className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all uppercase tracking-widest shadow-sm ${isNewMedicine
                  ? 'bg-rose-500 text-white shadow-rose-100'
                  : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                  }`}
              >
                {isNewMedicine ? 'Cancel' : 'New Medicine'}
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar max-h-[600px]">
              {/* Product Identification */}
              <div className="space-y-5">
                <div className="relative group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Barcode / EAN</label>
                  <Barcode className="absolute left-4 top-[38px] text-slate-400 group-focus-within:text-indigo-600" size={18} />
                  <input
                    value={entryForm.barcode}
                    onChange={e => setEntryForm({ ...entryForm, barcode: e.target.value })}
                    placeholder="Scan or enter barcode..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  />
                </div>

                <div className="relative group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Product Name</label>
                  <Package className="absolute left-4 top-[38px] text-slate-400 group-focus-within:text-indigo-600" size={18} />
                  <input
                    value={searchTerm || entryForm.name}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="e.g. Panadol CF..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto animate-in zoom-in-95">
                      {searchResults.map(med => (
                        <button
                          key={med.id}
                          onClick={() => selectMedicine(med)}
                          className="w-full p-5 text-left hover:bg-indigo-50 border-b border-slate-50 last:border-none flex items-center justify-between group/item"
                        >
                          <div>
                            <p className="text-sm font-black text-slate-800 group-hover/item:text-indigo-600">{med.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{med.genericName} • {med.strength}</p>
                          </div>
                          <ArrowRight size={14} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isNewMedicine && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-4 p-6 bg-indigo-50/50 rounded-3xl border-2 border-indigo-100">
                    <div className="col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Generic / Molecule</label>
                      <input value={entryForm.genericName} onChange={e => setEntryForm({ ...entryForm, genericName: e.target.value })} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Category</label>
                      <select value={entryForm.categoryId} onChange={e => setEntryForm({ ...entryForm, categoryId: e.target.value })} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                        <option value="">Select</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Strength</label>
                      <input value={entryForm.strength} onChange={e => setEntryForm({ ...entryForm, strength: e.target.value })} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" placeholder="500mg" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Sales Tax (GST %)</label>
                    <input type="number" value={entryForm.gstPercent} onChange={e => setEntryForm({ ...entryForm, gstPercent: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Batch #</label>
                    <input value={entryForm.batchNo} onChange={e => setEntryForm({ ...entryForm, batchNo: e.target.value })} placeholder="BN-XXXX" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Expiry Date</label>
                    <input type="date" value={entryForm.expiryDate} onChange={e => setEntryForm({ ...entryForm, expiryDate: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold" />
                  </div>
                </div>
              </div>

              {/* Quantities */}
              <div className="space-y-5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Inventory Mode</label>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  {(['Box', 'Packet', 'Tablet'] as const).map(mode => (
                    <button key={mode} onClick={() => setInputMode(mode)} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${inputMode === mode ? 'bg-white shadow-lg text-indigo-600' : 'text-slate-400'}`}>{mode}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-5">
                  {inputMode !== 'Tablet' && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Units / {inputMode}</label>
                      <input type="number" value={entryForm.unitsPerPack} onChange={e => setEntryForm({ ...entryForm, unitsPerPack: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-center" />
                    </div>
                  )}
                  <div className={inputMode === 'Tablet' ? 'col-span-2' : ''}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Total {inputMode}s</label>
                    <input type="number" value={entryForm.packQty} onChange={e => setEntryForm({ ...entryForm, packQty: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-center" />
                  </div>
                </div>
                <div className="flex justify-between items-center p-5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Units Received</span>
                  <span className="text-xl font-black">{calculateTotalUnits()} <span className="text-[10px]">Units</span></span>
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Purchase Total</label>
                    <input type="number" value={entryForm.purchaseTotal} onChange={e => setEntryForm({ ...entryForm, purchaseTotal: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-right" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Selling Total</label>
                    <input type="number" value={entryForm.sellingTotal} onChange={e => setEntryForm({ ...entryForm, sellingTotal: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-right" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Margin Estimate:</span>
                    <span className={`text-sm font-black ${Number(profitMargin) > 15 ? 'text-emerald-500' : 'text-orange-500'}`}>{profitMargin}%</span>
                  </div>
                </div>

                <button
                  onClick={handleAddToList}
                  className="w-full bg-slate-900 hover:bg-black text-white h-16 rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-slate-100"
                >
                  <Plus size={20} /> Add to Stock List
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Table & Finalize */}
        <div className="flex-1 flex flex-col gap-8 overflow-hidden">
          {/* Shipment Details */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-3 flex items-center gap-2 pb-2 border-b border-slate-50">
              <Truck size={18} className="text-indigo-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Shipment & Vendor Info</h3>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Supplier Company</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select value={session.supplierId} onChange={e => setSession({ ...session, supplierId: e.target.value })} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-indigo-600 transition-all appearance-none">
                  <option value="">Select Vendor</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Invoice Reference</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input value={session.invoiceNo} onChange={e => setSession({ ...session, invoiceNo: e.target.value })} placeholder="INV-XXXXX" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-indigo-600 transition-all" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Invoice Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="date" value={session.invoiceDate} onChange={e => setSession({ ...session, invoiceDate: e.target.value })} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-indigo-600 transition-all" />
              </div>
            </div>
          </div>

          {/* Pending List */}
          <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-100 z-10">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-5">Product Details</th>
                    <th className="px-8 py-5">Batch & Expiry</th>
                    <th className="px-8 py-5 text-center">Inbound Qty</th>
                    <th className="px-8 py-5 text-right">Investment</th>
                    <th className="px-8 py-5 text-right">Selling Pr.</th>
                    <th className="px-8 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedStock.map(item => (
                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-all group">
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-slate-800">{item.name}</p>
                        <span className={`inline-block mt-1 text-[8px] px-2 py-0.5 rounded-lg font-black uppercase tracking-widest ${item.medicineId === 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                          {item.medicineId === 0 ? 'New Entry' : 'ID: ' + item.medicineId}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-mono text-slate-600 text-[10px] font-bold">{item.batchNo}</div>
                        <div className="text-[10px] text-rose-400 font-bold mt-0.5">{item.expiryDate}</div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="text-lg font-black text-slate-900">{item.totalUnits}</span>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Units</p>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-slate-800 text-sm">Rs. {item.purchaseTotal.toLocaleString()}</td>
                      <td className="px-8 py-6 text-right font-black text-emerald-600 text-sm">Rs. {item.unitSelling.toLocaleString()} <span className="text-[9px] text-slate-400">/unit</span></td>
                      <td className="px-8 py-6 text-right">
                        <button onClick={() => removeItem(item.id)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {selectedStock.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-32 text-center text-slate-200">
                        <div className="flex flex-col items-center">
                          <ClipboardList size={64} className="mb-4 opacity-10" />
                          <p className="text-sm font-black uppercase tracking-widest">No pending items in list</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="p-10 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>

              <div className="flex flex-wrap gap-12 relative z-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Total SKUs</p>
                  <p className="text-3xl font-black">{selectedStock.length}</p>
                </div>
                <div className="w-px h-12 bg-white/10" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Grand Total Investment</p>
                  <p className="text-3xl font-black text-emerald-400">Rs. {grandTotal.toLocaleString()}</p>
                </div>
              </div>

              <button
                onClick={handleSaveAll}
                disabled={isLoading || selectedStock.length === 0}
                className="w-full md:w-auto px-12 h-16 bg-emerald-500 hover:bg-emerald-400 text-white rounded-3xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-30 flex items-center justify-center gap-3 active:scale-95 relative z-10"
              >
                {isLoading ? <RefreshCw className="animate-spin" /> : <Save size={20} />}
                Post to Inventory
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
