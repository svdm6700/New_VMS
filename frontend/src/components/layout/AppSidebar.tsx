import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  FolderOpen,
  BookOpen,
  TableProperties,
  FileText,
  Table2,
  ScanEye,
  Settings,
  Languages,
  X,
  User,
  Users,
  LogOut,
  Shield,
  LogIn
} from 'lucide-react';
import { useDocuments } from '../../contexts/DocumentContext';
import { useAuth } from '../../contexts/AuthContext';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ isOpen, onClose }) => {
  const { activeDoc } = useDocuments();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    onClose();
  };

  const dashboardPath = isAuthenticated
    ? isAdmin
      ? '/admin/dashboard'
      : '/user/dashboard'
    : '/';

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
            <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-brand-500/20 font-bold text-xs tracking-wider">
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

        {/* Active Document Pill (if selected) */}
        {activeDoc && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-900/50">
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
              {activeDoc.metadata?.page_count || activeDoc.pages?.length || 0} pages · Ready
            </p>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {/* Role-based Dashboard */}
          <NavLink
            to={dashboardPath}
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>{isAdmin ? 'VMS Admin Dashboard' : 'VMS Dashboard'}</span>
          </NavLink>

          {/* Admin User Management */}
          {isAdmin && (
            <NavLink
              to="/admin/users"
              onClick={() => onClose()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <Users className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
              <span>User Management</span>
            </NavLink>
          )}

          <NavLink
            to="/upload"
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <UploadCloud className="w-4 h-4 shrink-0" />
            <span>Upload Voter Document</span>
          </NavLink>

          <NavLink
            to="/extracted-data"
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <TableProperties className="w-4 h-4 shrink-0" />
            <span>Voter Records</span>
          </NavLink>

          <NavLink
            to="/documents"
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span>Document Management</span>
          </NavLink>

          <NavLink
            to="/reader"
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>PDF Reader</span>
          </NavLink>

          <NavLink
            to="/text"
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Extracted Text</span>
          </NavLink>

          <NavLink
            to="/tables"
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <Table2 className="w-4 h-4 shrink-0" />
            <span>Tables</span>
          </NavLink>

          <NavLink
            to="/ocr"
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <ScanEye className="w-4 h-4 shrink-0" />
            <span>OCR Results</span>
          </NavLink>

          <NavLink
            to="/settings"
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Settings</span>
          </NavLink>
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
                        user.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
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
