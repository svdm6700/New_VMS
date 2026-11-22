import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Database,
  Upload,
  ArrowRight,
  FileSpreadsheet,
  Download,
  User,
  Clock,
  Wallet,
  MapPin
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { documentService } from '../services/documentService';
import { walletService } from '../services/walletService';
import { DocumentItem } from '../types/document';
import { formatBytes } from '../utils/formatters';

export const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletAllocated, setWalletAllocated] = useState<number>(0);
  const [walletSpent, setWalletSpent] = useState<number>(0);
  const [assignedScope, setAssignedScope] = useState<string>('None');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const [docsRes, recordsRes, walletRes] = await Promise.allSettled([
          documentService.getDocuments({ limit: 10 }),
          documentService.getVoterRecords({ limit: 1 }),
          walletService.getMyWallet(),
        ]);

        if (docsRes.status === 'fulfilled') {
          setDocuments(docsRes.value || []);
        }

        if (recordsRes.status === 'fulfilled') {
          setTotalRecords(recordsRes.value.total || 0);
        }

        if (walletRes.status === 'fulfilled') {
          const w = walletRes.value;
          setWalletBalance(w.available_balance || 0);
          setWalletAllocated(w.total_amount_allocated || 0);
          setWalletSpent(w.total_amount_spent || 0);
          if (w.geographic_assignments && w.geographic_assignments.length > 0) {
            const first = w.geographic_assignments[0];
            setAssignedScope(`${first.constituency} (${first.wards?.length ? 'Wards ' + first.wards.join(', ') : 'All Wards'})`);
          }
        }
      } catch (err) {
        console.error('Failed to load user dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[11px] font-semibold tracking-wide text-brand-200">
              <User className="w-3.5 h-3.5 text-brand-300" />
              <span>User Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, {user?.full_name || user?.username}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-telugu">
              మీరు అప్‌లోడ్ చేసిన తెలుగు డాక్యుమెంట్లు మరియు వెలికితీసిన ఓటర్ రికార్డులను ఇక్కడ సులభంగా వీక్షించవచ్చు, ఎడిట్ చేయవచ్చు మరియు ఎక్సెల్‌లో డౌన్‌లోడ్ చేయవచ్చు.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/20 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Upload PDF (Up to 300 MB)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">My Uploaded Documents</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {loading ? '...' : documents.length}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Stored securely in database</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Voter Records</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {loading ? '...' : totalRecords.toLocaleString()}
            </h3>
            <p className="text-[11px] text-brand-600 dark:text-brand-400 font-medium mt-1 font-telugu">
              ఓటర్ రికార్డులు అందుబాటులో ఉన్నాయి
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Supported File Size</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              300 MB
            </h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              High-capacity parsing ready
            </p>
          </div>
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center">
            <Upload className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Wallet Section (Section 3) */}
      <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                My Active Wallet & Scope
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 font-mono">
                ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Assigned: <strong className="text-slate-700 dark:text-slate-300">{assignedScope}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden lg:flex items-center gap-6 px-4 py-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-emerald-500/15 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Received</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  ₹{walletAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-px h-7 bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Disbursed</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  ₹{walletSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Link
              to="/my-wallet"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <span>Open Wallet & Disburse</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* My Documents Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              My Uploaded Documents
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Access your extracted voter lists, view documents in reader, and export records
            </p>
          </div>
          <Link
            to="/extracted-data"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
          >
            <span>Open Voter Records</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No documents uploaded yet
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Upload your first voter document to automatically extract and view records.
            </p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Voter Document</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Document Name</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Pages</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                          {doc.original_filename}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{formatBytes(doc.file_size)}</td>
                    <td className="py-3.5 px-4 text-slate-500">{doc.total_pages || 1} pages</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {doc.processing_status || 'completed'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end">
                        <Link
                          to="/extracted-data"
                          className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950 dark:hover:bg-brand-900 text-brand-600 dark:text-brand-300 rounded-lg text-xs font-semibold"
                        >
                          View Records
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
