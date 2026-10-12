import { Link, useLocation } from 'react-router-dom';
import { History as HistoryIcon, LayoutDashboard, LogOut } from 'lucide-react';
import Logo from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const navItem = (to, label, Icon) => (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        pathname === to ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo to="/dashboard" />
        <nav className="flex items-center gap-1">
          {navItem('/dashboard', 'Dashboard', LayoutDashboard)}
          {navItem('/history', 'History', HistoryIcon)}
        </nav>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              {user.avatarUrl && (
                <img src={user.avatarUrl} alt={user.username} className="h-9 w-9 rounded-full border border-white/10" />
              )}
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold text-white">{user.displayName || user.username}</p>
                <p className="text-xs text-slate-500">@{user.username}</p>
              </div>
            </div>
          )}
          <button type="button" onClick={logout} className="btn-ghost px-3 py-2" title="Log out">
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
