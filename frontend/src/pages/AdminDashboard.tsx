import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FileText,
  Database,
  UserCheck,
  UserPlus,
  Upload,
  ArrowRight,
  Shield,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { documentService } from '../services/documentService';
import { User } from '../types/auth';
import { DocumentItem } from '../types/document';
import { formatBytes } from '../utils/formatters';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [usersRes, docsRes, recordsRes] = await Promise.allSettled([
          authService.getUsers({ limit: 5 }),
          documentService.getDocuments({ limit: 5 }),
          documentService.getVoterRecords({ limit: 1 }),
        ]);

        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value.users || []);
          setTotalUsers(usersRes.value.total || 0);
          const activeCount = (usersRes.value.users || []).filter((u: User) => u.is_active).length;
          setActiveUsers(activeCount);
        }

        if (docsRes.status === 'fulfilled') {
          setDocuments(docsRes.value || []);
        }

        if (recordsRes.status === 'fulfilled') {
          setTotalRecords(recordsRes.value.total || 0);
        }
      } catch (err) {
        console.error('Failed to load admin dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-linear-to-r from-slate-900 via-indigo-950 to-brand-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[11px] font-semibold tracking-wide text-brand-200">
              <Shield className="w-3.5 h-3.5 text-brand-300" />
              <span>VMS Admin Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.full_name || 'Admin'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-telugu">
              సిస్టమ్ మొత్తం అప్‌లోడ్ చేసిన తెలుగు డాక్యుమెంట్లు, వెలికితీసిన ఓటర్ రికార్డులు మరియు యూజర్ ఖాతాలను ఇక్కడ నిర్వహించండి.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold shadow-lg transition-all"
            >
              <UserPlus className="w-4 h-4 text-brand-600" />
              <span>Manage Users</span>
            </Link>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/20 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Voter Document</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Users</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {loading ? '...' : totalUsers}
            </h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              <span>{activeUsers} active accounts</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total PDFs Processed</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {loading ? '...' : documents.length}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Up to 300 MB capacity</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Voter Records</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {loading ? '...' : totalRecords.toLocaleString()}
            </h3>
            <p className="text-[11px] text-brand-600 dark:text-brand-400 font-medium mt-1 font-telugu">
              ఓటర్ రికార్డులు (డేటాబేస్)
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">System Role</p>
            <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 capitalize">
              {user?.role || 'Admin'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Full System Control</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid: Recent Users & Recent Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Management Summary Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Registered Users</h3>
                  <p className="text-[11px] text-slate-400">User accounts and role assignments</p>
                </div>
              </div>
              <Link
                to="/admin/users"
                className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.slice(0, 4).map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center">
                      {u.full_name?.charAt(0).toUpperCase() || u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {u.full_name}
                      </p>
                      <p className="text-[11px] text-slate-400">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {u.role}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      title={u.is_active ? 'Active' : 'Inactive'}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Link
              to="/admin/users"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
            >
              Open User Management Panel
            </Link>
          </div>
        </div>

        {/* Recent Documents Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">All Uploaded Documents</h3>
                  <p className="text-[11px] text-slate-400">Global Telugu voter lists and PDFs</p>
                </div>
              </div>
              <Link
                to="/extracted-data"
                className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {documents.slice(0, 4).map((doc) => (
                <div key={doc.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {doc.original_filename}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatBytes(doc.file_size)} · {doc.total_pages || 1} pages
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      Completed
                    </span>
                    <Link
                      to="/extracted-data"
                      className="text-xs font-bold text-brand-600 hover:underline"
                    >
                      Records
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Link
              to="/upload"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-brand-500/20"
            >
              Upload Voter Document
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
