import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Trash2, 
  RotateCcw, 
  Printer, 
  FileText, 
  ChevronRight, 
  Calendar,
  User as UserIcon,
  Receipt,
  X,
  AlertCircle,
  CheckCircle2
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
}

export default function Financial() {
  const { user } = useAuth();
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadSales();
  }, [searchTerm, dateFilter]);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const result = await (window as any).electronAPI.dbQuery('sales:getAll', {
        startDate: dateFilter ? `${dateFilter} 00:00:00` : undefined,
        endDate: dateFilter ? `${dateFilter} 23:59:59` : undefined,
      });
      if (result.success) {
        setSales(result.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
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
        totalAmount: selectedSale.grand_total, // Assuming grand_total is base for reprint
        discountAmount: 0, // Placeholder as we don't have discount in details view yet
        taxAmount: 0,
        grandTotal: selectedSale.grand_total
      });
      setMessage({ type: 'success', text: `Receipt for #${selectedSale.bill_no} sent to printer.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Print failed: ${err.message}` });
    }
  };

  const handleVoid = async () => {
    if (!selectedSale) return;
    if (!confirm(`Are you sure you want to VOID Bill #${selectedSale.bill_no}? This will restore all stock.`)) return;

    try {
      const result = await (window as any).electronAPI.dbQuery('sales:void', {
        billNo: selectedSale.bill_no,
        userId: user?.id
      });
      if (result.success) {
        setMessage({ type: 'success', text: `Sale #${selectedSale.bill_no} has been voided.` });
        loadSales();
        setSelectedSale(null);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to void sale.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleReturn = async (item: SaleItem) => {
    const qty = returnQtys[item.id];
    if (qty <= 0 || qty > (item.quantity - item.returned_qty)) {
      alert('Invalid return quantity');
      return;
    }

    if (!confirm(`Return ${qty} units of ${item.medicine_name}?`)) return;

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
        setMessage({ type: 'success', text: 'Return processed successfully.' });
        loadSaleDetails(selectedSale!.id);
        loadSales();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to process return.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-blue-600" />
            Financial Management
          </h1>
          <p className="text-slate-500 text-sm">Review sales history, process returns, and manage invoices.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search Bill No / Customer..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="date"
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border animate-in zoom-in-95 duration-300 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto hover:bg-black/5 p-1 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales List */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <Receipt size={18} className="text-slate-400" />
              Recent Invoices
            </h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sales.length} Results</span>
          </div>

          <div className="overflow-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bill No</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic text-sm">No invoices found.</td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      onClick={() => loadSaleDetails(sale.id)}
                      className={`group hover:bg-blue-50/50 cursor-pointer transition-colors ${selectedSale?.id === sale.id ? 'bg-blue-50/80' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <div className="font-mono font-bold text-slate-700">{sale.bill_no}</div>
                        <div className="text-[10px] text-slate-400">{formatDate(sale.sale_date)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-slate-600">{sale.customer_name || 'Walking Customer'}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <UserIcon size={10} /> {sale.cashier_name}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="text-sm font-bold text-slate-700">Rs. {Number(sale.grand_total).toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          sale.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                          sale.status === 'Voided' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ChevronRight className={`text-slate-300 group-hover:text-blue-400 transition-all ${selectedSale?.id === sale.id ? 'translate-x-1 text-blue-500' : ''}`} size={18} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sale Details / Return Panel */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {selectedSale ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-300">
              <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Invoice Details</h3>
                  <p className="text-[10px] text-slate-400">Bill No: {selectedSale.bill_no}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePrint}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white" 
                    title="Print Receipt"
                  >
                    <Printer size={16} />
                  </button>
                  <button 
                    disabled={selectedSale.status === 'Voided'}
                    onClick={handleVoid}
                    className="p-2 hover:bg-rose-500/20 rounded-lg transition-colors text-rose-400 hover:text-rose-300 disabled:opacity-30 disabled:cursor-not-allowed" 
                    title="Void Bill"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button onClick={() => setSelectedSale(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {isDetailsLoading ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <RotateCcw className="animate-spin" />
                  <span className="text-sm">Loading details...</span>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-slate-400 font-bold uppercase tracking-widest mb-1">Customer</p>
                      <p className="text-slate-700 font-bold">{selectedSale.customer_name || 'Walking Customer'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-slate-400 font-bold uppercase tracking-widest mb-1">Status</p>
                      <p className={`font-bold ${
                        selectedSale.status === 'Completed' ? 'text-emerald-600' :
                        selectedSale.status === 'Voided' ? 'text-rose-600' : 'text-amber-600'
                      }`}>{selectedSale.status}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Items & Returns</p>
                    <div className="space-y-2 max-h-[300px] overflow-auto custom-scrollbar">
                      {selectedSale.items.map((item) => (
                        <div key={item.id} className="p-3 rounded-xl border border-slate-100 bg-white group/item hover:border-blue-200 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-xs font-bold text-slate-700">{item.medicine_name}</p>
                              <p className="text-[10px] text-slate-400">
                                Sold: {item.quantity} | Returned: {item.returned_qty}
                              </p>
                            </div>
                            <p className="text-xs font-bold text-slate-700">Rs. {Number(item.subtotal).toLocaleString()}</p>
                          </div>
                          
                          {selectedSale.status !== 'Voided' && item.quantity > item.returned_qty && (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                              <input 
                                type="number"
                                min="1"
                                max={item.quantity - item.returned_qty}
                                className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                value={returnQtys[item.id] || 1}
                                onChange={(e) => setReturnQtys({...returnQtys, [item.id]: parseInt(e.target.value) || 0})}
                              />
                              <button 
                                onClick={() => handleReturn(item)}
                                className="flex-1 flex items-center justify-center gap-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-colors shadow-sm shadow-amber-200"
                              >
                                <RotateCcw size={12} />
                                Process Return
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Subtotal</span>
                      <span>Rs. {Number(selectedSale.grand_total).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-slate-800">
                      <span>Total</span>
                      <span>Rs. {Number(selectedSale.grand_total).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 flex flex-col items-center justify-center text-slate-400 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                <Search size={32} className="text-slate-200" />
              </div>
              <div>
                <p className="font-bold text-slate-500">Select an Invoice</p>
                <p className="text-xs max-w-[200px]">Click on any invoice from the list to view details and manage returns.</p>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 rounded-lg">
                <AlertCircle size={20} />
              </div>
              <h4 className="font-bold text-sm tracking-wide">Quick Tip</h4>
            </div>
            <p className="text-xs text-blue-100 leading-relaxed mb-4">
              Voiding an invoice will automatically restore stock for all items. Individual item returns will adjust the total bill amount and restore stock only for the returned quantity.
            </p>
            <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-[10px] font-mono">
              ROLE: {user?.role || 'STAFF'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
