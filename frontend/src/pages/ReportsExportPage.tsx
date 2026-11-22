import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  BarChart2,
  DollarSign,
  Users,
  Shield,
  FileText,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Building
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface ReportsExportPageProps {
  hideHeader?: boolean;
}

export const ReportsExportPage: React.FC<ReportsExportPageProps> = ({ hideHeader = false }) => {
  const { isSuperAdmin, isAdmin } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Report statistics
  const [reportStats, setReportStats] = useState<{
    totalTransactions: number;
    totalDisbursed: number;
    avgDisbursement: number;
    activeUsersCount: number;
  }>({
    totalTransactions: 0,
    totalDisbursed: 0,
    avgDisbursement: 0,
    activeUsersCount: 0,
  });

  const fetchReportsSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/payments/reports', {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      const data = res.data;
      setReportStats({
        totalTransactions: data.total_transactions ?? data.summary?.total_count ?? 0,
        totalDisbursed: data.total_disbursed_amount ?? data.summary?.paid_amount ?? data.summary?.total_amount ?? 0,
        avgDisbursement: data.average_disbursement ?? (data.summary?.total_count > 0 ? (data.summary?.paid_amount / data.summary?.total_count) : 0),
        activeUsersCount: data.total_active_users ?? 0,
      });
    } catch (err: any) {
      console.warn('Failed to load payments report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsSummary();
  }, [fromDate, toDate]);

  const handleDownload = async (exportType: string, format: 'csv' | 'excel') => {
    setDownloading(exportType);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      params.append('format', format === 'excel' ? 'xlsx' : 'csv');
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      const url = `/api/payments/export?${params.toString()}`;

      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type:
          format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${exportType}_report_${new Date().toISOString().split('T')[0]}.${
        format === 'excel' ? 'xlsx' : 'csv'
      }`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setMessage({
        type: 'success',
        text: `${exportType.toUpperCase()} report exported successfully.`,
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || `Failed to export ${exportType} report.`,
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner (Shown only in standalone view) */}
      {!hideHeader && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 border border-brand-200 dark:border-brand-900/50 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {isSuperAdmin ? 'Super Admin System Reports' : 'Admin Scoped Reports'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Reports & Data Export
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Generate and export comprehensive voter lists, payment disbursements, and operational audit reports.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchReportsSummary}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div
          className={`flex items-center justify-between p-4 rounded-2xl text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Date Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Calendar className="w-4 h-4 text-brand-600" /> Filter Time Window:
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xs text-slate-500">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs text-slate-500">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="text-2xs text-rose-600 dark:text-rose-400 font-semibold hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Disbursed
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            ₹{reportStats.totalDisbursed.toLocaleString('en-IN')}
          </p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">Across selected period</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Allocations Recorded
            </span>
            <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {reportStats.totalTransactions.toLocaleString('en-IN')}
          </p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">Voter disbursal records</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Average Disbursal
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            ₹{Math.round(reportStats.avgDisbursement).toLocaleString('en-IN')}
          </p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">Average per voter disbursement</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Field Users
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {reportStats.activeUsersCount}
          </p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">Users disbursing in scope</p>
        </div>
      </div>

      {/* Export Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payments & Disbursals Export */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Payment & Disbursement Transactions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed transaction log of all voter payments, allocation IDs, users, and timestamps.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 mb-6 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Included Records:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {reportStats.totalTransactions} transactions
              </span>
            </div>
            <div className="flex justify-between">
              <span>Scope:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {isSuperAdmin ? 'Global / All Constituencies' : 'Authorized Geographic Scope'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownload('payments', 'excel')}
              disabled={downloading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {downloading === 'payments' ? 'Exporting...' : 'Export Excel (.xlsx)'}
            </button>
            <button
              onClick={() => handleDownload('payments', 'csv')}
              disabled={downloading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Global Summary Report */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Voter Disbursal Allocation Audit
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Electoral voter level audit report with EPIC IDs, house numbers, and disbursement statuses.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 mb-6 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Disbursed Sum:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                ₹{reportStats.totalDisbursed.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Security Level:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Audited & Digitally Logged
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownload('voter_allocations', 'excel')}
              disabled={downloading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Excel (.xlsx)
            </button>
            <button
              onClick={() => handleDownload('voter_allocations', 'csv')}
              disabled={downloading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
