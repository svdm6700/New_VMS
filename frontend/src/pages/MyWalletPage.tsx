import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  History,
  DollarSign,
  MapPin,
  FileText,
  UserCheck,
  Send,
  RotateCcw,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { walletService } from '../services/walletService';
import {
  Wallet as WalletType,
  WalletTransaction,
  GeographicAssignment,
  VoterAmountAllocation
} from '../types/wallet';

export const MyWalletPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'voters' | 'history'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // User Wallet State
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [totalAllocated, setTotalAllocated] = useState<number>(0);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [totalRefunded, setTotalRefunded] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<WalletTransaction[]>([]);
  const [assignments, setAssignments] = useState<GeographicAssignment[]>([]);

  // Assigned Voters State
  const [voters, setVoters] = useState<any[]>([]);
  const [votersTotal, setVotersTotal] = useState(0);
  const [votersPage, setVotersPage] = useState(1);
  const [votersSearch, setVotersSearch] = useState('');
  const [votersWardFilter, setVotersWardFilter] = useState('');
  const [votersLoading, setVotersLoading] = useState(false);
  const [noGeoMsg, setNoGeoMsg] = useState<string | null>(null);

  // Assign Amount Modal State
  const [selectedVoter, setSelectedVoter] = useState<any | null>(null);
  const [assignAmount, setAssignAmount] = useState('');
  const [assignRemarks, setAssignRemarks] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // My Allocation History State
  const [allocations, setAllocations] = useState<VoterAmountAllocation[]>([]);
  const [allocationsTotal, setAllocationsTotal] = useState(0);
  const [allocationsPage, setAllocationsPage] = useState(1);
  const [allocationsSearch, setAllocationsSearch] = useState('');
  const [reversingAlloc, setReversingAlloc] = useState<VoterAmountAllocation | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  // Auto clear alerts
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 7000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  // Load User Wallet & Summary
  const fetchWalletData = async () => {
    setIsLoading(true);
    try {
      const res = await walletService.getMyWallet();
      setWallet(res.wallet);
      setAvailableBalance(res.available_balance);
      setTotalAllocated(res.total_amount_allocated);
      setTotalSpent(res.total_amount_spent);
      setTotalRefunded(res.total_amount_refunded);
      setRecentTransactions(res.recent_transactions);
      setAssignments(res.geographic_assignments);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to load wallet information.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  // Preselect voter if navigated with ?voter_id=XYZ
  useEffect(() => {
    const voterIdParam = searchParams.get('voter_id');
    if (voterIdParam) {
      const vid = parseInt(voterIdParam);
      if (!isNaN(vid)) {
        setActiveTab('voters');
        walletService.getMyAssignedVoterDetails(vid).then((voterData) => {
          setSelectedVoter(voterData);
          setAssignAmount('1000');
        }).catch((err) => {
          console.error('Failed to preselect voter from URL:', err);
        });
      }
    }
  }, [searchParams]);

  // Fetch Assigned Voters
  const fetchAssignedVoters = async () => {
    setVotersLoading(true);
    try {
      const res = await walletService.getMyAssignedVoters({
        page: votersPage,
        limit: 20,
        search: votersSearch.trim() || undefined,
        ward: votersWardFilter || undefined
      });
      setVoters(res.items);
      setVotersTotal(res.total);
      if (res.message) {
        setNoGeoMsg(res.message);
      } else {
        setNoGeoMsg(null);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to fetch assigned voters.');
    } finally {
      setVotersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'voters') {
      fetchAssignedVoters();
    }
  }, [votersPage, votersSearch, votersWardFilter, activeTab]);

  // Fetch Allocations History
  const fetchAllocationHistory = async () => {
    try {
      const res = await walletService.getMyVoterAllocations({
        page: allocationsPage,
        limit: 20,
        search: allocationsSearch.trim() || undefined
      });
      setAllocations(res.items);
      setAllocationsTotal(res.total);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAllocationHistory();
    }
  }, [allocationsPage, allocationsSearch, activeTab]);

  // Handle Amount Assignment Submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoter) return;

    const amt = parseFloat(assignAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid amount greater than zero.');
      return;
    }
    if (amt > availableBalance) {
      setErrorMsg(`Insufficient wallet balance (Available: ₹${availableBalance.toLocaleString('en-IN')}).`);
      return;
    }

    setIsAssigning(true);
    try {
      const idempotencyKey = `VAL-TX-${selectedVoter.id}-${Date.now()}`;
      const res = await walletService.assignVoterAmount({
        voter_id: selectedVoter.id,
        amount: amt,
        remarks: assignRemarks.trim() || undefined,
        idempotency_key: idempotencyKey
      });

      setSuccessMsg(`Successfully assigned ₹${amt.toLocaleString('en-IN')} to voter ${selectedVoter.voter_name}! Transaction ID: ${res.transaction_id}`);
      setAvailableBalance(res.updated_balance);
      setSelectedVoter(null);
      setAssignAmount('');
      setAssignRemarks('');

      await Promise.all([fetchWalletData(), fetchAssignedVoters()]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to assign amount to voter.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle Reversal Submit
  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingAlloc || !reversalReason.trim()) {
      setErrorMsg('A valid reason is required for reversal.');
      return;
    }

    setIsReversing(true);
    try {
      const res = await walletService.reverseVoterAllocation(reversingAlloc.id, reversalReason.trim());
      setSuccessMsg(res.message || 'Allocation reversed successfully and balance restored.');
      setAvailableBalance(res.updated_balance);
      setReversingAlloc(null);
      setReversalReason('');

      await Promise.all([fetchWalletData(), fetchAllocationHistory()]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to reverse allocation.');
    } finally {
      setIsReversing(false);
    }
  };

  // Get list of permitted wards from user assignments
  const permittedWards: string[] = [];
  assignments.forEach(a => {
    if (a.wards) {
      a.wards.forEach(w => {
        if (!permittedWards.includes(w)) permittedWards.push(w);
      });
    }
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            My Wallet & Voter Allocations
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your allocated funds, disburse to assigned constituency/ward voters, and review transaction history.
          </p>
        </div>

        <button
          onClick={fetchWalletData}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Balance
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-rose-800 dark:text-rose-300 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Wallet Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Wallet Balance */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/25 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Available Wallet Balance
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              ₹
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-slate-50 mt-3 font-mono">
            ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready for voter disbursements</span>
          </div>
        </div>

        {/* Total Allocated by Admin */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Funds Received
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-3 font-mono">
            ₹{totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-400 mt-1">Transferred from Admin Wallet</p>
        </div>

        {/* Total Spent on Voters */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Disbursed to Voters
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-3 font-mono">
            ₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-400 mt-1">Allocated to field voters</p>
        </div>

        {/* Geographic Boundary Assignment */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Assigned Scope
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          {wallet?.owner_type === 'ADMIN' || isAdmin ? (
            <div className="mt-2.5">
              <div className="font-bold text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Global Scope (Admin)</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Authorized for all districts, constituencies & wards
              </p>
            </div>
          ) : assignments.length > 0 ? (
            <div className="mt-2.5">
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                {assignments[0].constituency}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {assignments[0].wards && assignments[0].wards.length > 0 ? (
                  assignments[0].wards.map(w => (
                    <span
                      key={w}
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
                    >
                      Ward {w}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">All Wards</span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-2.5 text-xs text-rose-500 font-semibold">
              No Geographic Scope Assigned
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <History className="w-4 h-4" />
          Recent Wallet Ledger
        </button>

        <button
          onClick={() => setActiveTab('voters')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'voters'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Assigned Voters & Disburse Amount
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          My Disbursed Allocations History
        </button>
      </div>

      {/* TAB 1: Recent Wallet Transactions */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-brand-600" />
                Wallet Transaction Ledger
              </h2>
              <span className="text-xs text-slate-400">
                Current Available: ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/75 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Transaction ID</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Direction</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                    <th className="py-3 px-4">Description / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                        No transactions recorded in your wallet yet. Contact Administrator to receive funds.
                      </td>
                    </tr>
                  ) : (
                    recentTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {tx.transaction_id}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-500 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {tx.transaction_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.direction === 'CREDIT'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {tx.direction === 'CREDIT' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {tx.direction}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${
                          tx.direction === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {tx.direction === 'CREDIT' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300 font-semibold">
                          ₹{tx.balance_after.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-500 truncate max-w-xs">{tx.remarks || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Assigned Voters & Amount Assignment */}
      {activeTab === 'voters' && (
        <div className="space-y-4">
          {noGeoMsg && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{noGeoMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search voter name, EPIC ID, house number..."
                value={votersSearch}
                onChange={e => setVotersSearch(e.target.value)}
                className="w-full text-xs bg-transparent border-none focus:outline-hidden text-slate-900 dark:text-slate-100"
              />
            </div>

            {(isAdmin || wallet?.owner_type === 'ADMIN') ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filter Ward:</span>
                <input
                  type="text"
                  placeholder="e.g. 1, 2, 5"
                  value={votersWardFilter}
                  onChange={e => setVotersWardFilter(e.target.value)}
                  className="w-24 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300"
                />
              </div>
            ) : permittedWards.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filter Ward:</span>
                <select
                  value={votersWardFilter}
                  onChange={e => setVotersWardFilter(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300"
                >
                  <option value="">All Assigned Wards</option>
                  {permittedWards.map(w => (
                    <option key={w} value={w}>Ward {w}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/75 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Voter Name</th>
                    <th className="py-3 px-4">EPIC ID</th>
                    <th className="py-3 px-4">Relation</th>
                    <th className="py-3 px-4">Age / Gender</th>
                    <th className="py-3 px-4">House No</th>
                    <th className="py-3 px-4">Ward</th>
                    <th className="py-3 px-4 text-right">Prior Disbursed</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {votersLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">Loading voters in your assigned ward(s)...</td>
                    </tr>
                  ) : voters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                        {noGeoMsg ? noGeoMsg : 'No voters found matching your search in the assigned wards.'}
                      </td>
                    </tr>
                  ) : (
                    voters.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{v.voter_name}</div>
                          <div className="text-[10px] text-slate-400">{v.constituency} · {v.district}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-brand-600 dark:text-brand-400">
                          {v.voter_id}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          {v.relation_name} ({v.relation_type})
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {v.age} / {v.gender}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-800 dark:text-slate-200">
                          {v.house_no}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                            Ward {v.ward_number}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {v.total_allocated_amount > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              ₹{v.total_allocated_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">₹0.00</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedVoter(v);
                              setAssignAmount('1000');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs transition-all"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Disburse
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: My Allocation History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search allocation ref, voter name, EPIC ID..."
                value={allocationsSearch}
                onChange={e => setAllocationsSearch(e.target.value)}
                className="w-full text-xs bg-transparent border-none focus:outline-hidden text-slate-900 dark:text-slate-100"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Showing {allocations.length} records
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/75 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ref Number</th>
                    <th className="py-3 px-4">Voter Name</th>
                    <th className="py-3 px-4">EPIC ID</th>
                    <th className="py-3 px-4">Ward</th>
                    <th className="py-3 px-4 text-right">Amount Disbursed</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                        You have not disbursed any voter allocations yet.
                      </td>
                    </tr>
                  ) : (
                    allocations.map(al => (
                      <tr key={al.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {al.allocation_reference}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                          {al.voter_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-brand-600 dark:text-brand-400">
                          {al.voter_epic}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          Ward {al.ward_number}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ₹{al.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(al.allocation_date).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              al.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            }`}
                          >
                            {al.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-xs">{al.remarks || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          {al.status === 'ACTIVE' && (
                            <button
                              onClick={() => setReversingAlloc(al)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 transition-colors"
                            >
                              Request Reversal
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Assign Amount to Voter */}
      {selectedVoter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  ₹
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Disburse Amount to Voter
                  </h3>
                  <p className="text-[10px] text-slate-400">Direct deduction from your active wallet</p>
                </div>
              </div>
              <button onClick={() => setSelectedVoter(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Voter Preview Card */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {selectedVoter.voter_name}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  Ward {selectedVoter.ward_number}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>EPIC: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedVoter.voter_id}</strong></span>
                <span>House No: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedVoter.house_no}</strong></span>
              </div>
              <div className="text-[11px] text-slate-500">
                Constituency: <strong className="text-slate-700 dark:text-slate-300">{selectedVoter.constituency}</strong>
              </div>
            </div>

            {/* Current Balance Indicator */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 text-xs">
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                Your Available Balance:
              </span>
              <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200">
                ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount to Disburse (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={availableBalance}
                    required
                    placeholder="e.g. 1000"
                    value={assignAmount}
                    onChange={e => setAssignAmount(e.target.value)}
                    className="w-full text-base font-mono font-bold pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[500, 1000, 2000, 5000].map(val => (
                    <button
                      key={val}
                      type="button"
                      disabled={val > availableBalance}
                      onClick={() => setAssignAmount(val.toString())}
                      className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-colors ${
                        val > availableBalance
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      ₹{val.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ward campaign disbursement"
                  value={assignRemarks}
                  onChange={e => setAssignRemarks(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedVoter(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning || !assignAmount || parseFloat(assignAmount) > availableBalance}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  {isAssigning ? 'Deducting...' : 'Confirm & Disburse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reversal Modal */}
      {reversingAlloc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Reverse Allocation & Restore Wallet
                </h3>
              </div>
              <button onClick={() => setReversingAlloc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-800 dark:text-rose-300">
              You are reversing allocation <strong>{reversingAlloc.allocation_reference}</strong> (₹{reversingAlloc.amount.toLocaleString('en-IN')}) for voter <strong>{reversingAlloc.voter_name}</strong>.
              <p className="mt-1 font-semibold">
                The amount of ₹{reversingAlloc.amount.toLocaleString('en-IN')} will be credited back to your wallet.
              </p>
            </div>

            <form onSubmit={handleReverseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Reversal *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Duplicate disbursement entered by mistake"
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReversingAlloc(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReversing}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                >
                  {isReversing ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
