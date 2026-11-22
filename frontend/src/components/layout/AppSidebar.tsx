import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  Files,
  TableProperties,
  CreditCard,
  Receipt,
  Wallet,
  Settings,
  X,
  User,
  Users,
  LogOut,
  Shield,
  LogIn,
  Building2,
  Layers,
  UserCheck,
  FileSpreadsheet,
  Search,
  FileText
} from 'lucide-react';
import { useDocuments } from '../../contexts/DocumentContext';
import { useAuth } from '../../contexts/AuthContext';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ isOpen, onClose }) => {
  const { activeDoc } = useDocuments();
  const { user, isAuthenticated, isSuperAdmin, isAdmin, isUser, logout } = useAuth();
  const navigate = useNavigate();

  // Single Screen User Access: Never render sidebar navigation for User role
  if (isUser) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    onClose();
  };

  const dashboardPath = isAuthenticated
    ? isUser
      ? '/user/dashboard'
      : '/admin/dashboard'
    : '/';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
      isActive
        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
    }`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header / Brand */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-brand-500/20 font-bold text-xs tracking-wider">
              VMS
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
                VMS
              </h1>
              <span className="text-[10px] text-slate-400 font-medium font-telugu">ఓటర్ మేనేజ్‌మెంట్ సిస్టమ్</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Badge Indicator */}
        {isAuthenticated && user && (
          <div className="mx-4 mt-3 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
            <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold">Role Access</span>
            <span
              className={`px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider ${
                isSuperAdmin
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : isAdmin
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Field User'}
            </span>
          </div>
        )}

        {/* Active Document Pill (for Admin / Super Admin) */}
        {!isUser && activeDoc && (
          <div className="mx-4 mt-2 p-2.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-900/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse" />
              <span className="text-[10px] font-semibold tracking-wider text-brand-700 dark:text-brand-300 uppercase">
                Active Document
              </span>
            </div>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
              {activeDoc.metadata?.filename || 'Document'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {activeDoc.metadata?.records_count || activeDoc.records?.length || 0} voters · Ready
            </p>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {/* ========================================================= */}
          {/* 1. SUPER ADMIN SIDEBAR */}
          {/* ========================================================= */}
          {isSuperAdmin && (
            <>
              <NavLink to="/admin/dashboard" onClick={onClose} className={navLinkClass}>
                <LayoutDashboard className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink to="/upload" onClick={onClose} className={navLinkClass}>
                <UploadCloud className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span>Upload Voter Documents</span>
              </NavLink>

              <NavLink to="/documents" onClick={onClose} className={navLinkClass}>
                <Files className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>All Documents</span>
              </NavLink>

              <NavLink to="/extracted-data" onClick={onClose} className={navLinkClass}>
                <TableProperties className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400" />
                <span>Voter Records</span>
              </NavLink>

              <NavLink to="/voter-entries" onClick={onClose} className={navLinkClass}>
                <CreditCard className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Voter Entry Management</span>
              </NavLink>

              <NavLink to="/payments" onClick={onClose} className={navLinkClass}>
                <Receipt className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Payments Dashboard</span>
              </NavLink>

              <NavLink to="/admin/users" onClick={onClose} className={navLinkClass}>
                <Users className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
                <span>User Management</span>
              </NavLink>

              <NavLink to="/admin/users?tab=roles" onClick={onClose} className={navLinkClass}>
                <Shield className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>Roles & Permissions</span>
              </NavLink>

              <NavLink to="/constituency-management" onClick={onClose} className={navLinkClass}>
                <Building2 className="w-4 h-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                <span>Constituencies & Wards</span>
              </NavLink>

              <NavLink to="/user-assignments" onClick={onClose} className={navLinkClass}>
                <UserCheck className="w-4 h-4 shrink-0 text-violet-600 dark:text-violet-400" />
                <span>User Assignments</span>
              </NavLink>

              <NavLink to="/admin/wallets" onClick={onClose} className={navLinkClass}>
                <Wallet className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Wallet Management</span>
              </NavLink>

              <NavLink to="/reports" onClick={onClose} className={navLinkClass}>
                <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Reports & Export</span>
              </NavLink>

              <NavLink to="/settings" onClick={onClose} className={navLinkClass}>
                <Settings className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                <span>Settings</span>
              </NavLink>
            </>
          )}

          {/* ========================================================= */}
          {/* 2. ADMIN SIDEBAR */}
          {/* ========================================================= */}
          {isAdmin && !isSuperAdmin && (
            <>
              <NavLink to="/admin/dashboard" onClick={onClose} className={navLinkClass}>
                <LayoutDashboard className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink to="/upload" onClick={onClose} className={navLinkClass}>
                <UploadCloud className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span>Upload Voter Documents</span>
              </NavLink>

              <NavLink to="/documents" onClick={onClose} className={navLinkClass}>
                <Files className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>All Documents</span>
              </NavLink>

              <NavLink to="/extracted-data" onClick={onClose} className={navLinkClass}>
                <TableProperties className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400" />
                <span>Voter Records</span>
              </NavLink>

              <NavLink to="/voter-entries" onClick={onClose} className={navLinkClass}>
                <CreditCard className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Voter Entry Management</span>
              </NavLink>

              <NavLink to="/payments" onClick={onClose} className={navLinkClass}>
                <Receipt className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Payments Dashboard</span>
              </NavLink>

              <NavLink to="/admin/users" onClick={onClose} className={navLinkClass}>
                <Users className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
                <span>User Management</span>
              </NavLink>

              <NavLink to="/user-assignments" onClick={onClose} className={navLinkClass}>
                <UserCheck className="w-4 h-4 shrink-0 text-violet-600 dark:text-violet-400" />
                <span>User Assignments</span>
              </NavLink>

              <NavLink to="/admin/wallets" onClick={onClose} className={navLinkClass}>
                <Wallet className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Wallet Management</span>
              </NavLink>

              <NavLink to="/reports" onClick={onClose} className={navLinkClass}>
                <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Reports & Export</span>
              </NavLink>
            </>
          )}

          {/* ========================================================= */}
          {/* 3. STANDARD USER SIDEBAR */}
          {/* ========================================================= */}
          {isUser && (
            <>
              <NavLink to="/user/dashboard" onClick={onClose} className={navLinkClass}>
                <LayoutDashboard className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink to="/extracted-data" onClick={onClose} className={navLinkClass}>
                <TableProperties className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400" />
                <span>Assigned Voters</span>
              </NavLink>

              <NavLink to="/extracted-data?focus=search" onClick={onClose} className={navLinkClass}>
                <Search className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>Voter Search</span>
              </NavLink>

              <NavLink to="/extracted-data?view=details" onClick={onClose} className={navLinkClass}>
                <FileText className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span>Voter Details</span>
              </NavLink>

              <NavLink to="/voter-entries" onClick={onClose} className={navLinkClass}>
                <CreditCard className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Voter Amount Assignment</span>
              </NavLink>

              <NavLink to="/my-wallet" onClick={onClose} className={navLinkClass}>
                <Wallet className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>My Wallet</span>
              </NavLink>

              <NavLink to="/my-wallet?tab=transactions" onClick={onClose} className={navLinkClass}>
                <Receipt className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>My Transactions</span>
              </NavLink>

              <NavLink to="/profile" onClick={onClose} className={navLinkClass}>
                <User className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
                <span>My Profile</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Bottom User Profile Section */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {isAuthenticated && user ? (
            <div className="space-y-2">
              <NavLink
                to="/profile"
                onClick={() => onClose()}
                className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {user.full_name?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {user.full_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span
                      className={`px-1 rounded text-[9px] font-bold uppercase ${
                        isSuperAdmin
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : isAdmin
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {user.role}
                    </span>
                    <span className="truncate">@{user.username}</span>
                  </div>
                </div>
              </NavLink>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              onClick={() => onClose()}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
};
