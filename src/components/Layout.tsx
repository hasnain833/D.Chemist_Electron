import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  Settings,
  LogOut,
  User,
  Search
} from 'lucide-react';
import { useAuth } from '../AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/billing', label: 'Sales/Billing', icon: ShoppingCart },
  { path: '/inventory', label: 'Medicine List', icon: Search },
  { path: '/stock-in', label: 'Add Stock', icon: Package },
  { path: '/purchase-history', label: 'Purchase History', icon: Package },
  { path: '/financials', label: 'Financials', icon: FileText },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-inter overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-[56px] bg-linear-to-r from-[#00D2FF] to-[#3a7bd5] text-white shadow-md flex items-center justify-between px-6 z-50 shrink-0 select-none">
        {/* Left: Pharmacy Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <img src="/logo.png" alt="Logo" className="h-8 object-contain filter brightness-0 invert" />
        </div>

        {/* Center: Navigation Links */}
        <nav className="flex items-center h-full gap-1 overflow-x-auto no-scrollbar py-1">
          {navItems
            .filter(item => {
              const isAdminOnly = ['/financials', '/reports', '/settings'].includes(item.path);
              return !isAdminOnly || user?.role === 'Admin';
            })
            .map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-xs font-bold whitespace-nowrap ${
                    isActive
                      ? 'bg-white/20 text-white shadow-xs'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon size={16} className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
        </nav>

        {/* Right: User profile and Logout */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 text-right">
            <div className="hidden md:block">
              <p className="text-[11px] font-bold leading-tight">{user?.fullName || 'User'}</p>
              <p className="text-[9px] text-sky-100/80 uppercase font-bold tracking-wider leading-none">{user?.role || 'Staff'}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/30 shrink-0">
              <User size={14} className="text-white" />
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 rounded-lg text-white/90 hover:bg-white/10 hover:text-white transition-all border border-white/10 hover:border-white/20 cursor-pointer flex items-center justify-center"
          >
            <LogOut size={16} className="shrink-0" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-auto p-6 bg-slate-50 custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

