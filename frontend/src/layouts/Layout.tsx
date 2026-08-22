import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils/helpers';
import {
  FiHome,
  FiFilePlus,
  FiList,
  FiInbox,
  FiUser,
  FiLogOut,
  FiMenu,
  FiX,
  FiChevronDown,
  FiSettings,
} from 'react-icons/fi';

const navigation = [
  { name: 'داشبورد', href: '/dashboard', icon: FiHome },
  { name: 'درخواست‌های خرید', href: '/purchase-requests', icon: FiList },
  { name: 'ثبت درخواست جدید', href: '/purchase-requests/create', icon: FiFilePlus },
  { name: 'در انتظار تایید من', href: '/pending-approvals', icon: FiInbox },
  { name: 'تنظیمات امضا', href: '/settings/signature', icon: FiSettings },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-secondary-50 flex">
      {/* Mobile sidebar overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 right-0 z-50 w-64 bg-white border-l border-secondary-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="منوی اصلی"
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-secondary-200">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="ماریناسان" 
                className="w-8 h-8 rounded-lg object-contain"
              />
              <span className="text-lg font-bold text-secondary-900">ماریناسان</span>
            </div>
            <button
              className="lg:hidden p-2 rounded-lg text-secondary-500 hover:bg-secondary-100"
              onClick={() => setSidebarOpen(false)}
              aria-label="بستن منو"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="منوی ناوبری">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'sidebar-link',
                    isActive && 'sidebar-link-active'
                  )
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-secondary-200">
            <div className="flex items-center gap-3">
              <div className="avatar-md">
                {user?.full_name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-900 truncate">
                  {user?.full_name}
                </p>
                <p className="text-xs text-secondary-500 truncate">
                  {user?.position}
                </p>
              </div>
              <button
                className="p-1.5 rounded-lg text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="منوی کاربر"
              >
                <FiChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* User Dropdown */}
            {userMenuOpen && (
              <div className="dropdown-menu mt-2" role="menu">
                <div className="px-4 py-2 border-b border-secondary-200">
                  <p className="text-xs text-secondary-500">شماره پرسنلی: {user?.personnel_number}</p>
                </div>
                <NavLink
                  to="/settings/signature"
                  role="menuitem"
                  className="dropdown-item flex items-center gap-2 w-full"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <FiSettings className="w-4 h-4" aria-hidden="true" />
                  تنظیمات امضا
                </NavLink>
                <button
                  role="menuitem"
                  className="dropdown-item flex items-center gap-2 w-full"
                  onClick={handleLogout}
                >
                  <FiLogOut className="w-4 h-4" aria-hidden="true" />
                  خروج از سیستم
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-secondary-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden p-2 rounded-lg text-secondary-500 hover:bg-secondary-100"
                onClick={() => setSidebarOpen(true)}
                aria-label="باز کردن منو"
              >
                <FiMenu className="w-6 h-6" />
              </button>
              <img 
                src="/logo.png" 
                alt="ماریناسان" 
                className="w-8 h-8 rounded-lg object-contain hidden lg:block"
              />
              <h1 className="text-xl font-bold text-secondary-900 lg:text-2xl">
                {navigation.find(n => location.pathname.startsWith(n.href))?.name || 'ماریناسان'}
              </h1>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}