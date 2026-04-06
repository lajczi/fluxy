import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  LayoutDashboard,
  Server,
  BarChart3,
  Heart,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  Database,
} from 'lucide-react';
import { TelemetryNotice } from '../TelemetryNotice';

const navItems = [
  { path: '/guilds', label: 'Servers', icon: Server },
  { path: '/my-data', label: 'Your Data', icon: Database },
];

const ownerItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/health', label: 'Health', icon: Heart },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const allItems = [...navItems, ...(user?.isOwner ? ownerItems : [])];

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      {/* Sidebar */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-64 transform bg-[hsl(var(--card))] border-r border-[hsl(var(--border))]
        transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[hsl(var(--border))]">
          <img src="/bot-icon.png" alt="Fluxy" className="h-8 w-8 rounded-lg" />
          <span className="text-xl font-bold text-white">Fluxy</span>
          <button className="lg:hidden ml-auto" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {allItems.map((item) => {
            const active =
              location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${
                    active
                      ? 'bg-blue-500/10 text-blue-400 shadow-sm shadow-blue-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 active:scale-[0.98]'
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {active && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-[hsl(var(--border))]">
          <div className="flex items-center gap-3 px-3 py-2">
            {user?.avatar ? (
              <img
                src={`https://fluxerusercontent.com/avatars/${user.id}/${user.avatar}.png?size=64`}
                alt={user.username}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.username}</p>
              {user?.isOwner && <p className="text-xs text-blue-400">Owner</p>}
            </div>
            {/* Privacy control - owner only */}
            {user?.isOwner && (
              <button
                onClick={() => setPrivacyOpen(true)}
                className="text-gray-400 hover:text-blue-400 active:scale-90 transition-all duration-150"
                title="Telemetry & privacy"
              >
                <Shield className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-400 active:scale-90 transition-all duration-150"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6 text-gray-400" />
          </button>
          <img src="/bot-icon.png" alt="Fluxy" className="h-6 w-6 rounded-lg" />
          <span className="font-bold text-white">Fluxy</span>
        </div>

        <div className="p-6 lg:p-8">
          {/* Telemetry banner (first-visit only) + wires sidebar Privacy button to dialog */}
          <TelemetryNotice
            renderTrigger={(openDialog) => {
              // Sync sidebar button open state with TelemetryNotice-controlled dialog
              if (privacyOpen) {
                openDialog();
                setPrivacyOpen(false);
              }
              return null;
            }}
          />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
