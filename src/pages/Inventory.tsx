import { useState, useEffect, useCallback, useRef } from 'react';
import type { Medicine, Category } from '../types/models';
import { Search, Edit3, Trash2, RefreshCw, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

// ── Expiry shorthand parser — mirrors WPF ItemsViewModel.FormatExpiryDate() ──
function parseExpiryShorthand(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  try {
    if (digits.length === 4) {
      // MMYY
      const month = parseInt(digits.substring(0, 2));
      const year = 2000 + parseInt(digits.substring(2, 2));
      const lastDay = new Date(year, month, 0).getDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (digits.length === 6) {
      // MMYYYY
      const month = parseInt(digits.substring(0, 2));
      const year = parseInt(digits.substring(2, 4));
      const fullYear = year < 100 ? 2000 + year : year;
      const lastDay = new Date(fullYear, month, 0).getDate();
      return `${fullYear}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (digits.length === 8) {
      // DDMMYYYY
      const day = parseInt(digits.substring(0, 2));
      const month = parseInt(digits.substring(2, 2));
      const year = parseInt(digits.substring(4, 4));
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  } catch { /* ignore */ }
  return null;
}

interface FormState {
  id?: number;
  name: string;
  genericName: string;
  barcode: string;
  categoryId: string;
  batchNo: string;
  expiryDate: string;
  sellingPrice: number | string;
  purchasePrice: number | string;
  stockQty: number | string;
  gstPercent: number | string;
  packetsPerBox: number | string;
  unitsPerPack: number | string;
  defaultEntryMode: 'Box' | 'Tablet';
  // Box mode fields
  packQuantity: number | string;
}

const BLANK_FORM: FormState = {
  name: '',
  genericName: '',
  barcode: '',
  categoryId: '',
  batchNo: '',
  expiryDate: '',
  sellingPrice: '',
  purchasePrice: '',
  stockQty: '',
  gstPercent: 0,
  packetsPerBox: 1,
  unitsPerPack: 10,
  defaultEntryMode: 'Tablet',
  packQuantity: '',
};

export default function Inventory() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [searchTerm]);

  // ── Barcode scanner integration — mirrors WPF BarcodeBox KeyDown Enter handler ──
  // When form is open: trigger medicine lookup (auto-populate form).
  // When form is closed: filter the list.
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (isFormExpanded) {
      // Populate barcode field and trigger lookup
      setForm(prev => ({ ...prev, barcode }));
      await executeLookupBarcode(barcode);
    } else {
      setSearchTerm(barcode);
    }
  }, [isFormExpanded]);

  useBarcodeScanner(handleBarcodeScan);

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

  // ── Barcode lookup — mirrors WPF ExecuteLookupBarcodeAsync() ──
  const executeLookupBarcode = async (barcode: string) => {
    const b = barcode.trim();
    if (!b) return;
    try {
      const res = await window.electronAPI.dbQuery('medicines:getByBarcode', { barcode: b });
      if (res.success && res.data) {
        const med = res.data as Medicine;
        // Found: populate form fields matching WPF SelectMedicine logic
        const totalUnits = (med.packetsPerBox || 1) * (med.unitsPerPack || 1);
        const isBox = med.defaultEntryMode === 'Box';
        setForm(prev => ({
          ...prev,
          id: med.id,
          name: med.name,
          genericName: med.genericName || '',
          barcode: b,
          batchNo: med.batchNo || '',
          expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '',
          sellingPrice: isBox ? (med.sellingPrice || 0) * totalUnits : (med.sellingPrice || 0),
          purchasePrice: med.purchasePrice || '',
          stockQty: med.stockQty || '',
          packetsPerBox: med.packetsPerBox || 1,
          unitsPerPack: med.unitsPerPack || 10,
          defaultEntryMode: isBox ? 'Box' : 'Tablet',
          packQuantity: '',
          categoryId: med.categoryId ? String(med.categoryId) : '',
          gstPercent: med.gstPercent || 0,
        }));
        setIsAddMode(false);
        setStatusMessage({ type: 'success', text: `✔ Found: ${med.name}` });
      } else {
        setStatusMessage({ type: 'info', text: `ℹ New Barcode: ${b}` });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: '✘ Barcode lookup failed.' });
    }
  };

  // ── Barcode field Enter key handler ──
  const handleBarcodeKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await executeLookupBarcode(form.barcode);
      document.getElementById('inventory-name-input')?.focus();
    }
  };

  // ── Expiry date shorthand on blur — mirrors WPF ExpiryDateBox_LostFocus ──
  const handleExpiryBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // If it's not already a valid date (yyyy-mm-dd), try shorthand parse
    if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parsed = parseExpiryShorthand(raw);
      if (parsed) {
        setForm(prev => ({ ...prev, expiryDate: parsed }));
      }
    }
  };

  // ── Recalculate total units when box-mode fields change ──
  const recalcBoxMode = (updated: FormState): FormState => {
    if (updated.defaultEntryMode === 'Box') {
      const boxes = Number(updated.packQuantity) || 0;
      const packsPerBox = Number(updated.packetsPerBox) || 1;
      const tabsPerPack = Number(updated.unitsPerPack) || 1;
      const totalUnits = boxes * packsPerBox * tabsPerPack;
      return { ...updated, stockQty: totalUnits };
    }
    return updated;
  };

  const setFormField = (field: keyof FormState, value: any) => {
    setForm(prev => recalcBoxMode({ ...prev, [field]: value }));
  };

  const handleAddClick = () => {
    setForm({ ...BLANK_FORM });
    setIsAddMode(true);
    setIsFormExpanded(true);
    setStatusMessage(null);
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  const handleEditClick = (med: Medicine) => {
    const isBox = med.defaultEntryMode === 'Box';
    const totalUnits = (med.packetsPerBox || 1) * (med.unitsPerPack || 1);
    setForm({
      id: med.id,
      name: med.name,
      genericName: med.genericName || '',
      barcode: med.barcode || '',
      categoryId: med.categoryId ? String(med.categoryId) : '',
      batchNo: med.batchNo || '',
      expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '',
      sellingPrice: isBox ? (med.sellingPrice || 0) * totalUnits : (med.sellingPrice || 0),
      purchasePrice: med.purchasePrice || '',
      stockQty: med.stockQty || '',
      gstPercent: med.gstPercent || 0,
      packetsPerBox: med.packetsPerBox || 1,
      unitsPerPack: med.unitsPerPack || 10,
      defaultEntryMode: isBox ? 'Box' : 'Tablet',
      packQuantity: '',
    });
    setIsAddMode(false);
    setIsFormExpanded(true);
    setStatusMessage({ type: 'info', text: `Editing: ${med.name}` });
  };

  // ── Save — mirrors WPF ExecuteSaveAsync(), sends packaging metadata ──
  const handleSave = async () => {
    if (!form.name.trim()) {
      setStatusMessage({ type: 'error', text: '⚠ Medicine name is required.' });
      return;
    }

    const isBox = form.defaultEntryMode === 'Box';
    const packetsPerBox = Number(form.packetsPerBox) || 1;
    const unitsPerPack = Number(form.unitsPerPack) || 1;
    const totalUnitsPerBox = packetsPerBox * unitsPerPack;

    // Convert selling price to per-unit storage (matching WPF logic)
    const rawSelling = Number(form.sellingPrice) || 0;
    const sellingPricePerUnit = isBox ? rawSelling / Math.max(1, totalUnitsPerBox) : rawSelling;

    const payload: any = {
      name: form.name.trim(),
      genericName: form.genericName.trim(),
      barcode: form.barcode.trim() || null,
      categoryId: form.categoryId ? parseInt(form.categoryId) : null,
      gstPercent: Number(form.gstPercent) || 0,
      sellingPrice: sellingPricePerUnit,
      purchasePrice: Number(form.purchasePrice) || 0,
      stockQty: Number(form.stockQty) || 0,
      packetsPerBox,
      unitsPerPack,
      defaultEntryMode: form.defaultEntryMode,
      batchNo: form.batchNo.trim() || undefined,
      expiryDate: form.expiryDate || undefined,
    };

    if (!isAddMode && form.id) {
      payload.id = form.id;
    }

    setIsLoading(true);
    try {
      const endpoint = isAddMode ? 'medicines:create' : 'medicines:update';
      const res = await window.electronAPI.dbQuery(endpoint, payload);
      if (res.success) {
        fetchData();
        setStatusMessage({ type: 'success', text: isAddMode ? `✔ Added: ${form.name}` : `✔ Saved: ${form.name}` });
        clearForm();
        // Restore focus to barcode input (matching WPF RequestFocus "Barcode")
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      } else {
        setStatusMessage({ type: 'error', text: `✘ Save failed: ${res.error}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `✘ Save failed: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const clearForm = () => {
    setForm({ ...BLANK_FORM });
    setStatusMessage(null);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure? This will permanently delete '${name}' and ALL its stock batches.\n\nThis cannot be undone.`)) return;
    const res = await window.electronAPI.dbQuery('medicines:delete', { id });
    if (res.success) {
      fetchData();
      setStatusMessage({ type: 'success', text: `✔ Deleted: ${name}` });
    } else {
      setStatusMessage({ type: 'error', text: `✘ Delete failed: ${res.error}` });
    }
  };

  const handleExportCSV = async () => {
    if (medicines.length === 0) {
      alert('No inventory data available to export.');
      return;
    }

    const headers = ['Name', 'Generic', 'Category', 'Manufacturer', 'Dosage', 'Strength', 'Stock', 'Selling Price', 'Purchase Price', 'Expiry'];
    const escapeCsv = (text: string | undefined | null) => {
      if (!text) return '';
      const cleaned = String(text);
      if (cleaned.includes(',') || cleaned.includes('"') || cleaned.includes('\n')) {
        return `"${cleaned.replace(/"/g, '""')}"`;
      }
      return cleaned;
    };

    const lines = [
      headers.join(','),
      ...medicines.map(m => [
        escapeCsv(m.name),
        escapeCsv(m.genericName),
        escapeCsv(m.categoryName || 'General'),
        escapeCsv(m.manufacturerName || '—'),
        escapeCsv(m.dosageForm),
        escapeCsv(m.strength),
        m.stockQty || 0,
        m.sellingPrice || 0,
        m.purchasePrice || 0,
        m.expiryDate ? new Date(m.expiryDate).toISOString().split('T')[0] : '—'
      ].join(','))
    ];

    const csvContent = lines.join('\n');
    const today = new Date().toISOString().split('T')[0];
    const res = await (window as any).electronAPI.exportCSV(`Inventory_Report_${today}.csv`, csvContent);
    if (res.success) {
      alert(`Success: Inventory report exported to:\n${res.filePath}`);
    } else if (res.message !== 'Export cancelled.') {
      alert(`Export Error: ${res.message}`);
    }
  };

  // ── Total units preview text (Box mode) — mirrors WPF TotalUnitsPreviewText ──
  const totalUnitsPreview = form.defaultEntryMode === 'Box'
    ? `(${form.packQuantity || 0} box × ${form.packetsPerBox} pack × ${form.unitsPerPack} tab = ${Number(form.stockQty) || 0} tabs)`
    : '';

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] animate-in fade-in duration-300">

      {/* Toggle bar */}
      <div className="pl-[48px] pt-4 pb-2">
        <button
          onClick={() => {
            if (!isFormExpanded) {
              handleAddClick();
            } else {
              setIsFormExpanded(!isFormExpanded);
            }
          }}
          className="p-2 text-[#718096] hover:bg-black/5 rounded-lg transition-colors"
          title="Toggle Form"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      {/* Status message strip — mirrors WPF StatusMessage bar */}
      {statusMessage && (
        <div className={`mx-[48px] mb-1 px-4 py-2.5 rounded-lg flex items-center gap-2.5 text-xs font-semibold border animate-fade-in ${
          statusMessage.type === 'success' ? 'bg-[#ECFDF5] border-[#D1FAE5] text-[#059669]' :
          statusMessage.type === 'error'   ? 'bg-[#FEE2E2] border-[#FEE2E2] text-[#DC2626]' :
                                             'bg-[#EFF6FF] border-[#DBEAFE] text-[#2563EB]'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {statusMessage.text}
          <button onClick={() => setStatusMessage(null)} className="ml-auto p-0.5 hover:bg-black/5 rounded cursor-pointer">✕</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">

        {/* ── Form Pane ── */}
        <div className={`transition-all duration-300 overflow-hidden flex flex-col ${isFormExpanded ? 'w-[450px] opacity-100' : 'w-0 opacity-0'}`}>
          <div className="w-[450px] pl-[48px] pb-[48px] h-full overflow-auto custom-scrollbar">
            <div className="premium-card p-8 bg-white mb-8 space-y-6">
              <h2 className="text-xl font-bold text-[#00D2FF]">
                {isAddMode ? 'Add New Medicine' : 'Edit Medicine Details'}
              </h2>

              {/* ── Medicine Details ── */}
              <div className="space-y-5">

                {/* Barcode — with Enter-to-lookup matching WPF OnBarcodeKeyDown */}
                <div>
                  <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Barcode Scan</label>
                  <input
                    ref={barcodeInputRef}
                    id="inventory-barcode-input"
                    placeholder="Scan or type barcode, press Enter to lookup..."
                    value={form.barcode}
                    onChange={e => setFormField('barcode', e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    className="premium-input w-full h-10"
                    autoComplete="off"
                  />
                </div>

                {/* Medicine Name */}
                <div>
                  <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Medicine Name *</label>
                  <input
                    id="inventory-name-input"
                    placeholder="Type medicine name..."
                    value={form.name}
                    onChange={e => setFormField('name', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && document.getElementById('inventory-batch-input')?.focus()}
                    className="premium-input w-full h-10"
                    autoComplete="off"
                  />
                </div>

                {/* Batch + Expiry */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Batch Number</label>
                    <input
                      id="inventory-batch-input"
                      placeholder="BN-1234..."
                      value={form.batchNo}
                      onChange={e => setFormField('batchNo', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && document.getElementById('inventory-expiry-input')?.focus()}
                      className="premium-input w-full h-10"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Expiry Date</label>
                    <input
                      id="inventory-expiry-input"
                      type="text"
                      placeholder="MMYY, MM/YYYY, or YYYY-MM-DD"
                      value={form.expiryDate}
                      onChange={e => setFormField('expiryDate', e.target.value)}
                      onBlur={handleExpiryBlur}
                      onKeyDown={e => e.key === 'Enter' && document.getElementById('inventory-qty-mode-box')?.focus()}
                      className="premium-input w-full h-10"
                    />
                  </div>
                </div>
              </div>

              {/* ── Quantity Mode — mirrors WPF SegmentedButton ── */}
              <div className="space-y-3">
                <label className="text-[13px] font-semibold text-[#718096]">Quantity Entry Mode</label>
                <div className="flex bg-[#EDF2F7] rounded-lg p-1 h-10 gap-1">
                  <button
                    id="inventory-qty-mode-box"
                    onClick={() => setFormField('defaultEntryMode', 'Box')}
                    className={`flex-1 rounded-md text-sm font-semibold transition-all ${form.defaultEntryMode === 'Box' ? 'bg-white shadow-sm text-[#1A202C]' : 'text-[#718096] hover:text-[#4A5568]'}`}
                  >Box</button>
                  <button
                    id="inventory-qty-mode-tablet"
                    onClick={() => setFormField('defaultEntryMode', 'Tablet')}
                    className={`flex-1 rounded-md text-sm font-semibold transition-all ${form.defaultEntryMode === 'Tablet' ? 'bg-white shadow-sm text-[#1A202C]' : 'text-[#718096] hover:text-[#4A5568]'}`}
                  >Tablet</button>
                </div>

                {form.defaultEntryMode === 'Box' ? (
                  <>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold text-[#718096] mb-1 block">No. of Boxes</label>
                        <input
                          id="inventory-pack-qty"
                          type="number"
                          min="0"
                          placeholder="e.g. 10"
                          value={form.packQuantity}
                          onChange={e => setFormField('packQuantity', e.target.value === '' ? '' : Number(e.target.value))}
                          onKeyDown={e => e.key === 'Enter' && document.getElementById('inventory-packs-per-box')?.focus()}
                          className="premium-input w-full h-10"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Packs / Box</label>
                        <input
                          id="inventory-packs-per-box"
                          type="number"
                          min="1"
                          placeholder="e.g. 20"
                          value={form.packetsPerBox}
                          onChange={e => setFormField('packetsPerBox', e.target.value === '' ? 1 : Number(e.target.value))}
                          onKeyDown={e => e.key === 'Enter' && document.getElementById('inventory-units-per-pack')?.focus()}
                          className="premium-input w-full h-10"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Tabs / Pack</label>
                        <input
                          id="inventory-units-per-pack"
                          type="number"
                          min="1"
                          placeholder="e.g. 10"
                          value={form.unitsPerPack}
                          onChange={e => setFormField('unitsPerPack', e.target.value === '' ? 1 : Number(e.target.value))}
                          onKeyDown={e => e.key === 'Enter' && document.getElementById('inventory-selling-price')?.focus()}
                          className="premium-input w-full h-10"
                        />
                      </div>
                    </div>
                    {/* Preview text — mirrors WPF TotalUnitsPreviewText */}
                    {totalUnitsPreview && (
                      <p className="text-[11px] font-semibold text-[#00D2FF] text-right">{totalUnitsPreview}</p>
                    )}
                  </>
                ) : (
                  <div>
                    <label className="text-[13px] font-semibold text-[#718096] mb-1 block">Quantity (Total Tablets)</label>
                    <input
                      id="inventory-tablet-qty"
                      type="number"
                      min="0"
                      value={form.stockQty}
                      onChange={e => setFormField('stockQty', e.target.value === '' ? '' : Number(e.target.value))}
                      onKeyDown={e => e.key === 'Enter' && document.getElementById('inventory-selling-price')?.focus()}
                      className="premium-input w-full h-10"
                    />
                  </div>
                )}
              </div>

              {/* ── Price Section ── */}
              <div className="space-y-3">
                <div>
                  <label className="text-[13px] font-semibold text-[#718096] mb-1 block">
                    Selling Price {form.defaultEntryMode === 'Box' ? '(per Box)' : '(per Tablet)'}
                  </label>
                  <input
                    id="inventory-selling-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.sellingPrice}
                    onChange={e => setFormField('sellingPrice', e.target.value === '' ? '' : Number(e.target.value))}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    className="premium-input w-full h-10"
                  />
                </div>
              </div>

              {/* ── Edit-mode extra fields — mirrors WPF IsEditMode extra panel ── */}
              {!isAddMode && (
                <div className="space-y-3 pt-3 border-t border-[#E2E8F0]">
                  <label className="text-[13px] font-semibold text-[#718096] block">Edit Details</label>
                  <div>
                    <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Category</label>
                    <select
                      value={form.categoryId}
                      onChange={e => setFormField('categoryId', e.target.value)}
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
                        min="0"
                        step="0.01"
                        value={form.purchasePrice}
                        onChange={e => setFormField('purchasePrice', e.target.value === '' ? '' : Number(e.target.value))}
                        className="premium-input w-full h-10"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Generic Name</label>
                      <input
                        value={form.genericName}
                        onChange={e => setFormField('genericName', e.target.value)}
                        className="premium-input w-full h-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#718096] mb-1 block">Stock Qty Override (Tablets)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.stockQty}
                      onChange={e => setFormField('stockQty', e.target.value === '' ? '' : Number(e.target.value))}
                      className="premium-input w-full h-10"
                    />
                  </div>
                </div>
              )}

              {/* ── Save / Clear buttons ── */}
              <div className="pt-2 space-y-3">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="w-full h-12 btn-primary flex items-center justify-center text-[14px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isAddMode ? 'Add Medicine' : 'Save Changes'}
                </button>
                <button
                  onClick={clearForm}
                  className="w-full h-10 btn-secondary flex items-center justify-center"
                >
                  Clear Form
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* ── Table / Content Area ── */}
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
                <div key={`${med.id}-${med.batchNo}`} className="flex items-center px-6 py-3 border-b border-[#F1F5F9] hover:bg-slate-50/50 transition-colors group">
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
                        <button onClick={() => handleDelete(med.id, med.name)} className="p-1.5 text-[#EF4444] hover:bg-rose-50 rounded" title="Delete">
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
