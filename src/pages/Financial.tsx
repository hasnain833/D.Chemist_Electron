import { useState, useEffect } from 'react';
import {
  FileText,
  RotateCcw,
  Printer,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Download
} from 'lucide-react';
import { useAuth } from '../AuthContext';

interface SaleSummary {
  id: number;
  bill_no: string;
  customer_name: string;
  grand_total: string | number;
  sale_date: string;
  status: string;
  cashier_name: string;
}

interface SaleItem {
  id: number;
  medicine_name: string;
  quantity: number;
  returned_qty: number;
  unit_price: string | number;
  subtotal: string | number;
}

interface SaleDetails extends SaleSummary {
  items: SaleItem[];
  total_amount: string | number;
  tax_amount: string | number;
  discount_amount: string | number;
}

export default function Financial() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [searchInvoiceTerm, setSearchInvoiceTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchCustomerTerm, setSearchCustomerTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState('Loading bills...');

  useEffect(() => {
    loadSales();
  }, [searchDate]);

  const loadSales = async () => {
    setIsLoading(true);
    setStatusMessage('Loading bills...');
    try {
      const result = await (window as any).electronAPI.dbQuery('sales:getAll', {
        startDate: searchDate ? `${searchDate} 00:00:00` : undefined,
        endDate: searchDate ? `${searchDate} 23:59:59` : undefined,
      });
      if (result.success) {
        setSales(result.data);
        setStatusMessage(result.data.length === 0 ? 'No bills found matching your search.' : `${result.data.length} bills found.`);
      } else {
        setStatusMessage('Error loading bills.');
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Error loading bills.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (filteredSales.length === 0) {
      alert("No sales history available to export.");
      return;
    }

    const headers = ["Bill No", "Customer", "Amount", "Date", "Status"];

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
      ...filteredSales.map(s => [
        escapeCsv(s.bill_no),
        escapeCsv(s.customer_name || 'Walking Customer'),
        s.grand_total,
        new Date(s.sale_date).toLocaleString(),
        s.status
      ].join(","))
    ];

    const csvContent = lines.join("\n");
    const today = new Date().toISOString().split('T')[0];
    const res = await (window as any).electronAPI.exportCSV(`Sales_Report_${today}.csv`, csvContent);
    if (res.success) {
      alert(`Success: Sales history exported successfully to:\n${res.filePath}`);
    } else if (res.message !== 'Export cancelled.') {
      alert(`Export Error: ${res.message}`);
    }
  };

  const loadSaleDetails = async (id: number) => {
    setIsDetailsLoading(true);
    try {
      const result = await (window as any).electronAPI.dbQuery('sales:getById', { id });
      if (result.success) {
        setSelectedSale(result.data);
        // Initialize return quantities
        const qtys: Record<number, number> = {};
        result.data.items.forEach((item: SaleItem) => {
          qtys[item.id] = 1;
        });
        setReturnQtys(qtys);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedSale) return;
    try {
      await (window as any).electronAPI.printReceipt({
        billNo: selectedSale.bill_no,
        saleDate: selectedSale.sale_date,
        customerName: selectedSale.customer_name || "Walking Customer",
        items: selectedSale.items.map(i => ({
          medicineName: i.medicine_name,
          genericName: (i as any).generic_name,
          batchNo: (i as any).batch_no,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          subtotal: i.subtotal
        })),
        totalAmount: selectedSale.total_amount,
        discountAmount: selectedSale.discount_amount,
        taxAmount: selectedSale.tax_amount,
        grandTotal: selectedSale.grand_total
      });
      setMessage({ type: 'success', text: `Receipt for #${selectedSale.bill_no} sent to printer.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Print failed: ${err.message}` });
    }
  };

  // ── Void — matches WPF ExecuteVoidSaleAsync with confirmation ──
  const handleVoid = async () => {
    if (!selectedSale) return;
    const ok = window.confirm(
      `Are you sure you want to VOID Bill #${selectedSale.bill_no}?\n\nThis will restore all stock and mark the sale as Voided.`
    );
    if (!ok) return;

    try {
      const result = await (window as any).electronAPI.dbQuery('sales:void', {
        billNo: selectedSale.bill_no,
        userId: user?.id
      });
      if (result.success) {
        setMessage({ type: 'success', text: `Sale #${selectedSale.bill_no} has been voided successfully.` });
        loadSales();
        setSelectedSale(null);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to void sale.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // ── Return single item — matches WPF ExecuteReturnAsync with validation ──
  const handleReturn = async (item: SaleItem) => {
    const qty = returnQtys[item.id] || 0;
    const remainingQty = item.quantity - item.returned_qty;

    // Mirror WPF: qty <= 0 rejected
    if (qty <= 0) {
      setMessage({ type: 'error', text: 'Please specify at least 1 unit to return.' });
      return;
    }
    // Mirror WPF: qty > remaining rejected
    if (qty > remainingQty) {
      setMessage({ type: 'error', text: `Return quantity cannot exceed remaining sold quantity (${remainingQty}).` });
      return;
    }

    const ok = window.confirm(`Return ${qty} unit(s) of ${item.medicine_name}?`);
    if (!ok) return;

    try {
      const result = await (window as any).electronAPI.dbQuery('sales:processReturn', {
        saleId: selectedSale?.id,
        returnedItems: [{
          saleItemId: item.id,
          returnQty: qty,
          batchId: (item as any).batch_id
        }],
        userId: user?.id
      });

      if (result.success) {
        setMessage({ type: 'success', text: `Item returned and stock restored.` });
        loadSaleDetails(selectedSale!.id);
        loadSales();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to process return.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // ── Return all remaining items in bill — mirrors WPF 'Return Complete Bill' button ──
  const handleReturnCompleteBill = async () => {
    if (!selectedSale) return;
    const remainingItems = selectedSale.items.filter(item => item.quantity > item.returned_qty);

    // Mirror WPF: validate at least one item has remaining qty
    if (remainingItems.length === 0) {
      setMessage({ type: 'error', text: 'No items remaining to return in this bill.' });
      return;
    }

    const ok = window.confirm(
      `Are you sure you want to return ALL remaining items in Bill #${selectedSale.bill_no}?\n\nThis will restore all stock for every item that hasn't already been returned.`
    );
    if (!ok) return;

    try {
      const returnedItems = remainingItems.map(item => ({
        saleItemId: item.id,
        returnQty: item.quantity - item.returned_qty,
        batchId: (item as any).batch_id
      }));

      const result = await (window as any).electronAPI.dbQuery('sales:processReturn', {
        saleId: selectedSale.id,
        returnedItems,
        userId: user?.id
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Complete bill return processed successfully.' });
        loadSaleDetails(selectedSale.id);
        loadSales();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to process return.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Perform client-side filtering matching C# ViewModel SearchInvoiceTerm and SearchCustomerTerm
  const filteredSales = sales.filter(sale => {
    const matchesInvoice = !searchInvoiceTerm.trim() ||
      sale.bill_no.toLowerCase().includes(searchInvoiceTerm.toLowerCase().trim());
    const matchesCustomer = !searchCustomerTerm.trim() ||
      (sale.customer_name || 'Walking Customer').toLowerCase().includes(searchCustomerTerm.toLowerCase().trim());
    return matchesInvoice && matchesCustomer;
  });

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] overflow-hidden animate-fade-in">

      {/* Header with LinearGradientBrush replication */}
      <div className="bg-linear-to-r from-[#00D2FF] to-[#3a7bd5] px-[40px] py-[24px] flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-5">
          <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <FileText className="text-[#3a7bd5]" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-white tracking-tight">Bills & Financials</h1>
            <span className="text-xs text-slate-100 font-medium opacity-90">{statusMessage}</span>
          </div>
        </div>
      </div>

      {/* Main Body Area */}
      <div className="flex-1 flex flex-col px-[40px] py-[24px] gap-4 overflow-hidden min-h-0">

        {message && (
          <div className={`p-3.5 rounded-lg flex items-center gap-3 border animate-fade-in shrink-0 ${message.type === 'success' ? 'bg-[#ECFDF5] border-[#D1FAE5] text-[#059669]' : 'bg-[#FEE2E2] border-[#FEE2E2] text-[#DC2626]'
            }`}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-xs font-semibold">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto hover:bg-black/5 p-1 rounded transition-colors cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex-1 flex gap-6 overflow-hidden min-h-0">

          {/* Left Side Card: Invoices List */}
          <div className="w-[450px] bg-white border border-[#E2E8F0] rounded-xl flex flex-col overflow-hidden shadow-sm shrink-0">

            {/* Search Box Grid */}
            <div className="p-4 border-b border-[#E2E8F0] grid grid-cols-2 gap-x-4 gap-y-3 relative shrink-0 bg-white">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-[#4B5563]">Bill Number</span>
                <input
                  type="text"
                  placeholder="BILL-..."
                  className="h-8 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                  value={searchInvoiceTerm}
                  onChange={(e) => setSearchInvoiceTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-[#4B5563]">Date</span>
                <input
                  type="date"
                  className="h-8 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827] cursor-pointer"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <span className="text-[11px] font-semibold text-[#4B5563]">Customer Name</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search customer..."
                    className="flex-1 h-8 px-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-[#111827]"
                    value={searchCustomerTerm}
                    onChange={(e) => setSearchCustomerTerm(e.target.value)}
                  />
                  <button
                    onClick={loadSales}
                    className="h-8 px-4 border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#4B5563] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none bg-white"
                  >
                    <RotateCcw size={12} className={isLoading ? "animate-spin" : ""} />
                    Refresh
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="h-8 px-4 border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#4B5563] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none bg-white"
                  >
                    <Download size={12} />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Title Bar "Sales Bills" */}
            <div className="bg-[#F7FAFC] px-4 py-3 border-b border-[#E2E8F0] shrink-0 select-none">
              <span className="text-sm font-bold text-[#4A5568]">Sales Bills</span>
            </div>

            {/* Bills ListView Items */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-white divide-y divide-[#F1F5F9]">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-400 text-sm select-none">
                  <RotateCcw className="animate-spin mr-2" size={16} /> Loading bills...
                </div>
              ) : filteredSales.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-slate-400 text-sm select-none">
                  No bills found.
                </div>
              ) : (
                filteredSales.map((sale) => (
                  <div
                    key={sale.id}
                    onClick={() => loadSaleDetails(sale.id)}
                    className={`p-4 flex items-center justify-between cursor-pointer border-b border-[#F1F5F9] transition-colors ${selectedSale?.id === sale.id ? 'bg-[#00D2FF]/5 border-l-4 border-l-[#00D2FF] pl-3' : 'hover:bg-slate-50/50'
                      }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="font-bold text-[#111827] text-sm truncate">{sale.bill_no}</div>
                      <div className="text-xs text-[#718096] truncate mt-0.5">{sale.customer_name || 'Walking Customer'}</div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 mr-4">
                      <span className="font-semibold text-sm text-[#00D2FF]">
                        Rs. {parseFloat(sale.grand_total.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-[#A0AEC0] mt-0.5">
                        {formatDate(sale.sale_date)}
                      </span>
                    </div>
                    <div
                      className="px-2.5 py-1 text-[10px] font-bold uppercase rounded shrink-0 select-none text-center"
                      style={{
                        backgroundColor:
                          sale.status === 'Voided' ? 'rgb(254, 226, 226)' :
                            sale.status === 'Returned' || sale.status === 'Refunded' ? 'rgb(255, 243, 191)' :
                              'rgb(236, 253, 245)',
                        color:
                          sale.status === 'Voided' ? 'rgb(220, 38, 38)' :
                            sale.status === 'Returned' || sale.status === 'Refunded' ? 'rgb(153, 101, 21)' :
                              'rgb(5, 150, 105)'
                      }}
                    >
                      {sale.status}
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
                <h2 className="text-sm font-bold text-[#111827] uppercase tracking-wider">Items in Selection</h2>
                {isDetailsLoading && <RotateCcw className="animate-spin text-slate-400" size={14} />}
              </div>

              {selectedSale && !isDetailsLoading && (
                <div className="flex gap-2">
                  {/* Reprint Button */}
                  <button
                    onClick={handlePrint}
                    className="h-9 px-4 bg-[#EBF8FF] hover:bg-[#D6EEFF] text-[#3182CE] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                    title="Print Receipt"
                  >
                    <Printer size={14} /> Reprint Receipt
                  </button>

                  {/* Void Button */}
                  {selectedSale.status !== 'Voided' && (
                    <button
                      onClick={handleVoid}
                      className="h-9 px-4 bg-[#FEE2E2] hover:bg-red-100 text-[#DC2626] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                      title="Void Bill"
                    >
                      <Trash2 size={14} /> Void Sale
                    </button>
                  )}

                  {/* Return Complete Bill Button */}
                  {selectedSale.status !== 'Voided' && selectedSale.items.some(item => item.quantity > item.returned_qty) && (
                    <button
                      onClick={handleReturnCompleteBill}
                      className="h-9 px-4 bg-[#FFF3E0] hover:bg-[#FFE0B2] text-[#E65100] font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none border-0"
                      title="Return all remaining items in this bill and restore stock"
                    >
                      <RotateCcw size={14} className="text-[#E65100]" /> Return Complete Bill
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Details Items List Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {!selectedSale ? (
                <div className="grow flex flex-col items-center justify-center py-24 text-slate-300 select-none">
                  <FileText size={64} className="opacity-15 mb-3" />
                  <span className="text-sm font-semibold text-slate-400">Select a bill to view items and process returns</span>
                </div>
              ) : isDetailsLoading ? (
                <div className="grow flex flex-col items-center justify-center py-24 text-slate-400 text-sm select-none">
                  <RotateCcw className="animate-spin mr-2" size={16} /> Loading details...
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="bg-[#F9FAFB] border-b border-[#E2E8F0] px-5 py-3 grid grid-cols-[1fr_50px_50px_50px_70px_80px_70px_80px] gap-2 text-[11px] font-bold text-[#718096] shrink-0 select-none">
                    <div>Medicine</div>
                    <div className="text-center">Sold</div>
                    <div className="text-center">Ret</div>
                    <div className="text-center">Rem</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">Total</div>
                    <div className="text-center">Ret Qty</div>
                    <div className="text-center">Action</div>
                  </div>

                  {/* Table Rows */}
                  <div className="flex-1 overflow-auto custom-scrollbar divide-y divide-[#F1F5F9]">
                    {selectedSale.items.map((item) => {
                      const remainingQty = item.quantity - item.returned_qty;
                      const currentTotal = remainingQty * parseFloat(item.unit_price.toString());
                      const returnVal = returnQtys[item.id] !== undefined ? returnQtys[item.id] : 1;
                      const canReturn = remainingQty > 0 && selectedSale.status !== 'Voided';

                      return (
                        <div key={item.id} className="px-5 py-3 grid grid-cols-[1fr_50px_50px_50px_70px_80px_70px_80px] gap-2 text-xs items-center hover:bg-slate-50/50 transition-colors">
                          <div className="font-semibold text-[#111827] truncate pr-2" title={item.medicine_name}>
                            {item.medicine_name}
                          </div>
                          <div className="text-center text-[#4A5568]">{item.quantity}</div>
                          <div className="text-center text-[#E53E3E] font-medium">{item.returned_qty}</div>
                          <div className="text-center text-[#38A169] font-medium">{remainingQty}</div>
                          <div className="text-right text-[#4A5568]">
                            Rs. {parseFloat(item.unit_price.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-right font-bold text-[#111827]">
                            Rs. {currentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="flex justify-center">
                            <input
                              type="number"
                              min="1"
                              max={remainingQty}
                              disabled={!canReturn}
                              className="w-12 h-7 px-1 border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#00D2FF] text-xs font-semibold text-center disabled:opacity-50"
                              value={returnVal}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setReturnQtys(prev => ({ ...prev, [item.id]: val }));
                              }}
                            />
                          </div>
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleReturn(item)}
                              disabled={!canReturn}
                              className="h-7 px-3 bg-[#EBF8FF] hover:bg-blue-100 text-[#3182CE] font-bold rounded text-[10px] transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Return
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Details Footer Summary */}
                  <div className="pt-4 border-t border-[#E2E8F0] space-y-2 px-5 py-4 bg-[#F8FAFC] shrink-0">
                    <div className="flex justify-between text-xs text-[#4B5563]">
                      <span>Subtotal</span>
                      <span>Rs. {parseFloat(selectedSale.total_amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {parseFloat(selectedSale.discount_amount.toString()) > 0 && (
                      <div className="flex justify-between text-xs text-[#4B5563]">
                        <span>Discount</span>
                        <span>-Rs. {parseFloat(selectedSale.discount_amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {parseFloat(selectedSale.tax_amount.toString()) > 0 && (
                      <div className="flex justify-between text-xs text-[#4B5563]">
                        <span>Tax</span>
                        <span>Rs. {parseFloat(selectedSale.tax_amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-[#111827] pt-1 border-t border-[#F1F5F9]">
                      <span>Grand Total</span>
                      <span className="text-base text-[#00D2FF]">Rs. {parseFloat(selectedSale.grand_total.toString()).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
