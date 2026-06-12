import { useState, useEffect } from 'react';
import {
  FileText,
  CalendarDays,
  Activity,
  Download,
  RefreshCw,
  TrendingUp,
  Percent,
} from 'lucide-react';

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
  purchase_price?: string | number;
}

interface SaleDetails extends SaleSummary {
  items: SaleItem[];
}

export default function Reports() {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [dailyBills, setDailyBills] = useState<SaleSummary[]>([]);
  const [selectedBill, setSelectedBill] = useState<SaleSummary | null>(null);
  const [selectedBillDetails, setSelectedBillDetails] = useState<SaleDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBillDetailsLoading, setIsBillDetailsLoading] = useState(false);

  useEffect(() => {
    fetchReport();
    setSelectedBill(null);
    setSelectedBillDetails(null);
  }, [reportDate]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Daily KPI summaries
      const resKpi = await (window as any).electronAPI.dbQuery('dashboard:getFinancialReport', {
        startDate: `${reportDate} 00:00:00`,
        endDate: `${reportDate} 23:59:59`
      });
      if (resKpi.success && resKpi.data.length > 0) {
        setReportData(resKpi.data[0]);
      } else {
        setReportData({
          gross_sales: 0,
          total_tax: 0,
          total_discount: 0,
          total_returns: 0,
          net_sales: 0,
          total_sales_count: 0,
          returns_count: 0,
          fbr_sales_count: 0,
          internal_sales_count: 0,
          total_profit: 0
        });
      }

      // 2. Fetch all sales bills for that day
      const resBills = await (window as any).electronAPI.dbQuery('sales:getAll', {
        startDate: `${reportDate} 00:00:00`,
        endDate: `${reportDate} 23:59:59`
      });
      if (resBills.success) {
        setDailyBills(resBills.data);
      } else {
        setDailyBills([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBillDetails = async (billId: number) => {
    setIsBillDetailsLoading(true);
    try {
      const res = await (window as any).electronAPI.dbQuery('sales:getById', { id: billId });
      if (res.success) {
        setSelectedBillDetails(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBillDetailsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!reportData) return;
    
    // Construct CSV text matching WPF C# format
    const lines = [
      "Metric,Value",
      `Report Date,${reportDate}`,
      `Gross Sales,${Number(reportData.gross_sales).toFixed(2)}`,
      `Total Returns,${Number(reportData.total_returns).toFixed(2)}`,
      `Net Sales,${Number(reportData.net_sales).toFixed(2)}`,
      `Total Tax,${Number(reportData.total_tax).toFixed(2)}`,
      `Total Discount,${Number(reportData.total_discount).toFixed(2)}`,
      `Total Sales Count,${reportData.total_sales_count}`,
      `FBR Sales Count,${reportData.fbr_sales_count || 0}`,
      `Internal Sales Count,${reportData.internal_sales_count || 0}`,
      `Returns Count,${reportData.returns_count || 0}`,
      `Total Profit,${Number(reportData.total_profit).toFixed(2)}`
    ];
    
    const csvContent = lines.join("\n");
    const res = await (window as any).electronAPI.exportCSV(`Z_Report_${reportDate}.csv`, csvContent);
    if (res.success) {
      alert(`Success: Report exported successfully to:\n${res.filePath}`);
    } else if (res.message !== 'Export cancelled.') {
      alert(`Export Error: ${res.message}`);
    }
  };

  const formatTimeString = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Summary totals for selected bill details
  const billGrandTotal = selectedBillDetails
    ? selectedBillDetails.items.reduce((sum, item) => {
      const netQty = item.quantity - item.returned_qty;
      return sum + (netQty * parseFloat(item.unit_price.toString()));
    }, 0)
    : 0;

  const billTotalProfit = selectedBillDetails
    ? selectedBillDetails.items.reduce((sum, item) => {
      const netQty = item.quantity - item.returned_qty;
      const unitPrice = parseFloat(item.unit_price.toString());
      const purchasePrice = parseFloat(item.purchase_price?.toString() || '0');
      return sum + (netQty * (unitPrice - purchasePrice));
    }, 0)
    : 0;

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] overflow-hidden animate-fade-in">

      {/* Top Header Block with linear gradient styling */}
      <div className="bg-linear-to-r from-[#00D2FF] to-[#3a7bd5] px-[40px] py-[24px] flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-5">
          <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <FileText className="text-[#3a7bd5]" size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-white tracking-tight">Z-Report Financials</h1>
            <span className="text-xs text-slate-100 font-medium opacity-90">Daily Z-Report auditing summary, invoice lists, and net profit analysis.</span>
          </div>
        </div>

        {/* Date Selector & Export Actions */}
        <div className="flex items-center gap-4 select-none">
          <div className="bg-white/10 border border-white/20 rounded-lg p-1 flex items-center shrink-0">
            <CalendarDays className="ml-2 text-white" size={16} />
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="bg-transparent text-white px-2 py-1 text-xs font-bold outline-none focus:ring-0 cursor-pointer"
            />
          </div>
          <button
            onClick={handleExportCSV}
            disabled={!reportData}
            className="h-8 px-4 bg-white text-slate-900 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none border-0 disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
          <RefreshCw className="animate-spin text-[#00D2FF]" size={48} />
          <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Calculating Z-Report Financials...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col px-[40px] py-[24px] gap-6 overflow-hidden min-h-0">

          {/* KPI Cards Row */}
          {reportData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">

              {/* Daily Sales Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-[#E6F4EA] rounded-lg flex items-center justify-center shrink-0">
                  <TrendingUp className="text-[#16A34A]" size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold text-[#718096]">Daily Sales</span>
                  <span className="text-xl font-bold text-[#111827] mt-0.5 truncate">
                    Rs. {parseFloat(reportData.net_sales.toString()).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Daily Earnings (Profit) Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-[#EFF6FF] rounded-lg flex items-center justify-center shrink-0">
                  <Percent className="text-[#2563EB]" size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold text-[#718096]">Daily Earning (Profit)</span>
                  <span className="text-xl font-bold text-[#2563EB] mt-0.5 truncate">
                    Rs. {parseFloat(reportData.total_profit.toString()).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Total Daily Bills Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-[#F3F4F6] rounded-lg flex items-center justify-center shrink-0">
                  <Activity className="text-[#4B5563]" size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold text-[#718096]">Daily Bill Numbers</span>
                  <span className="text-xl font-bold text-[#111827] mt-0.5 truncate">
                    {reportData.total_sales_count} Bills
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* Master Detail Section */}
          <div className="flex-1 flex gap-6 overflow-hidden min-h-0">

            {/* Left Column: Bills list */}
            <div className="w-[450px] bg-white border border-[#E2E8F0] rounded-xl flex flex-col overflow-hidden shadow-sm shrink-0">
              <div className="bg-[#F7FAFC] px-4 py-3 border-b border-[#E2E8F0] shrink-0 select-none">
                <span className="text-sm font-bold text-[#4A5568]">Bills</span>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar bg-white divide-y divide-[#F1F5F9]">
                {dailyBills.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-slate-400 text-xs italic select-none">
                    No bills generated on this date.
                  </div>
                ) : (
                  dailyBills.map((bill) => (
                    <div
                      key={bill.id}
                      onClick={() => {
                        setSelectedBill(bill);
                        loadBillDetails(bill.id);
                      }}
                      className={`p-4 flex items-center justify-between cursor-pointer border-b border-[#F1F5F9] transition-colors ${selectedBill?.id === bill.id ? 'bg-[#00D2FF]/5 border-l-4 border-l-[#00D2FF] pl-3' : 'hover:bg-slate-50/50'
                        }`}
                    >
                      <div className="grow min-w-0 pr-3">
                        <div className="font-bold text-[#111827] text-sm truncate">{bill.bill_no}</div>
                        <div className="text-xs text-[#718096] truncate mt-0.5">{bill.customer_name || 'Walking Customer'}</div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="font-bold text-sm text-[#16A34A]">
                          Rs. {parseFloat(bill.grand_total.toString()).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF] mt-0.5">
                          {formatTimeString(bill.sale_date)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Selected Bill Details */}
            <div className="flex-1 bg-white border border-[#E2E8F0] rounded-xl flex flex-col overflow-hidden shadow-sm">
              <div className="bg-[#F7FAFC] px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold text-[#111827] uppercase tracking-wider">Bill Details</h2>
                  {selectedBill && (
                    <span className="text-xs font-semibold text-[#64748B]">{selectedBill.bill_no}</span>
                  )}
                </div>
                {selectedBillDetails && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {selectedBillDetails.status}
                  </span>
                )}
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                {!selectedBill ? (
                  <div className="grow flex flex-col items-center justify-center py-24 text-slate-300 select-none">
                    <FileText size={64} className="opacity-15 mb-3" />
                    <span className="text-sm font-semibold text-slate-400">Select a bill to view details</span>
                  </div>
                ) : isBillDetailsLoading ? (
                  <div className="grow flex flex-col items-center justify-center py-24 text-slate-400 text-sm select-none">
                    <RefreshCw className="animate-spin mr-2" size={16} /> Loading bill details...
                  </div>
                ) : selectedBillDetails ? (
                  <>
                    {/* Item Grid Header */}
                    <div className="bg-[#F9FAFB] border-b border-[#E2E8F0] px-5 py-3 grid grid-cols-[3fr_1fr_1.5fr_1.5fr_1.5fr_1.5fr] gap-2 text-[11px] font-bold text-[#64748B] shrink-0 select-none">
                      <div>Item</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">S.Price</div>
                      <div className="text-right">Subtotal</div>
                      <div className="text-right">P.Price</div>
                      <div className="text-right">Profit</div>
                    </div>

                    {/* Items Table List */}
                    <div className="flex-1 overflow-auto custom-scrollbar divide-y divide-[#F1F5F9]">
                      {selectedBillDetails.items.map((item) => {
                        const netQty = item.quantity - item.returned_qty;
                        const unitPrice = parseFloat(item.unit_price.toString());
                        const netSubtotal = netQty * unitPrice;
                        const purchasePrice = parseFloat((item as any).purchase_price?.toString() || '0');
                        const profit = netSubtotal - (netQty * purchasePrice);

                        return (
                          <div key={item.id} className="px-5 py-3 grid grid-cols-[3fr_1fr_1.5fr_1.5fr_1.5fr_1.5fr] gap-2 text-xs items-center hover:bg-slate-50/50 transition-colors">
                            <div className="font-semibold text-[#111827] truncate pr-2" title={item.medicine_name}>
                              {item.medicine_name}
                            </div>
                            <div className="text-right text-[#4A5568]">{netQty}</div>
                            <div className="text-right text-[#4A5568]">
                              Rs. {unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-right font-bold text-[#111827]">
                              Rs. {netSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-right text-[#9CA3AF]">
                              Rs. {purchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-right font-black text-blue-600">
                              Rs. {profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary Footer */}
                    <div className="pt-4 border-t border-[#E2E8F0] px-5 py-4 bg-[#F8FAFC] shrink-0">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-[#64748B]">Total Amount</span>
                          <span className="text-lg font-bold text-[#111827]">
                            Rs. {billGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <span className="text-[11px] font-semibold text-[#64748B]">Total Profit</span>
                          <span className="text-xl font-black text-blue-600">
                            Rs. {billTotalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grow flex flex-col items-center justify-center py-24 text-slate-400 text-xs italic select-none">
                    Failed to load details.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
