import { useState, useEffect } from 'react';
import {
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  History,
  Info,
  Save,
  ArrowRight,
  Loader2,
  Calendar,
  Layers
} from 'lucide-react';
import { useAuth } from '../AuthContext';

interface Medicine {
  id: number;
  name: string;
  genericName: string;
}

interface Batch {
  id: number;
  batch_no: string;
  remaining_units: number;
  expiry_date: string;
  supplier_name?: string;
}

interface AlertItem {
  medicine_id: number;
  medicine_name: string;
  total_units: number;
  batch_id?: number;
  expiry_date?: string;
}

export default function InventoryAdjustment() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [lowStock, setLowStock] = useState<AlertItem[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<AlertItem[]>([]);

  const [newQty, setNewQty] = useState<number>(0);
  const [reason, setReason] = useState('Corrected');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const reasons = ["Damaged", "Theft", "Expired", "Corrected", "Return to Supplier"];

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) searchMedicines();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadAlerts = async () => {
    try {
      const lowResult = await (window as any).electronAPI.dbQuery('batches:getLowStock', { threshold: 10 });
      if (lowResult.success) setLowStock(lowResult.data);

      const expResult = await (window as any).electronAPI.dbQuery('batches:getExpiring', { daysAhead: 90 });
      if (expResult.success) setExpiringSoon(expResult.data);
    } catch (err) {
      console.error(err);
    }
  };

  const searchMedicines = async () => {
    try {
      const result = await (window as any).electronAPI.dbQuery('medicines:search', { term: searchTerm });
      if (result.success) setMedicines(result.data);
    } catch (err) {
      console.error(err);
    }
  };

  const selectMedicine = async (med: Medicine) => {
    setSelectedMedicine(med);
    setMedicines([]);
    setSearchTerm(med.name);
    try {
      const result = await (window as any).electronAPI.dbQuery('batches:getByMedicine', { medicineId: med.id });
      if (result.success) {
        setBatches(result.data);
        setSelectedBatch(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjust = async () => {
    if (!selectedBatch) return;
    setIsSubmitting(true);
    setStatus(null);

    try {
      const result = await (window as any).electronAPI.dbQuery('batches:updateManual', {
        batchId: selectedBatch.id,
        newQty,
        reason,
        userId: user?.id
      });

      if (result.success) {
        setStatus({ type: 'success', message: 'Inventory updated successfully.' });
        selectMedicine(selectedMedicine!); // Refresh batches
        loadAlerts();
      } else {
        setStatus({ type: 'error', message: result.error || 'Update failed.' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="text-indigo-600" />
            Inventory Adjustment
          </h1>
          <p className="text-slate-500 text-sm">Correct stock levels and manage inventory health.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Alerts */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-rose-50/50 flex items-center gap-2">
              <AlertTriangle size={18} className="text-rose-500" />
              <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Critical Alerts</h2>
            </div>
            <div className="p-2 max-h-[300px] overflow-auto custom-scrollbar">
              {lowStock.map((item, i) => (
                <button
                  key={i}
                  onClick={() => selectMedicine({ id: item.medicine_id, name: item.medicine_name, genericName: '' })}
                  className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-colors group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{item.medicine_name}</span>
                    <span className="px-1.5 py-0.5 rounded-lg bg-rose-100 text-rose-700 text-[10px] font-bold">LOW: {item.total_units}</span>
                  </div>
                </button>
              ))}
              {expiringSoon.map((item, i) => (
                <button
                  key={i}
                  onClick={() => selectMedicine({ id: item.medicine_id, name: item.medicine_name, genericName: '' })}
                  className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-colors group"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{item.medicine_name}</span>
                    <span className="px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold">EXP: {new Date(item.expiry_date!).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 rounded-lg">
                <Info size={20} />
              </div>
              <h4 className="font-bold text-sm">Policy Reminder</h4>
            </div>
            <p className="text-xs text-indigo-100 leading-relaxed">
              All manual adjustments are logged to the audit trail. Please provide an accurate reason for any stock correction.
            </p>
          </div>
        </div>

        {/* Middle Column: Selection & Search */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Step 1: Search Medicine</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Type medicine name..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {medicines.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                    {medicines.map((med) => (
                      <button
                        key={med.id}
                        onClick={() => selectMedicine(med)}
                        className="w-full px-4 py-3 text-left hover:bg-indigo-50 border-b border-slate-50 last:border-0 transition-colors flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-700">{med.name}</p>
                          <p className="text-[10px] text-slate-400">{med.genericName}</p>
                        </div>
                        <ArrowRight size={14} className="text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedMedicine && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Step 2: Select Batch</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {batches.map((batch) => (
                    <button
                      key={batch.id}
                      onClick={() => {
                        setSelectedBatch(batch);
                        setNewQty(batch.remaining_units);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all ${selectedBatch?.id === batch.id
                        ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/10'
                        : 'border-slate-100 hover:border-slate-300 bg-white'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400">{batch.batch_no}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${batch.remaining_units <= 10 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                          {batch.remaining_units} units
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Calendar size={12} className="text-slate-300" />
                        Exp: {new Date(batch.expiry_date).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedBatch && (
              <div className="pt-6 border-t border-slate-100 space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Step 3: New Quantity</label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="number"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-indigo-600"
                        value={newQty}
                        onChange={(e) => setNewQty(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Step 4: Reason</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 pt-4">
                  <button
                    onClick={handleAdjust}
                    disabled={isSubmitting}
                    className="w-full md:flex-1 h-14 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    Save Stock Correction
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMedicine(null);
                      setSelectedBatch(null);
                      setSearchTerm('');
                      setStatus(null);
                    }}
                    className="w-full md:w-auto px-8 h-14 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {status && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 border animate-in zoom-in-95 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}>
                    {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span className="text-sm font-medium">{status.message}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <History size={18} className="text-slate-400" />
              Adjustment Tips
            </h3>
            <ul className="space-y-3">
              {[
                "Use 'Damaged' for broken or unusable stock.",
                "Use 'Theft' only after verification.",
                "Use 'Corrected' for small counting errors.",
                "Changes are visible instantly in the medicine list."
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-xs text-slate-500">
                  <div className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
