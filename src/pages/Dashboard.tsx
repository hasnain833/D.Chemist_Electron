import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, ShoppingCart } from 'lucide-react';

export default function Dashboard() {
  const [lowStockList, setLowStockList] = useState<any[]>([]);
  const [expiringList, setExpiringList] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const [lowStockRes, expiringRes, recentSalesRes] = await Promise.all([
        (window as any).electronAPI.dbQuery('dashboard:getLowStock', { limit: 10 }),
        (window as any).electronAPI.dbQuery('dashboard:getExpiring', { limit: 10 }),
        (window as any).electronAPI.dbQuery('dashboard:getRecentSales', { limit: 10 })
      ]);
      
      if (lowStockRes.success) setLowStockList(lowStockRes.data);
      if (expiringRes.success) setExpiringList(expiringRes.data);
      if (recentSalesRes.success) setRecentSales(recentSalesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="h-full px-[60px] pt-[32px] overflow-y-auto animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Low Stock Items List */}
        <div className="premium-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-[#D93025]" size={18} />
            <h2 className="text-lg font-semibold text-[#111827]">Low Stock Items</h2>
          </div>
          
          <div className="flex flex-col">
            {lowStockList.map((item, index) => (
              <div key={index} className="py-2 border-b border-[#F1F5F9] last:border-0">
                <p className="font-medium text-[#111827]">{item.name}</p>
                <p className="text-xs text-[#D93025]">Stock: {item.stock_level}</p>
              </div>
            ))}
            
            {lowStockList.length === 0 && !isLoading && (
              <p className="text-sm text-[#4B5563] text-center mt-8">All items well stocked.</p>
            )}
          </div>
        </div>

        {/* Expiring Soon List */}
        <div className="premium-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Clock className="text-[#F9AB00]" size={18} />
            <h2 className="text-lg font-semibold text-[#111827]">Expiring Soon</h2>
          </div>
          
          <div className="flex flex-col">
            {expiringList.map((item, index) => (
              <div key={index} className="py-2 border-b border-[#F1F5F9] last:border-0">
                <p className="font-medium text-[#111827]">{item.name}</p>
                <p className="text-xs text-[#F9AB00]">
                  Expires: {new Date(item.expiry_date).toLocaleDateString()}
                </p>
              </div>
            ))}
            
            {expiringList.length === 0 && !isLoading && (
              <p className="text-sm text-[#4B5563] text-center mt-8">No imminent expiries.</p>
            )}
          </div>
        </div>

        {/* Recent Sales List */}
        <div className="premium-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-[#1E8E3E]" size={18} />
            <h2 className="text-lg font-semibold text-[#111827]">Recent Sales</h2>
          </div>
          
          <div className="flex flex-col">
            {recentSales.map((sale, index) => (
              <div key={index} className="py-2 border-b border-[#F1F5F9] last:border-0 flex justify-between items-center">
                <div>
                  <p className="font-medium text-[#111827]">#{sale.invoice_no}</p>
                  <p className="text-xs text-[#4B5563]">{new Date(sale.date).toLocaleDateString()}</p>
                </div>
                <p className="font-bold text-[#1E8E3E]">
                  Rs. {sale.total_amount?.toLocaleString()}
                </p>
              </div>
            ))}
            
            {recentSales.length === 0 && !isLoading && (
              <p className="text-sm text-[#4B5563] text-center mt-8">No recent sales to display.</p>
            )}
          </div>
        </div>

      </div>
      
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="w-12 h-12 border-4 border-[#00D2FF] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
