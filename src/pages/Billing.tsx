import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  User,
  Printer,
  Save,
  Plus,
  Minus,
  CreditCard,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { Medicine, Customer } from '../types/models';

export default function Billing() {
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isScanMode, setIsScanMode] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const addToCart = useCallback((med: Medicine) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === med.id);
      if (existing) {
        return prev.map(item => item.id === med.id ? { ...item, qty: item.qty + 1 } : item);
      } else {
        return [...prev, {
          id: med.id,
          name: med.name,
          genericName: med.genericName,
          dosageForm: med.dosageForm,
          strength: med.strength,
          qty: 1,
          price: med.sellingPrice || 0,
          batchNo: med.batchNo // If available from search (though FIFO usually handles this in repo)
        }];
      }
    });
    setSearchTerm('');
    setSearchResults([]);
  }, []);

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    const res = await (window as any).electronAPI.dbQuery('medicines:getByBarcode', { barcode });
    if (res.success && res.data) {
      addToCart(res.data);
    }
  }, [addToCart]);

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeydown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) buffer = '';
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer && isScanMode) {
          handleBarcodeScan(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isScanMode, handleBarcodeScan]);

  const searchMedicines = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await (window as any).electronAPI.dbQuery('medicines:search', { term });
    if (res.success) setSearchResults(res.data);
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQty = (id: number, qty: number) => {
    if (qty < 1) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty } : item));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountAmount = (subtotal * discount) / 100;
  const taxAmount = subtotal * 0.01; // Mock 1% tax for demo
  const grandTotal = subtotal - discountAmount + taxAmount;

  const handleCheckout = async (print: boolean) => {
    if (cart.length === 0) return;
    setIsLoading(true);
    setMessage(null);

    try {
      let fbrData = null;

      // 1. If printing (FBR mode), report to fiscal service first
      if (print) {
        const fiscalRes = await (window as any).electronAPI.fiscalReport({
          billNo: "TEMP-" + Date.now(),
          customerName: selectedCustomer?.fullName || "Walking Customer",
          grandTotal,
          taxAmount,
          items: cart.map(i => ({ medicineId: i.id, medicineName: i.name, quantity: i.qty, subtotal: i.price * i.qty }))
        });

        if (fiscalRes.success) {
          fbrData = {
            reported: true,
            invoiceNo: fiscalRes.invoiceNumber,
            response: fiscalRes.responseRaw
          };
        } else {
          if (!confirm(`FBR Reporting Failed: ${fiscalRes.error}\n\nDo you want to save the bill internally only?`)) {
            setIsLoading(false);
            return;
          }
        }
      }

      // 2. Save to database
      const saleData = {
        customerId: selectedCustomer?.id || null,
        items: cart.map(item => ({ medicineId: item.id, quantity: item.qty, price: item.price })),
        totalAmount: subtotal,
        taxAmount,
        discountAmount,
        grandTotal,
        paymentMethod: 'Cash',
        fbrReported: !!fbrData,
        fbrInvoiceNo: fbrData?.invoiceNo || null,
        fbrResponse: fbrData?.response || null
      };

      const res = await (window as any).electronAPI.dbQuery('sales:create', saleData);

      if (res.success) {
        const finalBillNo = res.data.bill_no;

        // 3. Print physical receipt if requested
        if (print) {
          await (window as any).electronAPI.printReceipt({
            billNo: finalBillNo,
            saleDate: new Date(),
            customerName: selectedCustomer?.fullName || "Walking Customer",
            items: cart.map(i => ({ 
              medicineName: i.name, 
              genericName: i.genericName,
              batchNo: i.batchNo,
              quantity: i.qty, 
              unitPrice: i.price, 
              subtotal: i.price * i.qty 
            })),
            totalAmount: subtotal,
            discountAmount,
            taxAmount,
            grandTotal,
            fbrInvoiceNo: fbrData?.invoiceNo
          });
        }

        setCart([]);
        setSelectedCustomer(null);
        setDiscount(0);
        setMessage({ type: 'success', text: `Invoice #${finalBillNo} processed successfully.` });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to save sale.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Messages */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border animate-in zoom-in-95 duration-300 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto hover:bg-black/5 p-1 rounded-lg">
            <Trash2 size={16} />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Left Side: Search & Cart */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* Search Header */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Billing Counter</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Session</p>
                </div>
              </div>
              <button
                onClick={() => setIsScanMode(!isScanMode)}
                className={`px-4 py-2 rounded-xl font-bold text-xs border transition-all flex items-center gap-2 ${isScanMode
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
              >
                <div className={`w-2 h-2 rounded-full ${isScanMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
                Barcode Scanner: {isScanMode ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
              <input
                type="text"
                placeholder="Search medicine by name, generic, or barcode..."
                value={searchTerm}
                onChange={(e) => searchMedicines(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                  {searchResults.map(med => (
                    <button
                      key={med.id}
                      onClick={() => addToCart(med)}
                      className="w-full p-4 text-left hover:bg-blue-50 border-b border-slate-50 last:border-none flex justify-between items-center group/item transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800 group-hover/item:text-blue-700 transition-colors">{med.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{med.genericName || 'No Generic'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900">Rs. {med.sellingPrice}</p>
                        <p className={`text-[10px] font-bold ${med.stockQty && med.stockQty > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          Stock: {med.stockQty || 0}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shopping Cart ({cart.length} items)</span>
              <button onClick={() => setCart([])} className="text-[10px] font-bold text-rose-500 uppercase tracking-widest hover:underline">Clear All</button>
            </div>
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white border-b border-slate-50 sticky top-0 z-10">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Product Details</th>
                    <th className="px-6 py-4 text-center">Price</th>
                    <th className="px-6 py-4 text-center">Quantity</th>
                    <th className="px-6 py-4 text-right">Subtotal</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cart.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-700">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.dosageForm} • {item.strength}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-600">Rs. {item.price.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => updateQty(item.id, item.qty - 1)}
                            className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-black text-slate-800 w-6 text-center text-sm">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.id, item.qty + 1)}
                            className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">Rs. {(item.price * item.qty).toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <ShoppingCart size={64} className="mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">Cart is empty</p>
                          <p className="text-xs mt-1">Start by searching for medicines above</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Checkout */}
        <div className="w-full lg:w-96 flex flex-col gap-6">
          {/* Customer Selection */}
          <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <User className="text-blue-400" size={18} />
                <h2 className="text-xs font-black uppercase tracking-widest">Customer</h2>
              </div>
              <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                <UserPlus size={14} />
              </button>
            </div>
            <div className="relative z-10">
              <input
                type="text"
                placeholder="Search customers..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold placeholder-white/20 outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center relative z-10">
              <span className="text-[10px] font-black uppercase text-blue-300 tracking-widest">
                {selectedCustomer?.fullName || 'Walking Customer (Default)'}
              </span>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
              <CreditCard size={16} className="text-blue-600" />
              Payment Summary
            </h2>

            <div className="space-y-5 flex-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">Sub-Total</span>
                <span className="text-sm font-black text-slate-800">Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Discount</span>
                  <span className="px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold">{discount}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-14 bg-slate-50 border border-slate-200 rounded-xl p-2 text-right font-black text-xs outline-none focus:border-blue-600"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">Sales Tax (FBR)</span>
                <span className="text-sm font-black text-slate-800">Rs. {taxAmount.toLocaleString()}</span>
              </div>

              <div className="h-px bg-slate-100 my-6" />

              <div className="pt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Grand Total</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">Rs. {Math.round(grandTotal).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-12">
              <button
                onClick={() => handleCheckout(true)}
                disabled={isLoading || cart.length === 0}
                className="w-full bg-blue-600 text-white h-16 rounded-2xl font-black text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-100 active:scale-95"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <Printer size={20} />}
                FBR Reporting + Print
              </button>
              <button
                onClick={() => handleCheckout(false)}
                disabled={isLoading || cart.length === 0}
                className="w-full h-14 border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-50 hover:border-slate-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Save size={18} />
                Internal Only (Draft)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
