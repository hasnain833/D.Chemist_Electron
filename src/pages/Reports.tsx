import { useState, useEffect } from 'react';
import { 
  FileText, 
  CalendarDays, 
  Activity, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  RotateCcw, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronRight,
  TrendingDown,
  Percent,
  Receipt
} from 'lucide-react';

export default function Reports() {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [reportDate]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const res = await (window as any).electronAPI.dbQuery('dashboard:getFinancialReport', { startDate: reportDate, endDate: reportDate });
      if (res.success && res.data.length > 0) {
        setReportData(res.data[0]);
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
          internal_sales_count: 0
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData) return;
    const headers = ['Date', 'Total Bills', 'Gross Sales', 'Returns', 'Net Sales', 'Tax', 'Discounts'];
    const values = [reportDate, reportData.total_sales_count, reportData.gross_sales, reportData.total_returns, reportData.net_sales, reportData.total_tax, reportData.total_discount];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + values.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Z_Report_${reportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-12">
      {/* Premium Header Section */}
      <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-slate-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                <FileText className="text-blue-400" size={24} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Daily Z-Report</h1>
            </div>
            <p className="text-slate-400 text-sm max-w-md">Comprehensive financial summary for sales, taxes, and compliance metrics.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-1.5 flex items-center">
              <CalendarDays className="ml-3 text-slate-400" size={18} />
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="bg-transparent text-white px-3 py-2 text-sm font-bold outline-none focus:ring-0"
              />
            </div>
            <button 
              onClick={handleExportCSV}
              className="bg-white text-slate-900 px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-slate-100 transition-all shadow-lg active:scale-95"
            >
              <Download size={18} />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-4">
          <RefreshCw className="animate-spin text-blue-500" size={48} />
          <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Calculating Financials...</p>
        </div>
      ) : reportData && (
        <div className="space-y-8">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Gross Revenue */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                  <TrendingUp size={24} />
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-lg">
                  <ArrowUpRight size={14} />
                  Live
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Gross Sales</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">Rs. {Number(reportData.gross_sales).toLocaleString()}</h3>
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Total Invoices</span>
                <span className="text-slate-800">{reportData.total_sales_count}</span>
              </div>
            </div>

            {/* Total Returns */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 group-hover:scale-110 transition-transform">
                  <RotateCcw size={24} />
                </div>
                <div className="flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 px-2 py-1 rounded-lg">
                  <TrendingDown size={14} />
                  Adjusted
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Returns</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">Rs. {Number(reportData.total_returns).toLocaleString()}</h3>
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Return Events</span>
                <span className="text-rose-600">{reportData.returns_count}</span>
              </div>
            </div>

            {/* Net Revenue */}
            <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-100 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-3 bg-white/20 rounded-2xl text-white group-hover:scale-110 transition-transform">
                  <Activity size={24} />
                </div>
                <span className="px-2 py-1 bg-white/20 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest">Final Net</span>
              </div>
              <p className="text-xs font-bold text-indigo-100 uppercase tracking-widest mb-1 relative z-10">Net Daily Revenue</p>
              <h3 className="text-3xl font-black text-white tracking-tight relative z-10">Rs. {Number(reportData.net_sales).toLocaleString()}</h3>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-bold text-indigo-100 relative z-10">
                <span>Real-time Settlement</span>
                <ChevronRight size={14} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Tax & Discount Breakdown */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Percent className="text-blue-600" size={20} />
                Tax & Discounts
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <Receipt size={16} />
                    </div>
                    <span className="text-sm font-bold text-slate-600">Tax Collected</span>
                  </div>
                  <span className="text-lg font-black text-slate-800">Rs. {Number(reportData.total_tax).toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                      <Percent size={16} />
                    </div>
                    <span className="text-sm font-bold text-slate-600">Discounts Given</span>
                  </div>
                  <span className="text-lg font-black text-amber-600">Rs. {Number(reportData.total_discount).toLocaleString()}</span>
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-3">
                <Activity className="text-blue-500 shrink-0 mt-1" size={16} />
                <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                  Financial figures represent processed and confirmed transactions only. Voided invoices are excluded from these calculations.
                </p>
              </div>
            </div>

            {/* FBR Compliance Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="text-indigo-600" size={20} />
                  Tax Compliance
                </h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FBR Pakistan</span>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reported to FBR</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-indigo-600">{reportData.fbr_sales_count}</span>
                    <span className="text-[10px] font-bold text-slate-400">Bills</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${(reportData.fbr_sales_count / (reportData.total_sales_count || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Internal Only</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-400">{reportData.internal_sales_count}</span>
                    <span className="text-[10px] font-bold text-slate-400">Bills</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-slate-400 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${(reportData.internal_sales_count / (reportData.total_sales_count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 border border-indigo-100 rounded-2xl bg-indigo-50/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                  <span className="text-xs font-bold text-indigo-900">Compliance Rate</span>
                </div>
                <span className="text-lg font-black text-indigo-600">
                  {Math.round((reportData.fbr_sales_count / (reportData.total_sales_count || 1)) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
