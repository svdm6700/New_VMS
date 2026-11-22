import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  IndianRupee,
  Search,
  Filter,
  PlusCircle,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RotateCcw,
  Edit3,
  Trash2,
  Eye,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Phone,
  User,
  Building2,
  MapPin,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Check,
  ShieldAlert,
  Printer,
  Ban,
  ArrowUpDown,
  RefreshCw,
  BarChart3,
  PieChart as PieIcon,
  Layers,
  HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import {
  paymentService,
  PaymentRecord,
  PaymentSummary,
  DailyCollectionPoint,
  MonthlyCollectionPoint,
  StatusDistributionPoint,
  MethodDistributionPoint,
  LocationCollectionData,
  PaymentReceipt
} from '../services/paymentService';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  Paid: '#10B981', // emerald-500
  Pending: '#F59E0B', // amber-500
  Failed: '#EF4444', // rose-500
  Cancelled: '#64748B', // slate-500
  Refunded: '#8B5CF6', // purple-500
};

const METHOD_COLORS: Record<string, string> = {
  Cash: '#059669',
  UPI: '#4F46E5',
  'Bank Transfer': '#2563EB',
  Other: '#D97706',
};

export const PaymentsDashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Summary State (7 KPI Metrics)
  const [summary, setSummary] = useState<PaymentSummary>({
    total_transactions: 0,
    total_amount: 0,
    total_amount_recorded: 0,
    total_payments: 0,
    paid_amount: 0,
    pending_amount: 0,
    failed_transactions: 0,
    failed_amount: 0,
    refunded_amount: 0,
    cancelled_amount: 0,
    today_collection: 0,
    yesterday_collection: 0,
    this_month_collection: 0,
    last_month_collection: 0,
    paid_percentage: 0,
    pending_percentage: 0,
    today_growth_pct: 0,
    month_growth_pct: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Charts State
  const [activeChartTab, setActiveChartTab] = useState<'daily' | 'monthly' | 'distribution' | 'location'>('daily');
  const [chartDays, setChartDays] = useState(14);
  const [dailyData, setDailyData] = useState<DailyCollectionPoint[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyCollectionPoint[]>([]);
  const [statusDist, setStatusDist] = useState<StatusDistributionPoint[]>([]);
  const [methodDist, setMethodDist] = useState<MethodDistributionPoint[]>([]);
  const [locationData, setLocationData] = useState<LocationCollectionData>({ districts: [], constituencies: [] });
  const [loadingCharts, setLoadingCharts] = useState(false);

  // Table & Filter State
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filteredSummary, setFilteredSummary] = useState({
    total_amount: 0,
    paid_amount: 0,
    pending_amount: 0,
    count: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [constituencyFilter, setConstituencyFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [wardFilter, setWardFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sortBy, setSortBy] = useState('payment_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Add Payment Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [voterSearch, setVoterSearch] = useState('');
  const [voterResults, setVoterResults] = useState<any[]>([]);
  const [searchingVoters, setSearchingVoters] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any | null>(null);

  const [addMobile, setAddMobile] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [addMethod, setAddMethod] = useState('Cash');
  const [addStatus, setAddStatus] = useState('Paid');
  const [addReference, setAddReference] = useState('');
  const [addRemarks, setAddRemarks] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // View Details & Receipt Modal
  const [viewPayment, setViewPayment] = useState<PaymentRecord | null>(null);
  const [receiptData, setReceiptData] = useState<PaymentReceipt | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [viewModalTab, setViewModalTab] = useState<'receipt' | 'details' | 'audit'>('receipt');

  // Edit Payment Modal
  const [editPayment, setEditPayment] = useState<PaymentRecord | null>(null);
  const [editMobile, setEditMobile] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editMethod, setEditMethod] = useState('Cash');
  const [editReference, setEditReference] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Verify / Cancel / Refund / Delete Action Dialogs
  const [verifyTarget, setVerifyTarget] = useState<PaymentRecord | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<PaymentRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PaymentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Export State
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // 1. Fetch Summary
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await paymentService.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load payments summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // 2. Fetch Charts Data
  const fetchCharts = useCallback(async () => {
    setLoadingCharts(true);
    try {
      const [daily, monthly, sDist, mDist, loc] = await Promise.all([
        paymentService.getDailyCollection(chartDays),
        paymentService.getMonthlyCollection(12),
        paymentService.getStatusDistribution(),
        paymentService.getMethodDistribution(),
        paymentService.getLocationCollection(),
      ]);
      setDailyData(daily);
      setMonthlyData(monthly);
      setStatusDist(sDist);
      setMethodDist(mDist);
      setLocationData(loc);
    } catch (err) {
      console.error('Failed to load chart analytics:', err);
    } finally {
      setLoadingCharts(false);
    }
  }, [chartDays]);

  // 3. Fetch Payments Table
  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const res = await paymentService.listPayments({
        q: searchQuery.trim() || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        district: districtFilter !== 'all' ? districtFilter : undefined,
        constituency: constituencyFilter !== 'all' ? constituencyFilter : undefined,
        area: areaFilter !== 'all' ? areaFilter : undefined,
        ward: wardFilter !== 'all' ? wardFilter : undefined,
        payment_status: statusFilter !== 'all' ? statusFilter : undefined,
        payment_method: methodFilter !== 'all' ? methodFilter : undefined,
        sort_by: sortBy,
        order: sortOrder,
        page,
        limit,
      });
      setPayments(res.payments || []);
      setTotalPayments(res.total || 0);
      setTotalPages(res.pages || 1);
      if (res.filtered_summary) {
        setFilteredSummary(res.filtered_summary);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, [
    searchQuery,
    fromDate,
    toDate,
    districtFilter,
    constituencyFilter,
    areaFilter,
    wardFilter,
    statusFilter,
    methodFilter,
    sortBy,
    sortOrder,
    page,
    limit,
  ]);

  useEffect(() => {
    fetchSummary();
    fetchCharts();
  }, [fetchSummary, fetchCharts]);

  useEffect(() => {
    const qParam = searchParams.get('q') || searchParams.get('search');
    if (qParam) {
      setSearchQuery(qParam);
    }
    const openAdd = searchParams.get('open_add');
    if (openAdd === 'true') {
      setShowAddModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Debounced Voter Search for Add Payment
  useEffect(() => {
    const q = voterSearch.trim();
    if (q.length < 2) {
      setVoterResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingVoters(true);
      try {
        const results = await paymentService.searchVoters(q, 15);
        setVoterResults(results);
      } catch (err) {
        console.error('Voter search failed:', err);
      } finally {
        setSearchingVoters(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [voterSearch]);

  const handleSelectVoter = (voter: any) => {
    setSelectedVoter(voter);
    setAddMobile(voter.latest_mobile || '');
    setVoterSearch('');
    setVoterResults([]);
  };

  // Add Payment Submit
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!selectedVoter) {
      setAddError('Please search and select a voter first.');
      return;
    }

    const cleanMob = addMobile.replace(/\D/g, '');
    if (cleanMob.length !== 10) {
      setAddError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const amt = parseFloat(addAmount);
    if (isNaN(amt) || amt <= 0) {
      setAddError('Please enter a valid positive payment amount.');
      return;
    }

    if (['UPI', 'Bank Transfer'].includes(addMethod) && addStatus === 'Paid' && !addReference.trim()) {
      setAddError(`Transaction reference is required for ${addMethod} payments marked as Paid.`);
      return;
    }

    setIsSubmittingAdd(true);
    try {
      await paymentService.createPayment({
        voter_id: selectedVoter.id,
        mobile_number: cleanMob,
        amount: amt,
        payment_date: addDate,
        payment_method: addMethod,
        payment_status: addStatus,
        transaction_reference: addReference.trim() || undefined,
        remarks: addRemarks.trim() || undefined,
      });

      setShowAddModal(false);
      resetAddForm();
      await Promise.all([fetchSummary(), fetchCharts(), fetchPayments()]);
    } catch (err: any) {
      setAddError(err.response?.data?.detail || err.message || 'Failed to record payment.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const resetAddForm = () => {
    setSelectedVoter(null);
    setVoterSearch('');
    setVoterResults([]);
    setAddMobile('');
    setAddAmount('');
    setAddDate(new Date().toISOString().split('T')[0]);
    setAddMethod('Cash');
    setAddStatus('Paid');
    setAddReference('');
    setAddRemarks('');
    setAddError(null);
  };

  // View Receipt
  const handleViewReceipt = async (payment: PaymentRecord) => {
    setViewPayment(payment);
    setViewModalTab('receipt');
    setReceiptData(null);
    setLoadingReceipt(true);
    try {
      const data = await paymentService.getReceipt(payment.id);
      setReceiptData(data);
    } catch (err) {
      console.error('Failed to load payment receipt:', err);
    } finally {
      setLoadingReceipt(false);
    }
  };

  // Edit Payment Save
  const handleOpenEdit = (payment: PaymentRecord) => {
    setEditPayment(payment);
    setEditMobile(payment.mobile_number || '');
    setEditAmount(payment.amount?.toString() || '');
    setEditDate(payment.payment_date || '');
    setEditMethod(payment.payment_method || 'Cash');
    setEditReference(payment.transaction_reference || '');
    setEditRemarks(payment.remarks || '');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editPayment) return;
    setEditError(null);

    const cleanMob = editMobile.replace(/\D/g, '');
    if (cleanMob.length !== 10) {
      setEditError('Mobile number must be exactly 10 digits.');
      return;
    }

    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) {
      setEditError('Amount must be greater than zero.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      await paymentService.updatePayment(editPayment.id, {
        mobile_number: cleanMob,
        amount: amt,
        payment_date: editDate || undefined,
        payment_method: editMethod,
        transaction_reference: editReference.trim() || undefined,
        remarks: editRemarks.trim() || undefined,
      });

      setEditPayment(null);
      await Promise.all([fetchSummary(), fetchCharts(), fetchPayments()]);
    } catch (err: any) {
      setEditError(err.response?.data?.detail || err.message || 'Failed to update payment.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Verify Action
  const handleConfirmVerify = async () => {
    if (!verifyTarget) return;
    setIsVerifying(true);
    try {
      await paymentService.verifyPayment(verifyTarget.id);
      setVerifyTarget(null);
      await Promise.all([fetchSummary(), fetchCharts(), fetchPayments()]);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to verify payment.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Cancel Action
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setActionError('Cancellation reason is required.');
      return;
    }
    setIsCancelling(true);
    try {
      await paymentService.cancelPayment(cancelTarget.id, cancelReason.trim());
      setCancelTarget(null);
      setCancelReason('');
      setActionError(null);
      await Promise.all([fetchSummary(), fetchCharts(), fetchPayments()]);
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to cancel payment.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Refund Action
  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    if (!refundReason.trim()) {
      setActionError('Refund reason is required.');
      return;
    }
    setIsRefunding(true);
    try {
      await paymentService.refundPayment(refundTarget.id, refundReason.trim());
      setRefundTarget(null);
      setRefundReason('');
      setActionError(null);
      await Promise.all([fetchSummary(), fetchCharts(), fetchPayments()]);
    } catch (err: any) {
      setActionError(err.response?.data?.detail || 'Failed to process refund.');
    } finally {
      setIsRefunding(false);
    }
  };

  // Delete Action
  const handleDeletePayment = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await paymentService.deletePayment(deleteTarget.id);
      setDeleteTarget(null);
      await Promise.all([fetchSummary(), fetchCharts(), fetchPayments()]);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete payment.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Handlers
  const handleExport = async (format: 'csv' | 'excel') => {
    if (format === 'csv') setExportingCsv(true);
    else setExportingExcel(true);

    try {
      await paymentService.downloadExport(format, {
        q: searchQuery.trim() || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        district: districtFilter !== 'all' ? districtFilter : undefined,
        constituency: constituencyFilter !== 'all' ? constituencyFilter : undefined,
        area: areaFilter !== 'all' ? areaFilter : undefined,
        ward: wardFilter !== 'all' ? wardFilter : undefined,
        payment_status: statusFilter !== 'all' ? statusFilter : undefined,
        payment_method: methodFilter !== 'all' ? methodFilter : undefined,
      });
    } catch (err) {
      alert('Export failed. Please try again.');
    } finally {
      setExportingCsv(false);
      setExportingExcel(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setDistrictFilter('all');
    setConstituencyFilter('all');
    setAreaFilter('all');
    setWardFilter('all');
    setStatusFilter('all');
    setMethodFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-600" />
            <span>Payments Dashboard</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track, record, verify, and report financial disbursement and welfare payments linked to voter records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={exportingCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            {exportingCsv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={exportingExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            {exportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetAddForm();
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Payment</span>
          </button>
        </div>
      </div>

      {/* PHASE 3 A: 7 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* 1. Total Transactions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Txns</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {summary.total_transactions.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Recorded entries</p>
        </div>

        {/* 2. Total Recorded Amount */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Amount</span>
            <IndianRupee className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            ₹{summary.total_amount_recorded.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Cumulative ledger</p>
        </div>

        {/* 3. Paid Amount */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-4 shadow-2xs bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Paid Amount</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">
            ₹{summary.paid_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
            {summary.paid_percentage}% confirmed
          </p>
        </div>

        {/* 4. Pending Amount */}
        <div className="bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-4 shadow-2xs bg-amber-50/20 dark:bg-amber-950/10">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-300 font-mono">
            ₹{summary.pending_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1">
            {summary.pending_percentage}% awaiting check
          </p>
        </div>

        {/* 5. Failed Transactions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Failed Txns</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {summary.failed_transactions}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">₹{summary.failed_amount.toLocaleString()} uncollected</p>
        </div>

        {/* 6. Today's Collection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Today</span>
            <Calendar className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            ₹{summary.today_collection.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {summary.today_growth_pct >= 0 ? `+${summary.today_growth_pct}%` : `${summary.today_growth_pct}%`} vs yest.
          </p>
        </div>

        {/* 7. This Month's Collection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">This Month</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-purple-700 dark:text-purple-300 font-mono">
            ₹{summary.this_month_collection.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {summary.month_growth_pct >= 0 ? `+${summary.month_growth_pct}%` : `${summary.month_growth_pct}%`} vs prior mo.
          </p>
        </div>
      </div>

      {/* PHASE 3 B: INTERACTIVE PAYMENT CHARTS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-600" />
              <span>Payment Analytics & Visualizations</span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive charts dynamically calculated from PostgreSQL transaction logs.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Chart Type Tabs */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveChartTab('daily')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeChartTab === 'daily'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Daily Trend
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('monthly')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeChartTab === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Monthly Trend
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('distribution')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeChartTab === 'distribution'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Status & Method
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('location')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeChartTab === 'location'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Districts
              </button>
            </div>

            {/* Range filter for daily chart */}
            {activeChartTab === 'daily' && (
              <select
                value={chartDays}
                onChange={(e) => setChartDays(Number(e.target.value))}
                className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-semibold"
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={60}>Last 60 Days</option>
              </select>
            )}
          </div>
        </div>

        {/* Chart View Content */}
        <div className="h-72 w-full">
          {loadingCharts ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2 text-brand-600" />
              <span>Calculating chart metrics from PostgreSQL...</span>
            </div>
          ) : activeChartTab === 'daily' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val.toLocaleString()}`} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: 'none', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="paid_amount" name="Paid Collection" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending_amount" name="Pending" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : activeChartTab === 'monthly' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val.toLocaleString()}`} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: 'none', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="paid_amount" name="Paid Amount" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pending_amount" name="Pending Amount" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : activeChartTab === 'distribution' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              {/* Status Pie */}
              <div>
                <p className="text-xs font-semibold text-center text-slate-500 mb-2">By Payment Status</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusDist}
                      dataKey="total_amount"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      paddingAngle={4}
                    >
                      {statusDist.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#6366F1'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`₹${Number(val).toLocaleString()}`, name]}
                      contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: 'none', color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Method Pie */}
              <div>
                <p className="text-xs font-semibold text-center text-slate-500 mb-2">By Payment Method</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={methodDist}
                      dataKey="total_amount"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      paddingAngle={4}
                    >
                      {methodDist.map((entry) => (
                        <Cell key={entry.method} fill={METHOD_COLORS[entry.method] || '#3B82F6'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`₹${Number(val).toLocaleString()}`, name]}
                      contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: 'none', color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            /* Location Collection */
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={locationData.districts}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 60, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tickFormatter={(val) => `₹${val.toLocaleString()}`} tick={{ fontSize: 11 }} />
                <YAxis dataKey="district" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Total Amount']}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: 'none', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="paid_amount" name="Paid Collection" fill="#10B981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="total_amount" name="Total Recorded" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* PHASE 3 C & 5: SEARCH, FILTERS & PAYMENT RECORDS TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        {/* Search Bar & Quick Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voter name, EPIC number, mobile, Txn ID, house no..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                showFiltersDrawer
                  ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-500 text-brand-600 dark:text-brand-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>

            <button
              type="button"
              onClick={resetFilters}
              title="Reset all filters"
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-500"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filters Drawer */}
        {showFiltersDrawer && (
          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Payment Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="all">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Payment Method
              </label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="all">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        )}

        {/* Filtered Subset KPI Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
          <span>
            Displaying <strong>{payments.length}</strong> of <strong>{totalPayments}</strong> transactions
          </span>
          <div className="flex items-center gap-3 font-mono mt-1 sm:mt-0">
            <span>
              Filtered Total: <strong className="text-slate-900 dark:text-slate-100">₹{filteredSummary.total_amount.toLocaleString()}</strong>
            </span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              Paid: <strong>₹{filteredSummary.paid_amount.toLocaleString()}</strong>
            </span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400">
              Pending: <strong>₹{filteredSummary.pending_amount.toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {/* Payments Table */}
        <div className="overflow-x-auto">
          {loadingPayments ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
              Loading payment ledger from PostgreSQL...
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No payment records found matching the active criteria.</p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 text-brand-600 font-semibold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">S.No.</th>
                  <th className="py-3 px-3">Txn & Receipt</th>
                  <th className="py-3 px-3">Voter Name & ID</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Date & Method</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 text-slate-400 font-mono">
                      {(page - 1) * limit + idx + 1}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {p.transaction_id}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {p.receipt_number}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 font-telugu">
                        {p.voter_name}
                      </div>
                      <div className="text-[10px] text-brand-600 dark:text-brand-400 font-mono font-bold">
                        {p.epic_no}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-slate-700 dark:text-slate-300 font-mono">
                        {p.mobile_number}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        House #{p.house_no}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={p.area}>
                        {p.area}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={p.constituency}>
                        {p.constituency}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        ₹{p.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-slate-700 dark:text-slate-300">
                        {p.payment_date}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {p.payment_method}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          p.payment_status === 'Paid'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : p.payment_status === 'Pending'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : p.payment_status === 'Refunded'
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : p.payment_status === 'Cancelled'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[p.payment_status] || '#6366F1' }}
                        />
                        {p.payment_status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Receipt */}
                        <button
                          type="button"
                          onClick={() => handleViewReceipt(p)}
                          title="View Official Receipt"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Verify Payment (if pending) */}
                        {p.payment_status === 'Pending' && (
                          <button
                            type="button"
                            onClick={() => setVerifyTarget(p)}
                            title="Verify and Mark as Paid"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit Payment */}
                        {!['Cancelled', 'Refunded'].includes(p.payment_status) && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Payment Record"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Refund Payment (if Paid) */}
                        {p.payment_status === 'Paid' && (
                          <button
                            type="button"
                            onClick={() => {
                              setRefundTarget(p);
                              setRefundReason('');
                              setActionError(null);
                            }}
                            title="Issue Refund"
                            className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {/* Cancel Payment */}
                        {!['Cancelled', 'Refunded'].includes(p.payment_status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelTarget(p);
                              setCancelReason('');
                              setActionError(null);
                            }}
                            title="Cancel Payment"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete (Admin only) */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            title="Permanently Delete (Audited)"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              Page {page} of {totalPages} ({totalPayments} total)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">
              {page}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD PAYMENT */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-600" />
                <span>Record New Voter Payment</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleSavePayment} className="mt-4 space-y-4 text-xs">
              {/* Voter Lookup */}
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Search & Select Voter <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={voterSearch}
                    onChange={(e) => setVoterSearch(e.target.value)}
                    placeholder="Type Telugu Name, EPIC ID, House Number..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-telugu"
                  />
                  {searchingVoters && (
                    <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-600" />
                  )}
                </div>

                {/* Dropdown Results */}
                {voterResults.length > 0 && (
                  <div className="mt-1 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-lg">
                    {voterResults.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => handleSelectVoter(v)}
                        className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-slate-100 font-telugu">
                            {v.voter_name}
                          </span>
                          <span className="font-mono text-brand-600 dark:text-brand-400 text-[11px] font-bold">
                            {v.voter_id}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Relation: {v.relation_name} ({v.relation_type})</span>
                          <span>•</span>
                          <span>House #{v.house_no}</span>
                          <span>•</span>
                          <span>{v.area}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Voter Info Card */}
              {selectedVoter && (
                <div className="p-3 bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200/80 dark:border-brand-900/50 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-telugu text-sm">
                      {selectedVoter.voter_name}
                    </span>
                    <span className="px-2 py-0.5 bg-brand-600 text-white rounded font-mono text-[10px] font-bold">
                      {selectedVoter.voter_id}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 grid grid-cols-2 gap-1 pt-1 border-t border-brand-100 dark:border-brand-900/50">
                    <div>Relation: <strong className="font-telugu">{selectedVoter.relation_name}</strong></div>
                    <div>House: <strong>#{selectedVoter.house_no}</strong></div>
                    <div>District: <strong>{selectedVoter.district}</strong></div>
                    <div>Area: <strong>{selectedVoter.area}</strong></div>
                  </div>
                </div>
              )}

              {/* Mobile Number & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Recipient Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={addMobile}
                    onChange={(e) => setAddMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Payment Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="e.g. 5000.00"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Date, Method, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Payment Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Payment Method
                  </label>
                  <select
                    value={addMethod}
                    onChange={(e) => setAddMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Payment Status
                  </label>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              {/* Transaction Reference (if digital) */}
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Transaction Reference (UTR / UPI ID)
                </label>
                <input
                  type="text"
                  value={addReference}
                  onChange={(e) => setAddReference(e.target.value)}
                  placeholder="e.g. UTR1234567890 (optional for cash)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={addRemarks}
                  onChange={(e) => setAddRemarks(e.target.value)}
                  placeholder="e.g. Welfare scheme disbursement, constituency development fund..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-telugu"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd || !selectedVoter}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {isSubmittingAdd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW PAYMENT & OFFICIAL RECEIPT VOUCHER */}
      {viewPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Payment Voucher · {viewPayment.transaction_id}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Receipt #{viewPayment.receipt_number} · Status: {viewPayment.payment_status}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewPayment(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Tab Switcher */}
            <div className="flex items-center gap-2 mt-4 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewModalTab('receipt')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  viewModalTab === 'receipt'
                    ? 'bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Official Receipt
              </button>
              <button
                type="button"
                onClick={() => setViewModalTab('audit')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  viewModalTab === 'audit'
                    ? 'bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Audit Trail ({viewPayment.audit_logs?.length || 0})
              </button>
            </div>

            {/* Receipt Tab Content */}
            {viewModalTab === 'receipt' && (
              <div className="mt-4">
                {loadingReceipt ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Generating official receipt...
                  </div>
                ) : receiptData ? (
                  <div
                    id="printable-receipt"
                    className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/40 dark:bg-slate-800/20 relative space-y-4"
                  >
                    {/* Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 dark:opacity-10 select-none">
                      <span className="text-8xl font-black rotate-[-25deg] uppercase">
                        {receiptData.watermark}
                      </span>
                    </div>

                    {/* Receipt Header */}
                    <div className="text-center pb-3 border-b border-slate-200 dark:border-slate-700">
                      <div className="inline-block px-3 py-1 rounded-full bg-brand-600 text-white font-bold text-xs mb-1">
                        {receiptData.organization.name}
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 font-telugu">
                        {receiptData.organization.telugu_name}
                      </h4>
                      <p className="text-[10px] text-slate-400">{receiptData.organization.tagline}</p>
                      <h5 className="mt-2 text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                        {receiptData.receipt_title}
                      </h5>
                    </div>

                    {/* Receipt Info Numbers */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Receipt Number:</span>
                        <strong className="font-mono">{receiptData.receipt_number}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Transaction ID:</span>
                        <strong className="font-mono">{receiptData.transaction_id}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Payment Date:</span>
                        <span>{receiptData.payment_date}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Payment Status:</span>
                        <span
                          className="font-bold uppercase text-[11px]"
                          style={{ color: STATUS_COLORS[receiptData.payment_status] || '#10B981' }}
                        >
                          {receiptData.payment_status}
                        </span>
                      </div>
                    </div>

                    {/* Voter Details Box */}
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200 mb-1 border-b pb-1 text-[11px] uppercase tracking-wider">
                        Voter Information
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          Voter Name: <strong className="font-telugu">{receiptData.voter.voter_name}</strong>
                        </div>
                        <div>
                          EPIC No: <strong className="font-mono text-brand-600">{receiptData.voter.epic_no}</strong>
                        </div>
                        <div>
                          Relative: <span className="font-telugu">{receiptData.voter.relation_name}</span>
                        </div>
                        <div>
                          House No: <strong>#{receiptData.voter.house_no}</strong>
                        </div>
                        <div>
                          Location: {receiptData.voter.area}
                        </div>
                        <div>
                          Mobile: <strong className="font-mono">{receiptData.voter.mobile_number}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Amount & Method Box */}
                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">
                            Amount Paid
                          </span>
                          <span className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                            {receiptData.amount_formatted}
                          </span>
                        </div>
                        <div className="text-right text-xs">
                          <span className="text-[10px] text-slate-400 block">Method:</span>
                          <strong>{receiptData.payment_method}</strong>
                          {receiptData.transaction_reference !== 'N/A' && (
                            <span className="block text-[10px] font-mono text-slate-500">
                              Ref: {receiptData.transaction_reference}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 italic">
                        {receiptData.amount_in_words}
                      </p>
                    </div>

                    {/* Verification & Signoff */}
                    <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-700">
                      <div>
                        Recorded by: <strong>@{receiptData.creator.username}</strong>
                      </div>
                      <div>
                        {receiptData.verifier.name ? (
                          <span>
                            Verified by: <strong>{receiptData.verifier.name}</strong> ({receiptData.verifier.verified_at})
                          </span>
                        ) : (
                          <span className="text-amber-500 font-semibold">Unverified (Pending Verification)</span>
                        )}
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <p className="text-[9px] text-slate-400 text-center pt-2">
                      {receiptData.disclaimer}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Audit History Tab Content */}
            {viewModalTab === 'audit' && (
              <div className="mt-4 space-y-3">
                {(!viewPayment.audit_logs || viewPayment.audit_logs.length === 0) ? (
                  <p className="text-xs text-slate-400 text-center py-8">No audit logs recorded.</p>
                ) : (
                  viewPayment.audit_logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.performed_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-1">
                        {log.reason || 'No description'}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Actor: <strong>@{log.performer_username || 'system'}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT PAYMENT */}
      {editPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Edit Payment · {editPayment.transaction_id}
              </h3>
              <button
                type="button"
                onClick={() => setEditPayment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Recipient Mobile Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Payment Method
                </label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Transaction Reference
                </label>
                <input
                  type="text"
                  value={editReference}
                  onChange={(e) => setEditReference(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-telugu"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditPayment(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSubmittingEdit}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {isSubmittingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION DIALOG: VERIFY PAYMENT */}
      {verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Verify Payment as Paid
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Confirm that payment <strong className="font-mono">{verifyTarget.transaction_id}</strong> of <strong className="font-mono text-emerald-600">₹{verifyTarget.amount}</strong> for voter <strong className="font-telugu">{verifyTarget.voter_name}</strong> has been received and verified.
            </p>

            <div className="pt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVerifyTarget(null)}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerify}
                disabled={isVerifying}
                className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Paid</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION DIALOG: CANCEL PAYMENT */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-3">
                <Ban className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Cancel Payment · {cancelTarget.transaction_id}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Cancelling this transaction will void its receipt and exclude it from collections.
              </p>
            </div>

            {actionError && (
              <p className="mt-2 text-xs text-rose-600 font-semibold text-center">{actionError}</p>
            )}

            <div className="mt-4 text-xs">
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (audited)..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="pt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="flex-1 flex items-center justify-center gap-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Cancel Txn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION DIALOG: REFUND PAYMENT */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center mb-3">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Process Payment Refund
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Refunding <strong className="font-mono">{refundTarget.transaction_id}</strong> of <strong className="font-mono text-purple-600">₹{refundTarget.amount}</strong> for voter <strong className="font-telugu">{refundTarget.voter_name}</strong>.
              </p>
            </div>

            {actionError && (
              <p className="mt-2 text-xs text-rose-600 font-semibold text-center">{actionError}</p>
            )}

            <div className="mt-4 text-xs">
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Refund Justification / Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for approving refund (audited)..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="pt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={isRefunding}
                className="flex-1 flex items-center justify-center gap-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {isRefunding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Approve Refund</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION DIALOG: DELETE CONFIRMATION */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Confirm Delete Payment
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete payment <strong className="font-mono">{deleteTarget.transaction_id}</strong> of <strong className="font-mono text-emerald-600">₹{deleteTarget.amount}</strong>? This action is audited in system logs.
            </p>

            <div className="pt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
