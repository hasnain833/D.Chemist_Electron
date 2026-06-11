import { useState, useEffect, useCallback } from 'react';
import type { Medicine, Category, Supplier } from '../types/models';
import {
  Search,
  Trash2,
  Save,
  Plus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import Modal from '../components/Modal';

export default function StockIn() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [selectedStock, setSelectedStock] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Supplier dropdown suggestion state
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Session Level Info (Header Card)
  const [session, setSession] = useState({
    supplierName: '',
    invoiceNo: '',
    invoiceDate: new Date().toLocaleDateString('en-GB') // DD/MM/YYYY
  });

  // Modal State for New Medicine Registration
  const [isNewMedModalOpen, setIsNewMedModalOpen] = useState(false);
  const [newMedForm, setNewMedForm] = useState({
    name: '',
    genericName: '',
    categoryId: '',
    dosageForm: 'Tablet',
    strength: '',
    barcode: '',
    gstPercent: 0,
    packetsPerBox: 1,
    unitsPerPack: 10
  });

  useEffect(() => {
    fetchInitialData();
    // Focus search box on page load matching C# Page Constructor
    document.getElementById('medicine-search-input')?.focus();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [catRes, supRes] = await Promise.all([
        (window as any).electronAPI.dbQuery('categories:getAll'),
        (window as any).electronAPI.dbQuery('suppliers:getAll')
      ]);
      if (catRes.success) setCategories(catRes.data);
      if (supRes.success) setSuppliers(supRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 1) {
      setSearchResults([]);
      return;
    }
    const res = await (window as any).electronAPI.dbQuery('medicines:search', { term });
    if (res.success) setSearchResults(res.data);
  };

  const selectMedicine = (med: Medicine) => {
    const pPerBox = med.packetsPerBox || 1;
    const uPerPack = med.unitsPerPack || 1;
    const totalUnitsPerBox = pPerBox * uPerPack;

    // Pre-fill unit cost estimation
    const prefillUnitCost = med.purchasePrice && med.purchasePrice > 0
      ? med.purchasePrice
      : (med.sellingPrice || 0) / totalUnitsPerBox;

    const newItem = {
      id: Date.now() + Math.random(),
      medicineId: med.id,
      medicineName: med.name,
      genericName: med.genericName || '',
      dosageForm: med.dosageForm || '',
      strength: med.strength || '',
      barcode: med.barcode || '',
      gstPercent: med.gstPercent || 0,

      batchNo: med.batchNo || 'Standard',
      expiryDate: med.expiryDate
        ? new Date(med.expiryDate).toISOString().split('T')[0]
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // default 1 year

      entryMode: med.defaultEntryMode || 'Tablet',
      packetsPerBox: pPerBox,
      unitsPerPack: uPerPack,

      packQuantityText: '',
      packQuantity: 0,

      packPriceText: '',
      packPrice: 0,

      quantityUnits: 0,
      purchaseTotalPrice: 0,
      unitCost: prefillUnitCost,
      sellingPricePerUnit: med.sellingPrice || 0
    };

    setSelectedStock(prev => [newItem, ...prev]);
    setSearchTerm('');
    setSearchResults([]);

    // Delay focus to let the row render, then focus BatchBox of index 0
    setTimeout(() => {
      const firstBatchInput = document.getElementById(`batch-${newItem.id}`) as HTMLInputElement;
      if (firstBatchInput) {
        firstBatchInput.focus();
        firstBatchInput.select();
      }
    }, 50);
  };

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    const res = await (window as any).electronAPI.dbQuery('medicines:getByBarcode', { barcode });
    if (res.success && res.data) {
      selectMedicine(res.data);
    } else {
      handleSearch(barcode);
    }
  }, [selectedStock]);

  useBarcodeScanner(handleBarcodeScan);

  const updateRowField = (id: number, field: string, value: string) => {
    setSelectedStock(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item };

      if (field === 'batchNo') {
        updated.batchNo = value;
      } else if (field === 'expiryDate') {
        updated.expiryDate = value;
      } else if (field === 'packQuantityText') {
        updated.packQuantityText = value;
        const parsedQty = parseInt(value);
        updated.packQuantity = isNaN(parsedQty) ? 0 : parsedQty;
      } else if (field === 'packPriceText') {
        updated.packPriceText = value;
        const parsedPrice = parseFloat(value);
        updated.packPrice = isNaN(parsedPrice) ? 0 : parsedPrice;
        updated.purchaseTotalPrice = updated.packPrice;
      }

      // Recalculate quantities & unit costs
      if (updated.entryMode === 'Box') {
        updated.quantityUnits = updated.packQuantity * (updated.packetsPerBox || 1) * (updated.unitsPerPack || 1);
      } else {
        updated.quantityUnits = updated.packQuantity;
      }

      updated.unitCost = updated.quantityUnits > 0 ? updated.purchaseTotalPrice / updated.quantityUnits : 0;

      return updated;
    }));
  };

  const toggleEntryMode = (id: number) => {
    setSelectedStock(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item };
      updated.entryMode = updated.entryMode === 'Box' ? 'Tablet' : 'Box';

      // Recalculate quantities & unit costs
      if (updated.entryMode === 'Box') {
        updated.quantityUnits = updated.packQuantity * (updated.packetsPerBox || 1) * (updated.unitsPerPack || 1);
      } else {
        updated.quantityUnits = updated.packQuantity;
      }

      updated.unitCost = updated.quantityUnits > 0 ? updated.purchaseTotalPrice / updated.quantityUnits : 0;

      return updated;
    }));
  };

  const removeRow = (id: number) => {
    setSelectedStock(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveAll = async () => {
    if (selectedStock.length === 0) return;

    // Pre-save validation matching C#
    const invalidItem = selectedStock.find(i => i.packQuantity <= 0 || i.packPrice <= 0 || !i.batchNo.trim());
    if (invalidItem) {
      setMessage({
        type: 'error',
        text: `Validation failed: '${invalidItem.medicineName}' has missing quantity, price, or batch number.`
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const supplierName = session.supplierName.trim() || 'Walk-in Vendor';

      // Parse Session invoice date (DD/MM/YYYY) to ISO (YYYY-MM-DD)
      let formattedDate = new Date().toISOString().split('T')[0];
      const parts = session.invoiceDate.split('/');
      if (parts.length === 3) {
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        formattedDate = `${year}-${month}-${day}`;
      }

      const items = selectedStock.map(item => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        entryMode: item.entryMode,
        packQuantity: item.packQuantity,
        purchaseTotalPrice: item.purchaseTotalPrice,
        sellingPricePerUnit: item.sellingPricePerUnit,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate
      }));

      const res = await (window as any).electronAPI.dbQuery('invoices:stockIn', {
        supplierName,
        invoiceNo: session.invoiceNo.trim() || `INV-${Date.now()}`,
        date: formattedDate,
        items
      });

      if (res.success) {
        setSelectedStock([]);
        setSession({
          supplierName: '',
          invoiceNo: '',
          invoiceDate: new Date().toLocaleDateString('en-GB')
        });
        setMessage({ type: 'success', text: 'Purchase saved and inventory updated successfully.' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to process stock.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to save stock.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Medicine Registration Modal Form Submission
  const handleRegisterMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedForm.name) {
      setMessage({ type: 'error', text: 'Medicine name is required.' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await (window as any).electronAPI.dbQuery('medicines:create', {
        name: newMedForm.name,
        genericName: newMedForm.genericName,
        categoryId: parseInt(newMedForm.categoryId) || null,
        manufacturerId: null,
        dosageForm: newMedForm.dosageForm,
        strength: newMedForm.strength,
        barcode: newMedForm.barcode,
        gstPercent: Number(newMedForm.gstPercent)
      });

      if (res.success && res.data) {
        const medId = res.data.id;
        const newMed: Medicine = {
          id: medId,
          name: newMedForm.name,
          genericName: newMedForm.genericName,
          categoryId: parseInt(newMedForm.categoryId) || undefined,
          dosageForm: newMedForm.dosageForm,
          strength: newMedForm.strength,
          barcode: newMedForm.barcode,
          gstPercent: Number(newMedForm.gstPercent),
          unitsPerPack: Number(newMedForm.unitsPerPack),
          packetsPerBox: Number(newMedForm.packetsPerBox),
          defaultEntryMode: 'Tablet',
          stockQty: 0,
          sellingPrice: 0,
          createdAt: new Date()
        };

        selectMedicine(newMed);
        setIsNewMedModalOpen(false);
        setNewMedForm({
          name: '',
          genericName: '',
          categoryId: '',
          dosageForm: 'Tablet',
          strength: '',
          barcode: '',
          gstPercent: 0,
          packetsPerBox: 1,
          unitsPerPack: 10
        });
        setMessage({ type: 'success', text: 'Medicine registered and added to list.' });
      } else {
        setMessage({ type: 'error', text: 'Could not register medicine: ' + (res.error || '') });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error registering medicine: ' + err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard Navigation Helpers matching C# Code Behind
  const handleSupplierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('invoice-no-box')?.focus();
    }
  };

  const handleInvoiceNoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('invoice-date-box')?.focus();
    }
  };

  const handleInvoiceDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('medicine-search-input')?.focus();
    }
  };

  const handleBatchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const qtyInput = document.getElementById(`qty-${id}`) as HTMLInputElement;
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const priceInput = document.getElementById(`price-${id}`) as HTMLInputElement;
      if (priceInput) {
        priceInput.focus();
        priceInput.select();
      }
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const searchInput = document.getElementById('medicine-search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  };

  const grandTotal = selectedStock.reduce((acc, s) => acc + s.purchaseTotalPrice, 0);

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] px-[40px] pt-[24px] pb-[32px] overflow-hidden animate-fade-in">

      {/* Alert / Message Banner */}
      {message && (
        <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 border animate-fade-in ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto hover:bg-black/5 p-1 rounded-lg">
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {/* 1. Invoice Header Card */}
      <div className="premium-card p-4 bg-white mb-3 shadow-sm border border-[#E2E8F0] rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">

          <div className="col-span-2 relative">
            <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Supplier</label>
            <input
              id="supplier-name-box"
              type="text"
              placeholder="Type or select supplier..."
              className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
              value={session.supplierName}
              onChange={(e) => {
                setSession(prev => ({ ...prev, supplierName: e.target.value }));
                setShowSupplierDropdown(true);
              }}
              onFocus={() => setShowSupplierDropdown(true)}
              onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
              onKeyDown={handleSupplierKeyDown}
            />
            {showSupplierDropdown && suppliers.length > 0 && (
              <div className="absolute top-[68px] left-0 right-0 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                {suppliers
                  .filter(s => s.name.toLowerCase().includes(session.supplierName.toLowerCase()))
                  .map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => {
                        setSession(prev => ({ ...prev, supplierName: s.name }));
                        setShowSupplierDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-none"
                    >
                      {s.name}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Invoice #</label>
            <input
              id="invoice-no-box"
              type="text"
              placeholder="INV-000"
              className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
              value={session.invoiceNo}
              onChange={(e) => setSession(prev => ({ ...prev, invoiceNo: e.target.value }))}
              onKeyDown={handleInvoiceNoKeyDown}
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Date</label>
            <input
              id="invoice-date-box"
              type="text"
              placeholder="DD/MM/YYYY"
              className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
              value={session.invoiceDate}
              onChange={(e) => setSession(prev => ({ ...prev, invoiceDate: e.target.value }))}
              onKeyDown={handleInvoiceDateKeyDown}
            />
          </div>

        </div>
      </div>

      {/* 2. Search Box & Register New Product */}
      <div className="premium-card p-4 bg-white border-[1.5px] border-[#00D2FF] mb-3 rounded-xl shadow-sm flex items-center gap-4">
        <div className="relative flex-1 group">
          <input
            id="medicine-search-input"
            type="text"
            placeholder="Search medicine to add to list (press Enter to select)..."
            className="w-full text-base font-medium outline-none h-10 pr-10 text-[#111827] placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (searchResults.length > 0) {
                  selectMedicine(searchResults[0]);
                }
              }
            }}
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />

          {searchResults.length > 0 && (
            <div className="absolute top-[48px] left-0 right-0 bg-white border border-[#E2E8F0] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
              {searchResults.map(med => (
                <button
                  key={med.id}
                  type="button"
                  onClick={() => selectMedicine(med)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-none flex justify-between items-center"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-[#111827] text-sm">{med.name}</span>
                    <span className="text-[11px] text-[#718096]">
                      {med.manufacturerName || 'No Manufacturer'} • {med.strength || 'No Strength'}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#718096]">
                    Stock: {med.stockQty} Units
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setIsNewMedModalOpen(true)}
          className="h-10 px-4 bg-[#00D2FF] hover:bg-[#00bfff] text-white font-bold rounded-lg text-sm flex items-center gap-2 shadow-sm transition-colors shrink-0"
        >
          <Plus size={16} /> Register Product
        </button>
      </div>

      {/* 3. Invoice Table */}
      <div className="premium-card bg-white flex-1 flex flex-col overflow-hidden mb-4 border border-[#E2E8F0] rounded-xl shadow-sm">

        {/* Table Headers */}
        <div className="grid grid-cols-[1fr_130px_160px_160px_130px_48px] items-center bg-[#F8FAFC] px-6 py-3 border-b border-[#E2E8F0] gap-4 shrink-0">
          <div className="text-[11px] font-bold text-[#718096]">MEDICINE NAME</div>
          <div className="text-[11px] font-bold text-[#718096] text-center">BATCH & EXPIRY</div>
          <div className="text-[11px] font-bold text-[#718096] text-center">QTY</div>
          <div className="text-[11px] font-bold text-[#718096] text-center">TOTAL PRICE</div>
          <div className="text-[11px] font-bold text-[#718096] text-right">COST / UNIT</div>
          <div className="w-[48px]"></div>
        </div>

        {/* Rows (ListView) */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {selectedStock.map((item) => {
            const pPerBox = item.packetsPerBox || 1;
            const uPerPack = item.unitsPerPack || 1;
            const pkgDimension = pPerBox > 1
              ? `${pPerBox} packs/box × ${uPerPack} tabs/pack = ${pPerBox * uPerPack} tabs/box`
              : `${uPerPack} tabs/pack`;

            return (
              <div key={item.id} className="grid grid-cols-[1fr_130px_160px_160px_130px_48px] items-center px-6 py-3 border-b border-[#F1F5F9] hover:bg-slate-50/50 gap-4 transition-colors">

                {/* Medicine Details */}
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="font-semibold text-sm text-[#2D3748] truncate">{item.medicineName}</span>
                  <span className="text-[10px] text-[#718096] truncate">{pkgDimension}</span>
                </div>

                {/* Batch No & Expiry */}
                <div className="flex flex-col gap-1 px-1">
                  <input
                    id={`batch-${item.id}`}
                    type="text"
                    placeholder="Batch No"
                    className="premium-input w-full h-8 text-center text-xs border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] px-1"
                    value={item.batchNo}
                    onChange={(e) => updateRowField(item.id, 'batchNo', e.target.value)}
                    onKeyDown={(e) => handleBatchKeyDown(e, item.id)}
                  />
                  <input
                    type="date"
                    className="premium-input w-full h-6 text-center text-[10px] text-[#4B5563] border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] px-1 cursor-pointer"
                    value={item.expiryDate}
                    onChange={(e) => updateRowField(item.id, 'expiryDate', e.target.value)}
                  />
                </div>

                {/* Quantity input & label */}
                <div className="flex flex-col items-center">
                  <input
                    id={`qty-${item.id}`}
                    type="text"
                    placeholder="0"
                    className="premium-input w-full h-8 text-center text-xs border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF]"
                    value={item.packQuantityText}
                    onChange={(e) => updateRowField(item.id, 'packQuantityText', e.target.value)}
                    onKeyDown={(e) => handleQtyKeyDown(e, item.id)}
                  />
                  <button
                    type="button"
                    onClick={() => toggleEntryMode(item.id)}
                    className="text-[9px] text-[#94A3B8] hover:text-[#00D2FF] font-semibold uppercase mt-1 transition-colors cursor-pointer hover:underline select-none"
                    title="Click to toggle Box / Tablet mode"
                  >
                    {item.entryMode === 'Box' ? 'QTY (BOX)' : 'QTY (TABS)'}
                  </button>
                </div>

                {/* Total Price input */}
                <div className="px-1.5">
                  <input
                    id={`price-${item.id}`}
                    type="text"
                    placeholder="Total paid"
                    className="premium-input w-full h-8 text-right text-xs border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] px-2"
                    value={item.packPriceText}
                    onChange={(e) => updateRowField(item.id, 'packPriceText', e.target.value)}
                    onKeyDown={handlePriceKeyDown}
                  />
                </div>

                {/* Unit Cost display */}
                <div className="text-right font-bold text-sm text-[#00D2FF] pr-2 select-all">
                  Rs. {item.unitCost.toFixed(2)}
                </div>

                {/* Remove item button */}
                <div className="flex justify-center">
                  <button
                    onClick={() => removeRow(item.id)}
                    className="p-2 text-slate-300 hover:text-[#EF4444] hover:bg-rose-50 rounded transition-colors"
                    title="Remove from list"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

              </div>
            );
          })}

          {selectedStock.length === 0 && (
            <div className="py-24 text-center text-slate-300 flex flex-col items-center select-none">
              <Search size={48} className="opacity-15 mb-3" />
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Search for medicines above to compile purchase</p>
            </div>
          )}
        </div>

      </div>

      {/* 4. Summary & Save Card */}
      <div className="premium-card px-7 py-5 bg-white border border-[#E2E8F0] rounded-xl shadow-sm flex items-center justify-between shrink-0">
        <div className="flex gap-12">
          <div>
            <span className="text-[12px] text-[#718096] block mb-1 font-semibold uppercase">Total Items</span>
            <span className="text-3xl font-bold text-[#2D3748]">{selectedStock.length}</span>
          </div>
          <div>
            <span className="text-[12px] text-[#718096] block mb-1 font-semibold uppercase">Grand Total Cost</span>
            <span className="text-3xl font-bold text-[#00D2FF]">Rs. {grandTotal.toLocaleString()}</span>
          </div>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={isLoading || selectedStock.length === 0}
          className="h-14 w-[240px] btn-primary rounded-xl font-bold text-base flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5" />
          ) : (
            <>
              <Save size={18} />
              Complete Purchase
            </>
          )}
        </button>
      </div>

      {/* Register New Medicine Modal */}
      <Modal
        isOpen={isNewMedModalOpen}
        onClose={() => setIsNewMedModalOpen(false)}
        title="Register New Medicine"
      >
        <form onSubmit={handleRegisterMedicine} className="space-y-4">

          <div>
            <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Medicine Name *</label>
            <input
              type="text"
              placeholder="e.g. Panadol CF"
              className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
              value={newMedForm.name}
              onChange={(e) => setNewMedForm(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Generic Name</label>
            <input
              type="text"
              placeholder="e.g. Paracetamol"
              className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
              value={newMedForm.genericName}
              onChange={(e) => setNewMedForm(prev => ({ ...prev, genericName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Category</label>
              <select
                className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-2"
                value={newMedForm.categoryId}
                onChange={(e) => setNewMedForm(prev => ({ ...prev, categoryId: e.target.value }))}
              >
                <option value="">Select Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Strength</label>
              <input
                type="text"
                placeholder="e.g. 500mg"
                className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
                value={newMedForm.strength}
                onChange={(e) => setNewMedForm(prev => ({ ...prev, strength: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Dosage Form</label>
              <input
                type="text"
                placeholder="e.g. Tablet"
                className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
                value={newMedForm.dosageForm}
                onChange={(e) => setNewMedForm(prev => ({ ...prev, dosageForm: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Barcode / EAN</label>
              <input
                type="text"
                placeholder="Barcode"
                className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
                value={newMedForm.barcode}
                onChange={(e) => setNewMedForm(prev => ({ ...prev, barcode: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-[#718096] mb-1 block">GST Percent (%)</label>
              <input
                type="number"
                placeholder="0"
                className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
                value={newMedForm.gstPercent}
                onChange={(e) => setNewMedForm(prev => ({ ...prev, gstPercent: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Packs / Box</label>
              <input
                type="number"
                placeholder="1"
                className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
                value={newMedForm.packetsPerBox}
                onChange={(e) => setNewMedForm(prev => ({ ...prev, packetsPerBox: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#718096] mb-1 block">Units / Pack</label>
              <input
                type="number"
                placeholder="10"
                className="premium-input w-full h-10 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-sm px-3"
                value={newMedForm.unitsPerPack}
                onChange={(e) => setNewMedForm(prev => ({ ...prev, unitsPerPack: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 btn-primary h-12 text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              Confirm & Add
            </button>
            <button
              type="button"
              onClick={() => setIsNewMedModalOpen(false)}
              className="px-6 btn-secondary h-12 text-sm cursor-pointer"
            >
              Cancel
            </button>
          </div>

        </form>
      </Modal>

    </div>
  );
}
