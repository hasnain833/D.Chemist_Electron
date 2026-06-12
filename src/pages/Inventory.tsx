import { useState, useEffect } from 'react';
import type { Medicine, Category } from '../types/models';
import { Search, Edit3, Trash2, RefreshCw, Download } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

export default function Inventory() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [isBoxMode, setIsBoxMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, [searchTerm]);

  useBarcodeScanner((barcode) => setSearchTerm(barcode));

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = searchTerm.length > 0
        ? await window.electronAPI.dbQuery('medicines:search', { term: searchTerm })
        : await window.electronAPI.dbQuery('medicines:getAll');
      if (res.success) setMedicines(res.data);

      const catRes = await window.electronAPI.dbQuery('categories:getAll');
      if (catRes.success) setCategories(catRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (medicines.length === 0) {
      alert("No inventory data available to export.");
      return;
    }

    const headers = ["Name", "Generic", "Category", "Manufacturer", "Dosage", "Strength", "Stock", "Selling Price", "Purchase Price", "Expiry"];

    const escapeCsv = (text: string | undefined | null) => {
      if (!text) return "";
      const cleaned = String(text);
      if (cleaned.includes(",") || cleaned.includes('"') || cleaned.includes("\n")) {
        return `"${cleaned.replace(/"/g, '""')}"`;
      }
      return cleaned;
    };

    const lines = [
      headers.join(","),
      ...medicines.map(m => [
        escapeCsv(m.name),
        escapeCsv(m.genericName),
        escapeCsv(m.categoryName || 'General'),
        escapeCsv(m.manufacturerName || 'GSK'),
        escapeCsv(m.dosageForm),
        escapeCsv(m.strength),
        m.stockQty || 0,
        m.sellingPrice || 0,
        m.purchasePrice || 0,
        m.expiryDate ? new Date(m.expiryDate).toISOString().split('T')[0] : '—'
      ].join(","))
    ];

    const csvContent = lines.join("\n");
    const today = new Date().toISOString().split('T')[0];
    const res = await (window as any).electronAPI.exportCSV(`Inventory_Report_${today}.csv`, csvContent);
    if (res.success) {
      alert(`Success: Inventory report exported successfully to:\n${res.filePath}`);
    } else if (res.message !== 'Export cancelled.') {
      alert(`Export Error: ${res.message}`);
    }
  };

  const handleAddClick = () => {
    setEditForm({
      name: '',
      genericName: '',
      barcode: '',
      categoryId: '',
      manufacturerId: '',
      strength: ''
    });
    setIsAddMode(true);
    setIsFormExpanded(true);
  };

  const handleEditClick = (med: Medicine) => {
    setEditForm({ ...med });
    setIsAddMode(false);
    setIsFormExpanded(true);
  };

  const handleSave = async () => {
    const endpoint = isAddMode ? 'medicines:create' : 'medicines:update';
    const res = await window.electronAPI.dbQuery(endpoint, editForm);
    if (res.success) {
      fetchData();
      setIsFormExpanded(false);
      setEditForm({});
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure? This will delete the medicine.")) return;
    const res = await window.electronAPI.dbQuery('medicines:delete', { id });
    if (res.success) fetchData();
  };

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] animate-in fade-in duration-300">

      <div className="pl-[48px] pt-4 pb-2">
        <button onClick={() => {
          if (!isFormExpanded && !isAddMode && !editForm.id) {
            handleAddClick();
          } else {
            setIsFormExpanded(!isFormExpanded);
          }
        }} className="p-2 text-[#718096] hover:bg-black/5 rounded-lg transition-colors" title="Toggle Form">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">

        {/* Form Pane */}
        <div className={`transition-all duration-300 overflow-hidden flex flex-col ${isFormExpanded ? 'w-[450px] opacity-100' : 'w-0 opacity-0'}`}>
          <div className="w-[450px] pl-[48px] pb-[48px] h-full overflow-auto custom-scrollbar">
            <div className="premium-card p-8 bg-white mb-8 space-y-6">
              <h2 className="text-xl font-bold text-[#00D2FF]">
                {isAddMode ? 'Add New Medicine' : 'Edit Medicine Details'}
              </h2>

              {/* Medicine Details Section */}
              <div className="space-y-5">
                <div>
                  <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Barcode Scan</label>
                  <input
                    placeholder="Ready for scanning..."
                    value={editForm.barcode || ''}
                    onChange={e => setEditForm({ ...editForm, barcode: e.target.value })}
                    className="premium-input w-full h-10"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Medicine Name</label>
                  <input
                    placeholder="Type medicine name..."
                    value={editForm.name || ''}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="premium-input w-full h-10"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Batch Number</label>
                    <input
                      placeholder="BN-1234..."
                      value={editForm.batchNo || ''}
                      onChange={e => setEditForm({ ...editForm, batchNo: e.target.value })}
                      className="premium-input w-full h-10"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Expiry Date</label>
                    <input
                      type="date"
                      value={editForm.expiryDate ? new Date(editForm.expiryDate).toISOString().split('T')[0] : ''}
                      onChange={e => setEditForm({ ...editForm, expiryDate: e.target.value })}
                      className="premium-input w-full h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Quantity Section */}
              <div className="space-y-3">
                <label className="text-[13px] font-semibold text-[#718096]">Quantity Entry Mode</label>
                <div className="flex bg-[#EDF2F7] rounded-lg p-1 h-10 gap-1">
                  <button
                    onClick={() => setIsBoxMode(true)}
                    className={`flex-1 rounded-md text-sm font-semibold transition-all ${isBoxMode ? 'bg-white shadow-sm text-[#1A202C]' : 'text-[#718096] hover:text-[#4A5568]'}`}
                  >Box</button>
                  <button
                    onClick={() => setIsBoxMode(false)}
                    className={`flex-1 rounded-md text-sm font-semibold transition-all ${!isBoxMode ? 'bg-white shadow-sm text-[#1A202C]' : 'text-[#718096] hover:text-[#4A5568]'}`}
                  >Tablet</button>
                </div>

                {isBoxMode ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-[#718096] mb-1 block">No. of Boxes</label>
                      <input type="number" placeholder="e.g. 10" className="premium-input w-full h-10" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Packs / Box</label>
                      <input type="number" placeholder="e.g. 20" className="premium-input w-full h-10" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Tabs / Pack</label>
                      <input type="number" placeholder="e.g. 10" className="premium-input w-full h-10" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Quantity (Total Tablets)</label>
                    <input
                      type="number"
                      value={editForm.stockQty || ''}
                      onChange={e => setEditForm({ ...editForm, stockQty: parseInt(e.target.value) || 0 })}
                      className="premium-input w-full h-10"
                    />
                  </div>
                )}
              </div>

              {/* Price Section */}
              <div className="space-y-3">
                <div>
                  <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Selling Price</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={editForm.sellingPrice || ''}
                    onChange={e => setEditForm({ ...editForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="premium-input w-full h-10"
                  />
                </div>
              </div>

              {/* Edit-Mode Extra Fields */}
              {!isAddMode && (
                <div className="space-y-3 pt-3 border-t border-[#E2E8F0]">
                  <label className="text-[13px] font-semibold text-[#718096] block">Edit Details</label>
                  <div>
                    <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Category</label>
                    <select
                      value={editForm.categoryId || ''}
                      onChange={e => setEditForm({ ...editForm, categoryId: parseInt(e.target.value) })}
                      className="premium-input w-full h-10"
                    >
                      <option value="">Select Category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Purchase Price</label>
                      <input
                        type="number"
                        value={editForm.purchasePrice || ''}
                        onChange={e => setEditForm({ ...editForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                        className="premium-input w-full h-10"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Generic Name</label>
                      <input
                        value={editForm.genericName || ''}
                        onChange={e => setEditForm({ ...editForm, genericName: e.target.value })}
                        className="premium-input w-full h-10"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 space-y-3">
                <button
                  onClick={handleSave}
                  className="w-full h-12 btn-primary flex items-center justify-center text-[14px] font-semibold"
                >
                  {isAddMode ? 'Add Medicine' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditForm({})}
                  className="w-full h-10 btn-secondary flex items-center justify-center"
                >
                  Clear Form
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Table / Content Area */}
        <div className="flex-1 flex flex-col px-[48px] pb-[48px] overflow-hidden">

          {/* Table Header with Search */}
          <div className="flex items-center gap-5 mb-6">
            <div className="relative w-[300px]">
              <input
                type="text"
                placeholder="Search medicine..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="premium-input w-full h-10 pl-3 pr-10"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 text-sm text-[#4B5563] hover:text-[#111827] font-semibold transition-colors">
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-2 text-sm text-[#4B5563] hover:text-[#111827] font-semibold transition-colors cursor-pointer select-none">
              <Download size={16} /> Export CSV
            </button>
          </div>

          {/* Data Table */}
          <div className="premium-card bg-white flex-1 flex flex-col overflow-hidden">
            <div className="bg-[#F9FAFB] px-6 py-3 border-b border-[#E2E8F0] flex">
              <div className="w-[30%] text-xs font-bold text-[#4A5568]">Medicine Name</div>
              <div className="w-[15%] text-xs font-bold text-[#4A5568]">Category</div>
              <div className="w-[15%] text-xs font-bold text-[#4A5568]">Batch / Supplier</div>
              <div className="w-[120px] text-xs font-bold text-[#4A5568]">Stock Qty</div>
              <div className="w-[140px] text-xs font-bold text-[#4A5568]">Purchase Price</div>
              <div className="w-[140px] text-xs font-bold text-[#4A5568]">Selling Price</div>
              <div className="w-[150px] text-xs font-bold text-[#4A5568]">Expiry</div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
              {medicines.map((med) => (
                <div key={med.id} className="flex items-center px-6 py-3 border-b border-[#F1F5F9] hover:bg-slate-50/50 transition-colors group">
                  <div className="w-[30%] pr-4">
                    <div className="text-[14px] font-semibold text-[#111827] truncate">{med.name}</div>
                    <div className="text-[11px] text-[#718096] truncate">{med.genericName || '—'}</div>
                  </div>
                  <div className="w-[15%] pr-4 text-[13px] text-[#111827]">
                    {med.categoryName || 'General'}
                  </div>
                  <div className="w-[15%] pr-4">
                    <div className="text-[13px] text-[#111827]">{med.batchNo || '—'}</div>
                    <div className="text-[11px] text-[#718096] truncate">{med.manufacturerName || '—'}</div>
                  </div>
                  <div className="w-[120px] pr-4 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${med.stockQty > 20 ? 'bg-[#00D2FF]' : med.stockQty > 0 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    <span className={`text-[13px] font-semibold ${med.stockQty > 20 ? 'text-[#00D2FF]' : med.stockQty > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                      {med.stockQty} Units
                    </span>
                  </div>
                  <div className="w-[140px] pr-4 text-[13px] font-semibold text-[#D97706]">
                    Rs. {med.purchasePrice?.toLocaleString() || '0'}
                  </div>
                  <div className="w-[140px] pr-4 text-[14px] font-semibold text-[#00D2FF]">
                    Rs. {med.sellingPrice?.toLocaleString() || '0'}
                  </div>
                  <div className="w-[150px] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {med.expiryDate && new Date(med.expiryDate) < new Date() && (
                        <span className="text-[#D97706] text-[13px]">⚠️</span>
                      )}
                      <span className={`text-[13px] ${!med.expiryDate ? 'text-slate-400' : new Date(med.expiryDate) < new Date() ? 'text-rose-500 font-bold' : 'text-[#111827]'}`}>
                        {med.expiryDate ? new Date(med.expiryDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'No Expiry'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditClick(med)} className="p-1.5 text-[#3B82F6] hover:bg-blue-50 rounded" title="Edit">
                        <Edit3 size={15} />
                      </button>
                      {user?.role === 'Admin' && (
                        <button onClick={() => handleDelete(med.id)} className="p-1.5 text-[#EF4444] hover:bg-rose-50 rounded" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {medicines.length === 0 && !isLoading && (
                <div className="p-16 text-center text-slate-400">
                  <p className="text-[12px] font-bold uppercase tracking-widest">No medicines found</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
