import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  MapPin,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  History,
  ShieldAlert,
  ArrowRightLeft,
  DollarSign,
  Building,
  RotateCcw
} from 'lucide-react';
import { walletService } from '../services/walletService';
import {
  Wallet as WalletType,
  WalletTransaction,
  UserWalletSummary,
  GeographicAssignment,
  VoterAmountAllocation,
  WalletGlobalSummary
} from '../types/wallet';

export const WalletManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'admin' | 'users' | 'geo' | 'allocations'>('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Global & Admin Data
  const [adminWalletData, setAdminWalletData] = useState<{
    wallet: WalletType;
    available_balance: number;
    total_amount_added: number;
    total_allocated_to_users: number;
    total_spent_by_users: number;
    total_refunds: number;
    recent_transactions: WalletTransaction[];
  } | null>(null);
  const [globalSummary, setGlobalSummary] = useState<WalletGlobalSummary | null>(null);

  // Tab 1: Admin Transactions
  const [adminTransactions, setAdminTransactions] = useState<WalletTransaction[]>([]);
  const [adminTxPage, setAdminTxPage] = useState(1);
  const [adminTxTotal, setAdminTxTotal] = useState(0);
  const [adminTxFilterType, setAdminTxFilterType] = useState('');
  const [adminTxSearch, setAdminTxSearch] = useState('');

  // Tab 2: User Wallets
  const [userWallets, setUserWallets] = useState<UserWalletSummary[]>([]);
  const [userWalletSearch, setUserWalletSearch] = useState('');
  const [selectedUserForAlloc, setSelectedUserForAlloc] = useState<UserWalletSummary | null>(null);
  const [allocAmount, setAllocAmount] = useState('');
  const [allocRemarks, setAllocRemarks] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);

  // User Transactions Modal
  const [viewingUserTx, setViewingUserTx] = useState<UserWalletSummary | null>(null);
  const [userTxList, setUserTxList] = useState<WalletTransaction[]>([]);
  const [userTxLoading, setUserTxLoading] = useState(false);

  // Tab 3: Geographic Assignments
  const [assignments, setAssignments] = useState<GeographicAssignment[]>([]);
  const [locations, setLocations] = useState<{ districts: string[]; constituencies: string[]; wards: string[] }>({
    districts: [],
    constituencies: [],
    wards: []
  });
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<GeographicAssignment | null>(null);
  const [geoUserId, setGeoUserId] = useState<number>(0);
  const [geoDistrict, setGeoDistrict] = useState('');
  const [geoConstituency, setGeoConstituency] = useState('');
  const [geoWards, setGeoWards] = useState<string[]>([]);
  const [geoArea, setGeoArea] = useState('');
  const [isSavingGeo, setIsSavingGeo] = useState(false);

  // Tab 4: Global Voter Allocations
  const [allocations, setAllocations] = useState<VoterAmountAllocation[]>([]);
  const [allocTotal, setAllocTotal] = useState(0);
  const [allocPage, setAllocPage] = useState(1);
  const [allocSearch, setAllocSearch] = useState('');
  const [allocStatusFilter, setAllocStatusFilter] = useState('');
  const [reversingAlloc, setReversingAlloc] = useState<VoterAmountAllocation | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  // Fund Admin Wallet Modal
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundMethod, setFundMethod] = useState('Bank Transfer');
  const [fundRef, setFundRef] = useState('');
  const [fundRemarks, setFundRemarks] = useState('');
  const [isFunding, setIsFunding] = useState(false);

  // Admin Disburse Directly to Voter Modal State
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [disburseVoterSearch, setDisburseVoterSearch] = useState('');
  const [disburseVotersList, setDisburseVotersList] = useState<any[]>([]);
  const [disburseVotersLoading, setDisburseVotersLoading] = useState(false);
  const [selectedVoterForDisburse, setSelectedVoterForDisburse] = useState<any | null>(null);
  const [disburseAmount, setDisburseAmount] = useState('1000');
  const [disburseRemarks, setDisburseRemarks] = useState('');
  const [isDisbursing, setIsDisbursing] = useState(false);

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

  // Initial Load
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [walletRes, summaryRes, usersRes, geoRes, locRes] = await Promise.all([
        walletService.getAdminWallet(),
        walletService.getGlobalSummary(),
        walletService.getUserWallets(),
        walletService.getUserAssignments(),
        walletService.getLocations()
      ]);
      setAdminWalletData(walletRes);
      setAdminTransactions(walletRes.recent_transactions || []);
      setAdminTxTotal(walletRes.recent_transactions?.length || 0);
      setGlobalSummary(summaryRes);
      setUserWallets(usersRes);
      setAssignments(geoRes);
      setLocations(locRes);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to load wallet management data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Fetch admin transactions when page/filters change
  const fetchAdminTransactions = async () => {
    try {
      const res = await walletService.getAdminWalletTransactions({
        page: adminTxPage,
        limit: 15,
        transaction_type: adminTxFilterType || undefined,
        search: adminTxSearch || undefined
      });
      setAdminTransactions(res.items);
      setAdminTxTotal(res.total);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin') {
      fetchAdminTransactions();
    }
  }, [adminTxPage, adminTxFilterType, adminTxSearch, activeTab]);

  // Fetch global voter allocations when tab 4 is active
  const fetchAllocations = async () => {
    try {
      const res = await walletService.getAllVoterAllocations({
        page: allocPage,
        limit: 20,
        status: allocStatusFilter || undefined,
        search: allocSearch || undefined
      });
      setAllocations(res.items);
      setAllocTotal(res.total);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'allocations') {
      fetchAllocations();
    }
  }, [allocPage, allocStatusFilter, allocSearch, activeTab]);

  // Handle Fund Admin Wallet
  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(fundAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid positive amount.');
      return;
    }
    setIsFunding(true);
    try {
      const res = await walletService.fundAdminWallet({
        amount: amt,
        payment_method: fundMethod,
        transaction_reference: fundRef.trim() || undefined,
        remarks: fundRemarks.trim() || undefined
      });
      setSuccessMsg(res.message || `Successfully added ₹${amt.toLocaleString('en-IN')} to Admin Wallet.`);
      setIsFundModalOpen(false);
      setFundAmount('');
      setFundRef('');
      setFundRemarks('');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to fund wallet.');
    } finally {
      setIsFunding(false);
    }
  };

  // Handle Allocate to User
  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForAlloc) return;
    const amt = parseFloat(allocAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid allocation amount.');
      return;
    }
    if (adminWalletData && amt > adminWalletData.available_balance) {
      setErrorMsg(`Insufficient Admin Balance (₹${adminWalletData.available_balance.toLocaleString('en-IN')}).`);
      return;
    }
    setIsAllocating(true);
    try {
      const res = await walletService.allocateToUser({
        user_id: selectedUserForAlloc.user_id,
        amount: amt,
        remarks: allocRemarks.trim() || undefined
      });
      setSuccessMsg(res.message || `Successfully allocated ₹${amt.toLocaleString('en-IN')} to @${selectedUserForAlloc.username}.`);
      setSelectedUserForAlloc(null);
      setAllocAmount('');
      setAllocRemarks('');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to allocate funds.');
    } finally {
      setIsAllocating(false);
    }
  };

  // View User Transactions
  const handleOpenUserTx = async (u: UserWalletSummary) => {
    setViewingUserTx(u);
    setUserTxLoading(true);
    try {
      const res = await walletService.getUserWalletTransactions(u.user_id, { page: 1, limit: 50 });
      setUserTxList(res.items);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to load user transactions.');
    } finally {
      setUserTxLoading(false);
    }
  };

  // Open Geographic Assignment Modal
  const handleOpenGeoModal = (assignment?: GeographicAssignment) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setGeoUserId(assignment.user_id);
      setGeoDistrict(assignment.district);
      setGeoConstituency(assignment.constituency);
      setGeoWards(assignment.wards || []);
      setGeoArea(assignment.area || '');
    } else {
      setEditingAssignment(null);
      setGeoUserId(userWallets[0]?.user_id || 0);
      setGeoDistrict(locations.districts[0] || '');
      setGeoConstituency(locations.constituencies[0] || '');
      setGeoWards(locations.wards.slice(0, 1) || ['1']);
      setGeoArea('');
    }
    setIsAssignModalOpen(true);
  };

  // Save Geographic Assignment
  const handleSaveGeo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geoUserId || !geoDistrict.trim() || !geoConstituency.trim()) {
      setErrorMsg('User, District, and Constituency are required.');
      return;
    }
    setIsSavingGeo(true);
    try {
      if (editingAssignment) {
        await walletService.updateAssignment(editingAssignment.id, {
          district: geoDistrict.trim(),
          constituency: geoConstituency.trim(),
          wards: geoWards,
          area: geoArea.trim() || undefined
        });
        setSuccessMsg('Geographic assignment updated successfully.');
      } else {
        await walletService.createAssignment({
          user_id: geoUserId,
          district: geoDistrict.trim(),
          constituency: geoConstituency.trim(),
          wards: geoWards,
          area: geoArea.trim() || undefined
        });
        setSuccessMsg('Geographic assignment created successfully.');
      }
      setIsAssignModalOpen(false);
      const [geoRes, usersRes] = await Promise.all([
        walletService.getUserAssignments(),
        walletService.getUserWallets()
      ]);
      setAssignments(geoRes);
      setUserWallets(usersRes);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to save geographic assignment.');
    } finally {
      setIsSavingGeo(false);
    }
  };

  // Revoke Geographic Assignment
  const handleRevokeGeo = async (id: number) => {
    if (!window.confirm('Are you sure you want to revoke this geographic access assignment?')) return;
    try {
      await walletService.deleteAssignment(id);
      setSuccessMsg('Geographic assignment revoked successfully.');
      const [geoRes, usersRes] = await Promise.all([
        walletService.getUserAssignments(),
        walletService.getUserWallets()
      ]);
      setAssignments(geoRes);
      setUserWallets(usersRes);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to revoke assignment.');
    }
  };

  // Handle Reversal of Voter Allocation
  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingAlloc || !reversalReason.trim()) {
      setErrorMsg('Please specify a valid reason for reversal.');
      return;
    }
    setIsReversing(true);
    try {
      const res = await walletService.reverseVoterAllocation(reversingAlloc.id, reversalReason.trim());
      setSuccessMsg(res.message || 'Allocation reversed and wallet balance restored.');
      setReversingAlloc(null);
      setReversalReason('');
      await Promise.all([fetchAllocations(), fetchAllData()]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to reverse allocation.');
    } finally {
      setIsReversing(false);
    }
  };

  // Admin Search Voters for Disbursal
  const handleSearchVotersForDisburse = async (term: string) => {
    setDisburseVoterSearch(term);
    setDisburseVotersLoading(true);
    try {
      const res = await walletService.getMyAssignedVoters({
        page: 1,
        limit: 15,
        search: term.trim() || undefined
      });
      setDisburseVotersList(res.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setDisburseVotersLoading(false);
    }
  };

  // Handle Admin Disburse to Voter
  const handleDisburseToVoterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoterForDisburse) {
      setErrorMsg('Please select a voter to disburse funds to.');
      return;
    }
    const amt = parseFloat(disburseAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid amount greater than zero.');
      return;
    }
    if (adminWalletData && amt > adminWalletData.available_balance) {
      setErrorMsg(`Insufficient Admin Wallet balance (Available: ₹${adminWalletData.available_balance.toLocaleString('en-IN')}).`);
      return;
    }

    setIsDisbursing(true);
    try {
      const res = await walletService.assignVoterAmount({
        voter_id: selectedVoterForDisburse.id,
        amount: amt,
        remarks: disburseRemarks.trim() || undefined,
        idempotency_key: `VAL-ADMIN-${selectedVoterForDisburse.id}-${Date.now()}`
      });
      setSuccessMsg(`Successfully disbursed ₹${amt.toLocaleString('en-IN')} to voter ${selectedVoterForDisburse.voter_name}! Transaction ID: ${res.transaction_id}`);
      setIsDisburseModalOpen(false);
      setSelectedVoterForDisburse(null);
      setDisburseAmount('1000');
      setDisburseRemarks('');
      setDisburseVoterSearch('');
      setDisburseVotersList([]);

      // Refresh data
      await Promise.all([fetchAllData(), fetchAdminTransactions(), fetchAllocations()]);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to disburse amount to voter.');
    } finally {
      setIsDisbursing(false);
    }
  };

  // Filtered Users
  const filteredUsers = userWallets.filter(u =>
    u.full_name?.toLowerCase().includes(userWalletSearch.toLowerCase()) ||
    u.username?.toLowerCase().includes(userWalletSearch.toLowerCase()) ||
    u.assigned_constituency?.toLowerCase().includes(userWalletSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            Wallet & Voter Allocation Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Admin Master Wallet, User Fund Allocation, Constituency/Ward Boundaries & Financial Audit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchAllData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setIsDisburseModalOpen(true);
              handleSearchVotersForDisburse('');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-sm transition-all"
          >
            <DollarSign className="w-4 h-4" />
            Spend on Voter
          </button>
          <button
            onClick={() => setIsFundModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Funds to Admin Wallet
          </button>
        </div>
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

      {/* Top Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Admin Available Balance */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Admin Available Balance
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-50 mt-2 font-mono">
            ₹{(adminWalletData?.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Master Treasury Wallet</span>
          </div>
        </div>

        {/* Total Funded */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Added to Wallet
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            ₹{(adminWalletData?.total_amount_added || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Verified funding records</p>
        </div>

        {/* Total Allocated to Users */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Allocated to Users
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            ₹{(adminWalletData?.total_allocated_to_users || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Dispatched to operators</p>
        </div>

        {/* Total Spent by Users on Voters */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Spent on Voters
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            ₹{(adminWalletData?.total_spent_by_users || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Active voter allocations</p>
        </div>

        {/* Total Refunds & Active Wallets */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Refunds / Reversals
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">
            ₹{(adminWalletData?.total_refunds || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {globalSummary?.active_user_wallets_count || userWallets.length} active wallets
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('admin')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'admin'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Admin Master Wallet & Ledger
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          User Wallets & Allocation
        </button>

        <button
          onClick={() => setActiveTab('geo')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'geo'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Geographic Assignment (Constituency & Wards)
        </button>

        <button
          onClick={() => setActiveTab('allocations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'allocations'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          Global Voter Allocations Ledger
        </button>
      </div>

      {/* TAB 1: Admin Master Wallet & Transactions */}
      {activeTab === 'admin' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search transaction ID, reference, remarks..."
                value={adminTxSearch}
                onChange={e => setAdminTxSearch(e.target.value)}
                className="w-full text-xs bg-transparent border-none focus:outline-hidden text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={adminTxFilterType}
                onChange={e => setAdminTxFilterType(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Transaction Types</option>
                <option value="ADMIN_WALLET_CREDIT">Funding (Credit)</option>
                <option value="ADMIN_TO_USER_ALLOCATION">User Allocation (Debit)</option>
                <option value="TRANSACTION_REVERSAL">Reversal</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/75 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Transaction ID</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Direction</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                    <th className="py-3 px-4">Reference / Method</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {adminTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                        No transactions recorded in Admin Wallet yet.
                      </td>
                    </tr>
                  ) : (
                    adminTransactions.map(tx => (
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
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
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
                        <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-300">
                          {tx.payment_method ? `${tx.payment_method} ` : ''}
                          {tx.reference_id ? `(${tx.reference_id})` : ''}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-500 truncate max-w-xs" title={tx.remarks}>
                          {tx.remarks || '—'}
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

      {/* TAB 2: User Wallets & Allocation */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search user name, username, constituency..."
                value={userWalletSearch}
                onChange={e => setUserWalletSearch(e.target.value)}
                className="w-full text-xs bg-transparent border-none focus:outline-hidden text-slate-900 dark:text-slate-100"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Showing {filteredUsers.length} Users
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/75 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Assigned Constituency</th>
                    <th className="py-3 px-4">Assigned Ward(s)</th>
                    <th className="py-3 px-4 text-right">Available Balance</th>
                    <th className="py-3 px-4 text-right">Total Allocated</th>
                    <th className="py-3 px-4 text-right">Total Spent</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                        No users match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {u.full_name || u.username}
                          </div>
                          <div className="text-[10px] text-slate-400">@{u.username} · {u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">
                          {u.assigned_constituency}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {u.assigned_wards}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{u.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          ₹{u.total_allocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          ₹{u.total_spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              u.status === 'Active'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedUserForAlloc(u)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 transition-colors"
                            >
                              Allocate
                            </button>
                            <button
                              onClick={() => handleOpenUserTx(u)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              Ledger
                            </button>
                          </div>
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

      {/* TAB 3: Geographic Assignments */}
      {activeTab === 'geo' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                User Geographic Access Restrictions
              </h2>
              <p className="text-xs text-slate-400">
                Enforces backend boundary checking so operators only view and disburse to their assigned wards.
              </p>
            </div>
            <button
              onClick={() => handleOpenGeoModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Assign Constituency & Wards
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/75 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Operator / User</th>
                    <th className="py-3 px-4">District</th>
                    <th className="py-3 px-4">Constituency</th>
                    <th className="py-3 px-4">Permitted Ward(s)</th>
                    <th className="py-3 px-4">Area / Village</th>
                    <th className="py-3 px-4">Assigned On</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                        No geographic boundaries assigned yet. Click "Assign Constituency & Wards" to restrict user access.
                      </td>
                    </tr>
                  ) : (
                    assignments.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {a.user_full_name || a.user_username}
                          </div>
                          <div className="text-[10px] text-slate-400">@{a.user_username}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">{a.district}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-bold">{a.constituency}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {a.wards && a.wards.length > 0 ? (
                              a.wards.map(w => (
                                <span
                                  key={w}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50"
                                >
                                  Ward {w}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">All Wards</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{a.area || '—'}</td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(a.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              a.status === 'ACTIVE'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenGeoModal(a)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRevokeGeo(a.id)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
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

      {/* TAB 4: Global Voter Allocations */}
      {activeTab === 'allocations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search reference, voter name, EPIC ID..."
                value={allocSearch}
                onChange={e => setAllocSearch(e.target.value)}
                className="w-full text-xs bg-transparent border-none focus:outline-hidden text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={allocStatusFilter}
                onChange={e => setAllocStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active (Disbursed)</option>
                <option value="REVERSED">Reversed / Refunded</option>
              </select>

              <button
                onClick={() => {
                  setIsDisburseModalOpen(true);
                  handleSearchVotersForDisburse('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs transition-all shrink-0"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Spend on Voter</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/75 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ref ID</th>
                    <th className="py-3 px-4">Voter Details</th>
                    <th className="py-3 px-4">Location (Ward)</th>
                    <th className="py-3 px-4 text-right">Amount Assigned</th>
                    <th className="py-3 px-4">Disbursed By</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                        No voter allocations recorded yet.
                      </td>
                    </tr>
                  ) : (
                    allocations.map(al => (
                      <tr key={al.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {al.allocation_reference}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{al.voter_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            EPIC: {al.voter_epic} · House: {al.house_no}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 dark:text-slate-200 font-medium">{al.constituency}</div>
                          <div className="text-[10px] text-slate-400">Ward {al.ward_number}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-50">
                          ₹{al.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 dark:text-slate-200 font-medium">@{al.user_username}</div>
                          <div className="text-[10px] text-slate-400">{al.user_name}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(al.allocation_date).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              al.status === 'ACTIVE'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {al.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {al.status === 'ACTIVE' && (
                            <button
                              onClick={() => setReversingAlloc(al)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 transition-colors"
                            >
                              Reverse
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

      {/* MODAL 1: Fund Admin Wallet */}
      {isFundModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  ₹
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Add Funds to Admin Master Wallet
                </h3>
              </div>
              <button onClick={() => setIsFundModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFundSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Funding Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 50000"
                    value={fundAmount}
                    onChange={e => setFundAmount(e.target.value)}
                    className="w-full text-base font-mono font-bold pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[10000, 25000, 50000, 100000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFundAmount(val.toString())}
                      className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      +₹{val.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment / Funding Method
                </label>
                <select
                  value={fundMethod}
                  onChange={e => setFundMethod(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                  <option value="Cash">Cash Deposit</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI Payment</option>
                  <option value="Treasury Allocation">Treasury Central Allocation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction Reference ID / Cheque No
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR-982348123 or CHQ-00123"
                  value={fundRef}
                  onChange={e => setFundRef(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Funding Remarks / Purpose
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Initial constituency campaign budget allocation"
                  value={fundRemarks}
                  onChange={e => setFundRemarks(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFundModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFunding}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  {isFunding ? 'Processing...' : 'Confirm Funding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Allocate Funds to User */}
      {selectedUserForAlloc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Allocate Funds to Operator
                </h3>
                <p className="text-xs text-slate-400">
                  Transfer from Master Admin Wallet to User Wallet
                </p>
              </div>
              <button onClick={() => setSelectedUserForAlloc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Balances Context Banner */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 grid grid-cols-2 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Admin Available</span>
                <span className="font-mono font-bold text-emerald-600">
                  ₹{(adminWalletData?.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">User Current</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  ₹{selectedUserForAlloc.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <form onSubmit={handleAllocateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Operator / User
                </label>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {selectedUserForAlloc.full_name} (@{selectedUserForAlloc.username})
                  <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                    Assigned: {selectedUserForAlloc.assigned_constituency} · Wards: {selectedUserForAlloc.assigned_wards}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={adminWalletData?.available_balance || 999999999}
                    required
                    placeholder="e.g. 10000"
                    value={allocAmount}
                    onChange={e => setAllocAmount(e.target.value)}
                    className="w-full text-base font-mono font-bold pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[2000, 5000, 10000, 20000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAllocAmount(val.toString())}
                      className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                    >
                      +₹{val.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Allocation Remarks / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Field budget for ward voter disbursements"
                  value={allocRemarks}
                  onChange={e => setAllocRemarks(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserForAlloc(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAllocating}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  {isAllocating ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: User Transactions Ledger */}
      {viewingUserTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-600" />
                  User Wallet Ledger: {viewingUserTx.full_name} (@{viewingUserTx.username})
                </h3>
                <p className="text-xs text-slate-400">
                  Current Balance: ₹{viewingUserTx.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <button onClick={() => setViewingUserTx(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {userTxLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading ledger...</div>
              ) : userTxList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No transactions for this user yet.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                      <th className="py-2.5 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                    {userTxList.map(tx => (
                      <tr key={tx.id}>
                        <td className="py-2.5 px-3 font-sans text-slate-500">
                          {new Date(tx.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.direction === 'CREDIT'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            }`}
                          >
                            {tx.direction} ({tx.transaction_type.replace(/_/g, ' ')})
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${
                          tx.direction === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {tx.direction === 'CREDIT' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 font-semibold">
                          ₹{tx.balance_after.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-500 truncate max-w-xs">{tx.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Geographic Assignment Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingAssignment ? 'Edit Geographic Boundary' : 'Assign Geographic Boundary'}
                </h3>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGeo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select User / Operator *
                </label>
                <select
                  disabled={!!editingAssignment}
                  value={geoUserId}
                  onChange={e => setGeoUserId(parseInt(e.target.value))}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                >
                  {userWallets.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    District *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. West Godavari"
                    value={geoDistrict}
                    onChange={e => setGeoDistrict(e.target.value)}
                    list="districts-list"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <datalist id="districts-list">
                    {locations.districts.map(d => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Constituency *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tadepalligudem"
                    value={geoConstituency}
                    onChange={e => setGeoConstituency(e.target.value)}
                    list="constituencies-list"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <datalist id="constituencies-list">
                    {locations.constituencies.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Multi-Ward Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Permitted Ward(s)
                  </label>
                  <span className="text-[10px] text-slate-400">Comma-separated or pick below</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 1, 2, 3"
                  value={geoWards.join(', ')}
                  onChange={e => setGeoWards(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 mb-2"
                />
                {/* Available location wards chips */}
                {locations.wards.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {locations.wards.map(w => {
                      const isSel = geoWards.includes(w);
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => {
                            if (isSel) setGeoWards(geoWards.filter(x => x !== w));
                            else setGeoWards([...geoWards, w]);
                          }}
                          className={`px-2 py-0.5 text-[10px] rounded-md font-semibold transition-colors ${
                            isSel
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          Ward {w}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Optional Area / Village
                </label>
                <input
                  type="text"
                  placeholder="e.g. Municipal Colony"
                  value={geoArea}
                  onChange={e => setGeoArea(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingGeo}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
                >
                  {isSavingGeo ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Reversal Modal */}
      {reversingAlloc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Reverse Voter Amount Allocation
                </h3>
              </div>
              <button onClick={() => setReversingAlloc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-800 dark:text-rose-300">
              You are about to reverse allocation <strong>{reversingAlloc.allocation_reference}</strong> (₹{reversingAlloc.amount.toLocaleString('en-IN')}) for voter <strong>{reversingAlloc.voter_name}</strong>.
              <p className="mt-1">
                The amount will be refunded and credited back to <strong>@{reversingAlloc.user_username}</strong>'s wallet.
              </p>
            </div>

            <form onSubmit={handleConfirmReversal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Reversal *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Duplicate allocation entered by mistake / Wrong voter selected"
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
      {/* MODAL: Admin Direct Disburse to Voter */}
      {isDisburseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  ₹
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Disburse Funds to Voter
                  </h3>
                  <p className="text-[10px] text-slate-400">Direct deduction from Admin Master Wallet</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDisburseModalOpen(false);
                  setSelectedVoterForDisburse(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admin Balance Banner */}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 text-xs">
              <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                Admin Master Balance:
              </span>
              <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">
                ₹{adminWalletData?.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>

            {/* Voter Selection Step */}
            {!selectedVoterForDisburse ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Search Voter to Fund *
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Type voter name, EPIC ID, or house number..."
                      value={disburseVoterSearch}
                      onChange={e => handleSearchVotersForDisburse(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  {disburseVotersLoading ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      Searching voters...
                    </div>
                  ) : disburseVotersList.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 font-sans">
                      {disburseVoterSearch.trim() ? 'No matching voters found.' : 'Search above to select a voter.'}
                    </div>
                  ) : (
                    disburseVotersList.map(v => (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVoterForDisburse(v)}
                        className="p-3 hover:bg-emerald-50/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">{v.voter_name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-brand-600 dark:text-brand-400 font-semibold">{v.voter_id}</span>
                            <span>•</span>
                            <span>Ward {v.ward_number}</span>
                            <span>•</span>
                            <span>House {v.house_no}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                          Select →
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Voter Info Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {selectedVoterForDisburse.voter_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedVoterForDisburse(null)}
                      className="text-[11px] font-semibold text-brand-600 hover:underline"
                    >
                      Change Voter
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>EPIC: <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedVoterForDisburse.voter_id}</strong></span>
                    <span>Ward: <strong className="text-slate-800 dark:text-slate-200">{selectedVoterForDisburse.ward_number}</strong></span>
                    <span>House: <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedVoterForDisburse.house_no}</strong></span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Location: <strong className="text-slate-800 dark:text-slate-200">{selectedVoterForDisburse.constituency}, {selectedVoterForDisburse.district}</strong>
                  </div>
                </div>

                <form onSubmit={handleDisburseToVoterSubmit} className="space-y-4">
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
                        max={adminWalletData?.available_balance || 9999999}
                        required
                        placeholder="e.g. 1000"
                        value={disburseAmount}
                        onChange={e => setDisburseAmount(e.target.value)}
                        className="w-full text-base font-mono font-bold pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                      />
                    </div>
                    {/* Quick Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[500, 1000, 2000, 5000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setDisburseAmount(val.toString())}
                          className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          ₹{val.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Remarks / Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Field campaign support disbursement"
                      value={disburseRemarks}
                      onChange={e => setDisburseRemarks(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDisburseModalOpen(false);
                        setSelectedVoterForDisburse(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isDisbursing || !disburseAmount}
                      className="px-5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm flex items-center gap-1.5"
                    >
                      {isDisbursing ? 'Disbursing...' : 'Confirm & Disburse'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
