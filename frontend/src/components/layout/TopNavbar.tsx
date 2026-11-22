import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Menu, UploadCloud, LogOut } from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';
import { useDocuments } from '../../contexts/DocumentContext';
import { useAuth } from '../../contexts/AuthContext';

interface TopNavbarProps {
  onOpenSidebar: () => void;
}

const pageTitles: Record<string, string> = {
  '/': 'VMS - Voter Management System',
  '/voter-verification': 'Voter Verification',
  '/verify': 'Voter Verification',
  '/admin/dashboard': 'VMS Admin Dashboard',
  '/user/dashboard': 'VMS Dashboard',
  '/admin/users': 'User Management & Permissions',
  '/profile': 'My Profile & Security',
  '/upload': 'Upload Voter Document',
  '/documents': 'All Uploaded Documents',
  '/extracted-data': 'Voter Records',
  '/voter-entries': 'Voter Search',
  '/voter-search': 'Voter Search',
  '/payments': 'Payments Dashboard',
  '/admin/wallets': 'Admin Wallet Hub & Treasury',
  '/wallets': 'Admin Wallet Hub & Treasury',
  '/my-wallet': 'Spend on Voter & Field Disbursal',
  '/settings': 'Application Settings',
  '/constituency-management': 'Constituency & Ward Management',
  '/ward-management': 'Constituency & Ward Management',
  '/user-assignments': 'User Geographic Assignments',
  '/reports': 'Reports & Data Export',
};

export const TopNavbar: React.FC<TopNavbarProps> = ({ onOpenSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { backendOnline, activeDoc } = useDocuments();
  const { user, isAuthenticated, isSuperAdmin, isAdmin, isUser, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const title = isUser ? 'Voter Verification' : (pageTitles[location.pathname] || 'VMS');

  return (
    <header className="h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      {/* Left section: Hamburger (Admin only) and Page Title */}
      <div className="flex items-center gap-3">
        {!isUser && (
          <button
            onClick={onOpenSidebar}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {title}
          </h2>
          {!isUser && activeDoc && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md hidden sm:block">
              Current: <span className="font-medium text-slate-700 dark:text-slate-300">{activeDoc.metadata?.filename}</span>
            </p>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Backend Status indicator */}
        <div
          title={backendOnline ? 'Backend API Connected (http://127.0.0.1:8000)' : 'Backend API Offline'}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
            backendOnline
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
          <span>{backendOnline ? 'API Connected' : 'API Offline'}</span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Quick Upload Button (Admin & Super Admin only) */}
        {location.pathname !== '/upload' && (isSuperAdmin || isAdmin) && (
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload PDF</span>
          </button>
        )}

        {/* User Pill / Login Link */}
        {isAuthenticated && user ? (
          isUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <div className="w-6 h-6 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {user.full_name?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {user.full_name?.split(' ')[0] || user.username}
                  </span>
                  <span className="block text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400 leading-none">
                    Field User
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <Link
                to="/profile"
                className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                title="View Profile & Settings"
              >
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {user.full_name?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {user.full_name?.split(' ')[0] || user.username}
                  </span>
                  <span
                    className={`block text-[10px] font-bold uppercase leading-none ${
                      isSuperAdmin
                        ? 'text-rose-600 dark:text-rose-400'
                        : isAdmin
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              </Link>
            </div>
          )
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
