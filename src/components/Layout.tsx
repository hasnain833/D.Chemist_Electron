import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  Settings,
  LogOut,
  User,
  Layers,
  History,
  Search
} from 'lucide-react';
import { useAuth } from '../AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/billing', label: 'Sales/Billing', icon: ShoppingCart },
  { path: '/inventory', label: 'Medicine List', icon: Search },
  { path: '/stock-in', label: 'Add Stock', icon: Package },
  { path: '/adjustment', label: 'Stock Adjustment', icon: Layers },
  { path: '/audit', label: 'Audit Logs', icon: History },
  { path: '/financials', label: 'Financials', icon: FileText },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 font-inter overflow-hidden">
      {/* Dynamic Collapsible Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`bg-[#00167a] flex flex-col shadow-xl z-50 transition-all duration-300 ease-in-out h-full ${isHovered ? 'w-64' : 'w-20'}`}
      >
        <div className="p-4 flex justify-center border-b border-white/10">
          <div className={`transition-all duration-300 ${isHovered ? 'h-16' : 'h-10'}`}>
            <img src="/logo.png" alt="Logo" className="h-full object-contain filter brightness-0 invert" />
          </div>
        </div>

        <nav className="flex-1 px-3 py-10 space-y-10">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 border-b-2 border-white rounded-lg transition-all text-xs font-bold whitespace-nowrap overflow-hidden ${isActive
                  ? 'bg-white text-[#00167a]'
                  : 'text-blue-100 hover:bg-white/10'
                }`
              }
            >
              <item.icon size={20} className="shrink-0" />
              <span className={`transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-4">
          <div className={`flex items-center gap-3 px-2 overflow-hidden`}>
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30 shrink-0">
              <User size={14} className="text-white" />
            </div>
            <div className={`flex-1 min-w-0 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              <p className="text-[10px] font-bold text-white truncate">{user?.fullName || 'User'}</p>
              <p className="text-[8px] text-blue-300 uppercase font-bold tracking-widest">{user?.role || 'Staff'}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-lg text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 text-[10px] font-bold transition-all border border-rose-500/20 uppercase tracking-widest overflow-hidden`}
          >
            <LogOut size={16} className="shrink-0" />
            <span className={`transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-auto p-8 bg-slate-50 custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
