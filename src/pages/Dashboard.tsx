import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Package, 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  ChevronRight, 
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Calendar,
  Clock
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    todaySalesTotal: 0,
    todaySalesCount: 0,
    monthlySalesTotal: 0,
    totalMedicines: 0,
    lowStockCount: 0,
    expiringSoonCount: 0
  });
  const [trend, setTrend] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStats = async () => {
    setIsRefreshing(true);
    try {
      const statsRes = await (window as any).electronAPI.dbQuery('dashboard:getStats');
      const trendRes = await (window as any).electronAPI.dbQuery('dashboard:getSalesTrend', { days: 14 });
      if (statsRes.success) setStats(statsRes.data);
      if (trendRes.success) setTrend(trendRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-12">
      {/* Premium Welcome Header */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -ml-32 -mb-32"></div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                <ShieldCheck className="text-blue-400" size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">System Live</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight">Welcome back, Administrator</h1>
            <p className="text-slate-400 text-sm max-w-md font-medium leading-relaxed">
              Your pharmacy is operating normally. You have <span className="text-rose-400 font-bold">{stats.lowStockCount} items</span> requiring immediate restock attention.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Time</p>
                <p className="text-2xl font-black font-mono tracking-tighter">
                  {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                </p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <button 
                onClick={fetchStats}
                className="p-4 bg-blue-600 hover:bg-blue-500 rounded-2xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 group"
              >
                <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
              </button>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <Calendar size={12} />
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Gross"
          value={`Rs. ${stats.todaySalesTotal.toLocaleString()}`}
          trend="+12.5%"
          desc={`${stats.todaySalesCount} Invoices generated`}
          icon={TrendingUp}
          theme="blue"
        />
        <StatCard
          title="Monthly Volume"
          value={`Rs. ${stats.monthlySalesTotal.toLocaleString()}`}
          trend="+5.2%"
          desc="Current month revenue"
          icon={ShoppingBag}
          theme="indigo"
        />
        <StatCard
          title="Critical Stock"
          value={stats.lowStockCount}
          trend="Action Required"
          desc="Items below threshold"
          icon={AlertTriangle}
          theme="rose"
        />
        <StatCard
          title="Expiring Soon"
          value={stats.expiringSoonCount}
          trend="90 Days"
          desc="Near expiry batches"
          icon={Package}
          theme="amber"
        />
      </div>

      {/* Main Grid: Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart Card */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col min-h-[450px]">
          <div className="flex items-center justify-between mb-10">
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 flex items-center gap-2 text-lg">
                <Activity size={20} className="text-blue-600" />
                Revenue Performance
              </h3>
              <p className="text-xs text-slate-400 font-medium tracking-wide">Daily sales trend for the last 14 days</p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full">LIVE DATA</span>
            </div>
          </div>

          <div className="flex-1 flex items-end justify-between gap-3 px-2">
            {trend.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                <div
                  className="w-full bg-slate-50 rounded-2xl hover:bg-blue-600 transition-all duration-500 cursor-pointer relative"
                  style={{ height: `${Math.max(10, (item.total / (Math.max(...trend.map(t => t.total)) || 1)) * 100)}%` }}
                >
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black py-2 px-3 rounded-xl opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10 transition-all -translate-y-2 group-hover:translate-y-0">
                    Rs. {parseFloat(item.total).toLocaleString()}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-300 uppercase group-hover:text-blue-600 transition-colors">
                  {i === trend.length - 1 ? 'Today' : `D-${trend.length - 1 - i}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Summary Card */}
        <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
          
          <h3 className="font-black text-lg mb-10 flex items-center gap-3 relative z-10">
            <Zap size={20} className="text-blue-400" />
            Inventory Health
          </h3>
          
          <div className="space-y-8 relative z-10 flex-1">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Catalogue Size</span>
                <span className="text-white">{stats.totalMedicines} SKU</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[75%]" />
              </div>
            </div>

            <div className="space-y-6">
              <InventoryMetric label="Low Stock Items" value={stats.lowStockCount} color="text-rose-400" bg="bg-rose-400/10" />
              <InventoryMetric label="Upcoming Expiry" value={stats.expiringSoonCount} color="text-amber-400" bg="bg-amber-400/10" />
              <InventoryMetric label="Active Batches" value={Math.floor(stats.totalMedicines * 1.4)} color="text-emerald-400" bg="bg-emerald-400/10" />
            </div>
          </div>

          <button className="mt-10 w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 relative z-10">
            Review Stock <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, desc, icon: Icon, theme }: any) {
  const themes: any = {
    blue: 'bg-white text-slate-900 border-slate-200 icon-bg-blue-50 icon-color-blue-600',
    indigo: 'bg-white text-slate-900 border-slate-200 icon-bg-indigo-50 icon-color-indigo-600',
    rose: 'bg-white text-slate-900 border-slate-200 icon-bg-rose-50 icon-color-rose-600',
    amber: 'bg-white text-slate-900 border-slate-200 icon-bg-amber-50 icon-color-amber-600',
  };

  const iconColors: any = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl transition-transform group-hover:scale-110 duration-500 ${iconColors[theme]}`}>
          <Icon size={24} />
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${
          theme === 'rose' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
        }`}>
          {theme === 'rose' ? <AlertTriangle size={12} /> : <ArrowUpRight size={12} />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black tracking-tight text-slate-900">{value}</h3>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] font-medium text-slate-400">{desc}</p>
          <ChevronRight size={14} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
        </div>
      </div>
    </div>
  );
}

function InventoryMetric({ label, value, color, bg }: any) {
  return (
    <div className={`p-4 rounded-2xl ${bg} border border-white/5 flex items-center justify-between`}>
      <span className="text-[10px] font-black uppercase tracking-widest text-white/60">{label}</span>
      <span className={`text-lg font-black ${color}`}>{value}</span>
    </div>
  );
}
