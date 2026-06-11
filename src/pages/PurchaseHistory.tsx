import React, { useState, useEffect } from 'react';
import type { PurchaseInvoice, InvoiceBatchItem, EditableInvoiceItem } from '../types/purchaseInvoice';
import {
  Search,
  Edit,
  Save,
  X,
  RefreshCw,
  FileText,
  Trash
} from 'lucide-react';

export default function PurchaseHistory() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceBatchItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableInvoiceItem[]>([]);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setStatusMessage('Loading invoices...');
    try {
      let mergedInvoices: PurchaseInvoice[] = [];
      const queryDate = searchDate || null;

      if (searchText.trim()) {
        // C# replica search: query both invoice no and supplier name, then union
        const [resInvoice, resSupplier] = await Promise.all([
          window.electronAPI.dbQuery('invoices:search', {
            invoiceNo: searchText.trim(),
            supplierName: null,
            date: queryDate
          }),
          window.electronAPI.dbQuery('invoices:search', {
            invoiceNo: null,
            supplierName: searchText.trim(),
            date: queryDate
          })
        ]);

        const invoicesA = resInvoice.success ? resInvoice.data : [];
        const invoicesB = resSupplier.success ? resSupplier.data : [];

        // Deduplicate merged results by ID
        const map = new Map<number, PurchaseInvoice>();
        invoicesA.forEach((inv: PurchaseInvoice) => map.set(inv.id, inv));
        invoicesB.forEach((inv: PurchaseInvoice) => map.set(inv.id, inv));

        mergedInvoices = Array.from(map.values());
      } else {
        // Simple filter by date or fetch all
        const res = await window.electronAPI.dbQuery('invoices:search', {
          invoiceNo: null,
          supplierName: null,
          date: queryDate
        });
        if (res.success) {
          mergedInvoices = res.data;
        }
      }

      // Sort descending by date
      mergedInvoices.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());

      setInvoices(mergedInvoices);
      setIsSearchActive(!!searchText.trim() || !!searchDate);

      if (mergedInvoices.length === 0) {
        setStatusMessage('No purchase invoices found.');
      } else {
        setStatusMessage(`Found ${mergedInvoices.length} invoices.`);
      }
    } catch (error) {
      console.error(error);
      setStatusMessage('Error loading invoices.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  const handleClearSearch = () => {
    setSearchText('');
    setSearchDate('');
    setIsSearchActive(false);
    // Directly trigger fetchInvoices with empty filters
    setLoading(true);
    setStatusMessage('Loading invoices...');
    window.electronAPI.dbQuery('invoices:search', {
      invoiceNo: null,
      supplierName: null,
      date: null
    }).then(res => {
      if (res.success) {
        const data = res.data;
        data.sort((a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
        setInvoices(data);
        setStatusMessage(`Found ${data.length} invoices.`);
      }
    }).finally(() => setLoading(false));
  };

  const handleViewInvoiceDetails = async (inv: PurchaseInvoice) => {
    setSelectedInvoice(inv);
    if (isEditMode) {
      setIsEditMode(false);
      setEditableItems([]);
    }
    setLoadingItems(true);
    try {
      const res = await window.electronAPI.dbQuery('invoices:getItems', { invoiceId: inv.id });
      if (res.success) {
        setInvoiceItems(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleEditClick = () => {
    if (!selectedInvoice || invoiceItems.length === 0) return;

    const editables = invoiceItems.map(b => {
      const packQty = b.pack_quantity > 0
        ? b.pack_quantity
        : (b.entry_mode === 'Box' && b.packets_per_box > 0 && b.units_per_pack > 0
          ? Math.floor(b.quantity_units / (b.packets_per_box * b.units_per_pack))
          : b.quantity_units);

      return {
        batchId: b.id,
        medicineId: b.medicine_id,
        medicineName: b.medicine_name,
        entryMode: b.entry_mode,
        packetsPerBox: b.packets_per_box || 1,
        unitsPerPack: b.units_per_pack || 1,

        originalBatchNo: b.batch_no,
        originalQuantityUnits: b.quantity_units,
        originalRemainingUnits: b.remaining_units,
        originalTotalCost: parseFloat(b.purchase_total_price.toString()),
        originalPackQuantity: packQty,

        editBatchNo: b.batch_no,
        editQuantityText: packQty.toString(),
        editTotalCostText: parseFloat(b.purchase_total_price.toString()).toFixed(2),

        editPackQuantity: packQty,
        editTotalUnits: b.quantity_units,
        editTotalCost: parseFloat(b.purchase_total_price.toString()),
        editUnitCost: parseFloat(b.unit_cost.toString())
      } as EditableInvoiceItem;
    });

    setEditableItems(editables);
    setIsEditMode(true);
  };

  const handleEditableFieldChange = (batchId: number, field: string, value: string) => {
    setEditableItems(prev => prev.map(item => {
      if (item.batchId !== batchId) return item;

      const updated = { ...item };

      if (field === 'editBatchNo') {
        updated.editBatchNo = value;
      } else if (field === 'editQuantityText') {
        updated.editQuantityText = value;
        const parsed = parseInt(value);
        updated.editPackQuantity = isNaN(parsed) ? 0 : parsed;
        updated.editTotalUnits = updated.entryMode === 'Box'
          ? updated.editPackQuantity * (updated.packetsPerBox || 1) * (updated.unitsPerPack || 1)
          : updated.editPackQuantity;
      } else if (field === 'editTotalCostText') {
        updated.editTotalCostText = value;
        const parsed = parseFloat(value);
        updated.editTotalCost = isNaN(parsed) ? 0 : parsed;
      }

      updated.editUnitCost = updated.editTotalUnits > 0 ? updated.editTotalCost / updated.editTotalUnits : 0;

      return updated;
    }));
  };

  const handleSaveEditSubmit = async () => {
    if (!selectedInvoice || editableItems.length === 0) return;

    // Validate
    const invalid = editableItems.find(i => !i.editBatchNo.trim() || i.editPackQuantity <= 0 || i.editTotalCost <= 0);
    if (invalid) {
      alert(`Validation error: '${invalid.medicineName}' has missing batch, quantity, or cost.`);
      return;
    }

    setLoadingItems(true);
    try {
      const res = await window.electronAPI.dbQuery('invoices:update', {
        invoiceId: selectedInvoice.id,
        items: editableItems
      });

      if (res.success) {
        setIsEditMode(false);
        fetchInvoices();

        // Reload details
        const detailsRes = await window.electronAPI.dbQuery('invoices:getItems', { invoiceId: selectedInvoice.id });
        if (detailsRes.success) {
          setInvoiceItems(detailsRes.data);
        }

        // Update total local display amount
        const newTotal = editableItems.reduce((acc, item) => acc + item.editTotalCost, 0);
        setSelectedInvoice(prev => prev ? { ...prev, total_amount: newTotal } : null);
        setStatusMessage('Invoice updated successfully.');
      } else {
        alert('Update failed: ' + res.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditableItems([]);
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return;

    if (!window.confirm(`Are you sure you want to delete invoice "${selectedInvoice.invoice_no}"?\n\nThis will only remove the invoice record. The medicine stock/items will NOT be affected.`)) {
      return;
    }

    setLoadingItems(true);
    try {
      const res = await window.electronAPI.dbQuery('invoices:delete', { invoiceId: selectedInvoice.id });
      if (res.success) {
        const deletedNo = selectedInvoice.invoice_no;
        setSelectedInvoice(null);
        setInvoiceItems([]);
        fetchInvoices();
        setStatusMessage(`Invoice "${deletedNo}" deleted.`);
      } else {
        alert('Error: ' + res.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleCleanupInvoices = async () => {
    if (!window.confirm('Delete all invoices that have 0 remaining stock?')) return;
    try {
      const res = await window.electronAPI.dbQuery('invoices:cleanup', {});
      if (res.success) {
        alert(`Cleaned up ${res.data} fully sold invoices.`);
        fetchInvoices();
        if (selectedInvoice) {
          setSelectedInvoice(null);
          setInvoiceItems([]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper formatting for quantities matching C#
  const getFormattedQuantity = (item: InvoiceBatchItem) => {
    if (item.entry_mode === 'Box' && item.packets_per_box > 0 && item.units_per_pack > 0) {
      const unitsPerBox = item.packets_per_box * item.units_per_pack;
      const boxes = Math.floor(item.quantity_units / unitsPerBox);
      const loose = item.quantity_units % unitsPerBox;
      if (loose === 0) return `${boxes} Box`;
      return `${boxes} Box + ${loose} Tab`;
    }
    return `${item.quantity_units} Units`;
  };

  const editedTotal = editableItems.reduce((acc, item) => acc + item.editTotalCost, 0);

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] overflow-hidden animate-fade-in">

      {/* Header with LinearGradientBrush replication */}
      <div className="bg-linear-to-r from-[#00D2FF] to-[#3a7bd5] px-[40px] py-[24px] flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-5">
          <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <FileText className="text-[#3a7bd5]" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-white tracking-tight">Invoices</h1>
            <span className="text-xs text-slate-100 font-medium opacity-90">{statusMessage}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCleanupInvoices}
            className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold rounded-lg text-sm transition-colors cursor-pointer select-none"
            title="Clean up database by unlinking/removing invoices with 0 remaining stock"
          >
            Cleanup Sold Invoices
          </button>
          <button
            onClick={fetchInvoices}
            className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold rounded-lg text-sm flex items-center gap-2 transition-colors cursor-pointer select-none"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh List
          </button>
        </div>
      </div>

      {/* Main Body Area */}
      <div className="flex-1 flex px-[40px] py-[24px] gap-6 overflow-hidden min-h-0">

        {/* Left Side Card: Invoices List */}
        <div className="w-[400px] bg-white border border-[#E2E8F0] rounded-xl flex flex-col overflow-hidden shadow-sm shrink-0">
          <div className="bg-[#F7FAFC] px-4 py-3 border-b border-[#E2E8F0] shrink-0 select-none">
            <h2 className="text-sm font-bold text-[#4A5568] uppercase tracking-wider">Invoices</h2>
          </div>

          {/* Search Box & Date Filter Card Grid */}
          <div className="bg-[#FAFBFC] p-3 border-b border-[#E2E8F0] shrink-0">
            <form onSubmit={handleSearchSubmit} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search by invoice # or supplier..."
                  className="flex-1 h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <button
                  type="submit"
                  className="h-9 w-9 bg-[#00D2FF] hover:bg-[#00bfff] text-white flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                >
                  <Search size={14} />
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 h-9 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs cursor-pointer"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                />
                {isSearchActive && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="h-9 px-3 bg-[#EDF2F7] hover:bg-[#E2E8F0] text-[#718096] font-semibold text-xs flex items-center justify-center rounded-lg transition-colors cursor-pointer select-none"
                    title="Clear filter & show all"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Invoice ListView Items */}
          <div className="flex-1 overflow-auto custom-scrollbar bg-white divide-y divide-[#F1F5F9]">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm select-none">
                <RefreshCw className="animate-spin mr-2" size={16} /> Loading invoices...
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm select-none">
                No invoices found.
              </div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => handleViewInvoiceDetails(inv)}
                  className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${selectedInvoice?.id === inv.id ? 'bg-[#00D2FF]/5 border-l-4 border-[#00D2FF] pl-3' : 'hover:bg-slate-50/50'
                    }`}
                >
                  <div className="flex flex-col min-w-0 pr-3">
                    <span className="font-bold text-[#111827] text-sm truncate">{inv.invoice_no}</span>
                    <span className="text-xs text-[#718096] truncate">{inv.supplier_name || 'Walk-in Vendor'}</span>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="font-semibold text-sm text-[#00D2FF]">
                      Rs. {parseFloat(inv.total_amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-[#A0AEC0] mt-0.5">
                      {new Date(inv.invoice_date).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Detail Panel */}
        <div className="flex-1 bg-white border border-[#E2E8F0] rounded-xl flex flex-col overflow-hidden shadow-sm">

          {/* Details Pane Header */}
          <div className="bg-[#F7FAFC] px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 select-none">
              <h2 className="text-sm font-bold text-[#111827] uppercase tracking-wider">Invoice Items</h2>
              {loadingItems && <RefreshCw className="animate-spin text-slate-400" size={14} />}
            </div>

            {selectedInvoice && !loadingItems && (
              <div className="flex gap-2">
                {!isEditMode ? (
                  <>
                    <button
                      onClick={handleEditClick}
                      className="h-9 px-4 bg-[#DBEAFE] hover:bg-blue-200 text-[#2563EB] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                    >
                      <Edit size={14} /> Edit Invoice
                    </button>
                    <button
                      onClick={handleDeleteInvoice}
                      className="h-9 px-4 bg-[#FEE2E2] hover:bg-red-200 text-[#DC2626] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                    >
                      <Trash size={14} /> Delete Invoice
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSaveEditSubmit}
                      className="h-9 px-4 bg-[#D1FAE5] hover:bg-emerald-200 text-[#059669] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                    >
                      <Save size={14} /> Save Changes
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="h-9 px-4 bg-[#F1F5F9] hover:bg-slate-200 text-[#64748B] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                    >
                      <X size={14} /> Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Details Items List Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedInvoice ? (
              <div className="grow flex flex-col items-center justify-center py-24 text-slate-300 select-none">
                <FileText size={64} className="opacity-15 mb-3" />
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Select an invoice to view its items</p>
              </div>
            ) : loadingItems ? (
              <div className="grow flex items-center justify-center py-24 text-slate-400 text-sm select-none">
                <RefreshCw className="animate-spin mr-2" size={16} /> Loading items...
              </div>
            ) : !isEditMode ? (

              /* ===== READ ONLY VIEW ===== */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Headers */}
                <div className="grid grid-cols-[1fr_120px_140px_140px] bg-[#F9FAFB] px-6 py-3 border-b border-[#E2E8F0] gap-4 shrink-0 select-none">
                  <div className="text-[11px] font-bold text-[#718096]">MEDICINE</div>
                  <div className="text-[11px] font-bold text-[#718096] text-center">BATCH</div>
                  <div className="text-[11px] font-bold text-[#718096] text-right">QTY</div>
                  <div className="text-[11px] font-bold text-[#718096] text-right">TOTAL COST</div>
                </div>

                {/* Rows */}
                <div className="flex-1 overflow-auto custom-scrollbar divide-y divide-[#F1F5F9]">
                  {invoiceItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_120px_140px_140px] px-6 py-3.5 items-center gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-semibold text-sm text-[#111827] truncate">{item.medicine_name}</span>
                      </div>
                      <span className="text-xs text-[#718096] text-center">{item.batch_no}</span>
                      <span className="text-sm text-[#111827] text-right">{getFormattedQuantity(item)}</span>
                      <span className="font-bold text-sm text-[#111827] text-right">
                        Rs. {parseFloat(item.purchase_total_price.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  {invoiceItems.length === 0 && (
                    <div className="py-12 text-center text-slate-400 text-sm">No items found for this invoice.</div>
                  )}
                </div>

                {/* Read Only Summary Card */}
                <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-6 py-4 flex justify-between items-center shrink-0 select-none">
                  <span className="text-sm font-medium text-[#718096]">Grand Total</span>
                  <span className="text-xl font-bold text-[#00D2FF]">
                    Rs. {parseFloat((selectedInvoice.total_amount || 0).toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

            ) : (

              /* ===== EDITING INLINE VIEW ===== */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Headers */}
                <div className="grid grid-cols-[1fr_120px_120px_120px_100px] bg-[#FFFBEB] px-6 py-3 border-b border-[#FDE68A] gap-4 shrink-0 select-none">
                  <div className="text-[11px] font-bold text-[#92400E]">MEDICINE</div>
                  <div className="text-[11px] font-bold text-[#92400E] text-center">BATCH</div>
                  <div className="text-[11px] font-bold text-[#92400E] text-center">QTY</div>
                  <div className="text-[11px] font-bold text-[#92400E] text-center">TOTAL COST</div>
                  <div className="text-[11px] font-bold text-[#92400E] text-right">COST/UNIT</div>
                </div>

                {/* Rows */}
                <div className="flex-1 overflow-auto custom-scrollbar divide-y divide-[#FEF3C7] bg-[#FFFDF5]">
                  {editableItems.map((item) => (
                    <div key={item.batchId} className="grid grid-cols-[1fr_120px_120px_120px_100px] px-6 py-2.5 items-center gap-4 hover:bg-amber-50/30 transition-colors">

                      <div className="flex flex-col min-w-0 pr-1 select-none">
                        <span className="font-semibold text-sm text-[#111827] truncate">{item.medicineName}</span>
                        <span className="text-[9px] text-[#A66E2E] mt-0.5 uppercase tracking-wider">{item.entryMode === 'Box' ? 'Box Mode' : 'Tablet Mode'}</span>
                      </div>

                      <div className="px-0.5">
                        <input
                          type="text"
                          className="premium-input w-full h-8 text-center text-xs border border-[#FDE68A] rounded bg-[#FFFDF5] focus:outline-none focus:border-[#D97706]"
                          value={item.editBatchNo}
                          onChange={(e) => handleEditableFieldChange(item.batchId, 'editBatchNo', e.target.value)}
                        />
                      </div>

                      <div className="px-0.5">
                        <input
                          type="text"
                          placeholder="0"
                          className="premium-input w-full h-8 text-center text-xs border border-[#FDE68A] rounded bg-[#FFFDF5] focus:outline-none focus:border-[#D97706]"
                          value={item.editQuantityText}
                          onChange={(e) => handleEditableFieldChange(item.batchId, 'editQuantityText', e.target.value)}
                        />
                      </div>

                      <div className="px-0.5">
                        <input
                          type="text"
                          placeholder="0.00"
                          className="premium-input w-full h-8 text-right text-xs border border-[#FDE68A] rounded bg-[#FFFDF5] focus:outline-none focus:border-[#D97706]"
                          value={item.editTotalCostText}
                          onChange={(e) => handleEditableFieldChange(item.batchId, 'editTotalCostText', e.target.value)}
                        />
                      </div>

                      <div className="text-right font-bold text-xs text-[#00D2FF] pr-1">
                        Rs. {item.editUnitCost.toFixed(2)}
                      </div>

                    </div>
                  ))}
                </div>

                {/* Edit Summary Card */}
                <div className="bg-[#FFFBEB] border-t border-[#FDE68A] px-6 py-4 flex justify-between items-center shrink-0 select-none">
                  <span className="text-sm font-medium text-[#92400E]">Edited Total</span>
                  <span className="text-xl font-bold text-[#D97706]">
                    Rs. {editedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

            )}
          </div>

        </div>

      </div>

    </div>
  );
}
