import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  User,
  Printer,
  Save,
  CreditCard,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { Medicine, Customer } from '../types/models';
import Modal from '../components/Modal';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

export default function Billing() {
  const [cart, setCart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isScanMode, setIsScanMode] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Checkout Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [amountReceived, setAmountReceived] = useState(0);
  const [printReceiptOpt, setPrintReceiptOpt] = useState(false);

  const addToCart = useCallback((med: Medicine) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === med.id);
      const unitsPerBox = (med.packetsPerBox || 1) * (med.unitsPerPack || 1);
      if (existing) {
        const newQty = existing.qty + 1;
        const qtyBox = unitsPerBox > 1 ? Math.floor(newQty / unitsPerBox) : 0;
        const qtyTablet = unitsPerBox > 1 ? newQty % unitsPerBox : newQty;
        return prev.map(item => item.id === med.id ? { ...item, qty: newQty, qtyBox, qtyTablet } : item);
      } else {
        return [...prev, {
          id: med.id,
          name: med.name,
          genericName: med.genericName,
          dosageForm: med.dosageForm,
          strength: med.strength,
          qty: 1,
          qtyBox: 0,
          qtyTablet: 1,
          price: med.sellingPrice || 0,
          batchNo: med.batchNo, // If available from search (though FIFO usually handles this in repo)
          unitsPerBox
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

  // 1. Barcode Scanner Hook
  useBarcodeScanner(handleBarcodeScan);

  // 2. POS Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCheckoutModalOpen) return; // Disable shortcuts if modal is open

      switch (e.key) {
        case 'F2':
          e.preventDefault();
          document.getElementById('medicine-search-input')?.focus();
          break;
        case 'F5':
          e.preventDefault();
          if (cart.length > 0) handleCheckout(true); // F5 = Complete Sale (Reported)
          break;
        case 'F8':
          e.preventDefault();
          if (cart.length > 0) handleCheckout(false); // F8 = Complete Sale (Internal)
          break;
        case 'Escape':
          e.preventDefault();
          if (cart.length > 0 && confirm('Are you sure you want to clear the cart?')) {
            setCart([]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckoutModalOpen]);

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

  const updateCartItemQty = (id: number, field: 'qtyBox' | 'qtyTablet', value: number) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item };
      if (field === 'qtyBox') {
        updated.qtyBox = Math.max(0, value);
      } else if (field === 'qtyTablet') {
        updated.qtyTablet = Math.max(0, value);
      }
      updated.qty = (updated.qtyBox * updated.unitsPerBox) + updated.qtyTablet;
      return updated;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountAmount = (subtotal * discount) / 100;
  const taxAmount = subtotal * 0.01; // Mock 1% tax for demo
  const grandTotal = subtotal - discountAmount + taxAmount;

  const handleCheckout = (print: boolean) => {
    if (cart.length === 0) return;
    setPrintReceiptOpt(print);
    setAmountReceived(Math.round(grandTotal));
    setIsCheckoutModalOpen(true);
  };

  const processPayment = async () => {
    if (cart.length === 0) return;
    setIsLoading(true);
    setMessage(null);

    try {
      let fbrData = null;
      const print = printReceiptOpt;

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
        setIsCheckoutModalOpen(false);
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
    <div className="h-full flex flex-col pt-6 bg-[#F8F9FA] animate-in fade-in duration-300">
      {/* Messages */}
      {message && (
        <div className={`mx-[60px] mb-4 p-4 rounded-xl flex items-center gap-3 border animate-in zoom-in-95 duration-300 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto hover:bg-black/5 p-1 rounded-lg">
            <Trash2 size={16} />
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden pl-[60px] pr-4 gap-6">

        {/* Left: Bill Generation */}
        <div className="flex-1 flex flex-col gap-5 overflow-hidden">

          {/* Unified Search & Scanner Card */}
          <div className="premium-card p-5 flex items-center gap-5 bg-white">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#4B5563]">Continuous Scan</span>
              <button
                onClick={() => setIsScanMode(!isScanMode)}
                className={`h-9 px-4 rounded-lg font-bold text-xs transition-colors flex items-center gap-2 ${isScanMode ? 'bg-[#00D2FF]/10 text-[#00D2FF]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                {isScanMode ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-1 relative group">
              <span className="text-[11px] font-semibold text-[#4B5563]">Search Local Stock</span>
              <div className="relative">
                <input
                  id="medicine-search-input"
                  type="text"
                  placeholder="Type medicine name..."
                  value={searchTerm}
                  onChange={(e) => searchMedicines(e.target.value)}
                  className="premium-input w-full pl-3 pr-10 py-2 h-9 text-sm"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              </div>

              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  {searchResults.map(med => (
                    <button
                      key={med.id}
                      onClick={() => addToCart(med)}
                      className="w-full p-2 px-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-none flex justify-between items-center transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-[#111827]">{med.name}</span>
                        <span className="text-xs text-[#4B5563]">{med.genericName || 'No Generic'}</span>
                      </div>
                      <span className="text-sm font-bold text-[#00D2FF]">Rs. {med.sellingPrice}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Table */}
          <div className="premium-card flex-1 flex flex-col overflow-hidden bg-white">
            <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3 flex items-center">
              <div className="flex-1 text-xs font-bold text-[#64748B]">Medicine</div>
              <div className="w-[100px] text-xs font-bold text-[#64748B] text-center">Box Qty</div>
              <div className="w-[100px] text-xs font-bold text-[#64748B] text-center">Tablet Qty</div>
              <div className="w-[120px] text-xs font-bold text-[#64748B] text-right">Price (Unit)</div>
              <div className="w-[120px] text-xs font-bold text-[#64748B] text-right">Subtotal</div>
              <div className="w-[48px]"></div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center px-4 py-2 border-b border-[#F1F5F9] hover:bg-slate-50/50">
                  <div className="flex-1 font-medium text-[#111827] truncate pr-4">
                    {item.name}
                  </div>
                  <div className="w-[100px] px-1">
                    <input
                      type="number"
                      placeholder="Box"
                      value={item.qtyBox === 0 ? '' : item.qtyBox}
                      onChange={(e) => updateCartItemQty(item.id, 'qtyBox', parseInt(e.target.value) || 0)}
                      className="premium-input w-full h-8 text-center text-sm"
                    />
                  </div>
                  <div className="w-[100px] px-1">
                    <input
                      type="number"
                      placeholder="Tab"
                      value={item.qtyTablet === 0 ? '' : item.qtyTablet}
                      onChange={(e) => updateCartItemQty(item.id, 'qtyTablet', parseInt(e.target.value) || 0)}
                      className="premium-input w-full h-8 text-center text-sm"
                    />
                  </div>
                  <div className="w-[120px] text-right text-[13px] text-[#4B5563]">
                    Rs. {item.price.toLocaleString()}
                  </div>
                  <div className="w-[120px] text-right font-semibold text-[#00D2FF]">
                    Rs. {(item.price * item.qty).toLocaleString()}
                  </div>
                  <div className="w-[48px] flex justify-center">
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-[#E53E3E] hover:bg-rose-50 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="py-20 text-center text-[#4B5563]">
                  <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Cart is empty</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Customer Info + Order Summary */}
        <div className="w-[400px] flex flex-col gap-6 mr-6">

          {/* Customer Selection */}
          <div className="premium-card p-5 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <User size={16} className="text-[#00D2FF]" />
              <h2 className="text-sm font-bold text-[#111827]">Customer Information</h2>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search customers..."
                className="premium-input flex-1 h-10"
              />
              <button className="h-10 w-10 btn-secondary rounded-lg">
                <UserPlus size={16} />
              </button>
            </div>
            <div className="mt-4 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-center">
              <span className="text-xs font-semibold text-[#111827]">
                {selectedCustomer?.fullName || 'Walking Customer (Default)'}
              </span>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="premium-card p-6 bg-white flex-1 flex flex-col">
            <h2 className="text-sm font-bold text-[#111827] mb-6 flex items-center gap-2">
              <CreditCard size={16} className="text-[#00D2FF]" />
              Payment Summary
            </h2>

            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-medium text-[#4B5563]">Sub-Total</span>
                <span className="text-[13px] font-semibold text-[#111827]">Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-medium text-[#4B5563]">Discount</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#00D2FF] font-bold">{discount}%</span>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="premium-input w-16 h-8 text-right text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-medium text-[#4B5563]">Sales Tax (FBR)</span>
                <span className="text-[13px] font-semibold text-[#111827]">Rs. {taxAmount.toLocaleString()}</span>
              </div>

              <div className="h-px bg-[#E2E8F0] my-4" />

              <div className="pt-2">
                <p className="text-[11px] font-semibold text-[#4B5563] uppercase mb-1">Grand Total</p>
                <div className="text-3xl font-bold text-[#111827]">
                  Rs. {Math.round(grandTotal).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-3 mt-8">
              <button
                onClick={() => handleCheckout(true)}
                disabled={isLoading || cart.length === 0}
                className="w-full btn-primary h-12 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />}
                FBR Reporting + Print (F5)
              </button>
              <button
                onClick={() => handleCheckout(false)}
                disabled={isLoading || cart.length === 0}
                className="w-full btn-secondary h-12 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                Internal Only (F8)
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Checkout Modal */}
      <Modal isOpen={isCheckoutModalOpen} onClose={() => !isLoading && setIsCheckoutModalOpen(false)} title="Confirm Payment">
        <div className="space-y-6">
          <div className="bg-[#F8FAFC] p-6 rounded-lg border border-[#E2E8F0] flex flex-col items-center justify-center text-center">
            <p className="text-[#4B5563] text-[11px] font-semibold uppercase mb-1">Grand Total</p>
            <p className="text-3xl font-bold text-[#111827]">Rs. {Math.round(grandTotal).toLocaleString()}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-[#4B5563] uppercase block mb-1">Amount Received (Cash)</label>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(Number(e.target.value))}
                className="premium-input w-full h-14 text-xl font-bold text-[#111827]"
                autoFocus
              />
            </div>

            <div className="flex justify-between items-center p-4 bg-[#E6F4EA] text-[#137333] rounded-lg border border-[#CEEAD6]">
              <span className="text-xs font-bold uppercase">Change Due</span>
              <span className="text-xl font-bold">Rs. {Math.max(0, amountReceived - Math.round(grandTotal)).toLocaleString()}</span>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              onClick={processPayment}
              disabled={isLoading || amountReceived < Math.round(grandTotal)}
              className="flex-1 btn-primary h-12 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              {isLoading ? 'Processing...' : 'Confirm & Complete'}
            </button>
            <button
              onClick={() => setIsCheckoutModalOpen(false)}
              disabled={isLoading}
              className="px-6 btn-secondary h-12 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
