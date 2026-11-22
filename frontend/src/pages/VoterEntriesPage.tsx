import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  User as UserIcon,
  IndianRupee,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit3,
  Clock,
  RotateCcw,
  Sparkles,
  X,
  CreditCard,
  MapPin,
  Building2,
  Hash,
  Layers,
  ChevronRight,
  Send,
  Loader2,
  History,
  ShieldAlert,
  Receipt,
  Printer,
  ExternalLink,
  PlusCircle,
  Check,
  TrendingUp,
  Tag,
  ArrowUpRight,
  Ban
} from 'lucide-react';
import { voterEntryService, VoterRecord, VoterEntry } from '../services/voterEntryService';
import {
  paymentService,
  PaymentRecord,
  PaymentReceipt,
  VoterPaymentHistoryResponse
} from '../services/paymentService';
import { useAuth } from '../contexts/AuthContext';

export const VoterEntriesPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VoterRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Selected Voter
  const [selectedVoter, setSelectedVoter] = useState<VoterRecord | null>(null);
  const [isLoadingVoter, setIsLoadingVoter] = useState(false);

  // Amount Entry Form State
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Previous Entries State
  const [entries, setEntries] = useState<VoterEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  // Payment Ledger & Linked Transactions State
  const [voterPayments, setVoterPayments] = useState<PaymentRecord[]>([]);
  const [paymentLedgerSummary, setPaymentLedgerSummary] = useState<{
    total_paid: number;
    total_pending: number;
    total_refunded: number;
    total_entered_amount: number;
    payments_count: number;
    entries_count: number;
  } | null>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'entries' | 'payments'>('entries');

  // Quick Payment Modal for this Voter
  const [showQuickPaymentModal, setShowQuickPaymentModal] = useState(false);
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [quickPayDate, setQuickPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [quickPayMethod, setQuickPayMethod] = useState('Cash');
  const [quickPayStatus, setQuickPayStatus] = useState('Paid');
  const [quickPayReference, setQuickPayReference] = useState('');
  const [quickPayRemarks, setQuickPayRemarks] = useState('');
  const [isSubmittingQuickPay, setIsSubmittingQuickPay] = useState(false);
  const [quickPayError, setQuickPayError] = useState<string | null>(null);

  // Official Receipt Modal State
  const [viewReceiptPayment, setViewReceiptPayment] = useState<PaymentRecord | null>(null);
  const [receiptData, setReceiptData] = useState<PaymentReceipt | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Edit Entry Modal State
  const [editingEntry, setEditingEntry] = useState<VoterEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Entry Modal State
  const [deletingEntry, setDeletingEntry] = useState<VoterEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle URL search param 'voter_id' if present
  useEffect(() => {
    const paramId = searchParams.get('voter_id');
    if (paramId) {
      loadVoterById(paramId);
    }
  }, [searchParams]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search when user types 2 or more characters
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(term);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const executeSearch = async (term: string) => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await voterEntryService.searchVoters({ q: term, limit: 15 });
      setSearchResults(res.voters || []);
      setShowDropdown(true);
    } catch (err: any) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const loadVoterById = async (id: string | number) => {
    setIsLoadingVoter(true);
    setIsLoadingEntries(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const voter = await voterEntryService.getVoterDetails(id);
      setSelectedVoter(voter);
      setAmount('');
      setRemarks('');
      setEntryDate(new Date().toISOString().split('T')[0]);

      // Load entries and payment history in parallel
      const [entriesRes, historyRes] = await Promise.all([
        voterEntryService.getVoterEntries(voter.id),
        paymentService.getVoterHistory(voter.id).catch((err) => {
          console.warn('Payment history not available:', err);
          return null;
        }),
      ]);

      setEntries(entriesRes.entries || []);
      if (historyRes) {
        setVoterPayments(historyRes.payments || []);
        setPaymentLedgerSummary(historyRes.summary || null);
      } else {
        setVoterPayments([]);
        setPaymentLedgerSummary(null);
      }
    } catch (err: any) {
      console.error('Failed to load voter details:', err);
      setFormError('Failed to load voter details. Please check the ID and try again.');
    } finally {
      setIsLoadingVoter(false);
      setIsLoadingEntries(false);
    }
  };

  const handleSelectVoter = (voter: VoterRecord) => {
    setSelectedVoter(voter);
    setShowDropdown(false);
    setSearchQuery(voter.voter_name || voter.voter_id);
    setSearchParams({ voter_id: String(voter.id) });
    loadVoterById(voter.id);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setHasSearched(false);
  };

  const handleResetAll = () => {
    handleClearSearch();
    setSelectedVoter(null);
    setEntries([]);
    setVoterPayments([]);
    setPaymentLedgerSummary(null);
    setAmount('');
    setRemarks('');
    setFormError(null);
    setFormSuccess(null);
    setSearchParams({});
  };

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!selectedVoter) {
      setFormError('Please select a voter first.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await voterEntryService.createEntry({
        voter_id: selectedVoter.id,
        amount: numAmount,
        entry_date: entryDate,
        remarks: remarks.trim() || undefined,
      });

      setFormSuccess(`Entry of ₹${numAmount.toLocaleString('en-IN')} saved successfully for ${selectedVoter.voter_name}!`);
      setAmount('');
      setRemarks('');

      // Refresh entries & payment ledger
      const [entriesRes, historyRes] = await Promise.all([
        voterEntryService.getVoterEntries(selectedVoter.id),
        paymentService.getVoterHistory(selectedVoter.id).catch(() => null),
      ]);
      setEntries(entriesRes.entries || []);
      if (historyRes) {
        setVoterPayments(historyRes.payments || []);
        setPaymentLedgerSummary(historyRes.summary || null);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.message || 'Failed to save entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenQuickPayment = () => {
    if (!selectedVoter) return;
    setQuickPayAmount('');
    setQuickPayDate(new Date().toISOString().split('T')[0]);
    setQuickPayMethod('Cash');
    setQuickPayStatus('Paid');
    setQuickPayReference('');
    setQuickPayRemarks('');
    setQuickPayError(null);
    setShowQuickPaymentModal(true);
  };

  const handleSaveQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoter) return;
    setQuickPayError(null);

    const numAmt = parseFloat(quickPayAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setQuickPayError('Amount must be greater than 0.');
      return;
    }

    setIsSubmittingQuickPay(true);
    try {
      await paymentService.createPayment({
        voter_id: selectedVoter.id,
        amount: numAmt,
        payment_date: quickPayDate,
        payment_method: quickPayMethod,
        payment_status: quickPayStatus,
        transaction_reference: quickPayReference.trim() || undefined,
        remarks: quickPayRemarks.trim() || undefined,
      });

      setFormSuccess(`Payment of ₹${numAmt.toLocaleString('en-IN')} recorded successfully for ${selectedVoter.voter_name}!`);
      setShowQuickPaymentModal(false);

      // Refresh both
      const [entriesRes, historyRes] = await Promise.all([
        voterEntryService.getVoterEntries(selectedVoter.id),
        paymentService.getVoterHistory(selectedVoter.id),
      ]);
      setEntries(entriesRes.entries || []);
      setVoterPayments(historyRes.payments || []);
      setPaymentLedgerSummary(historyRes.summary || null);
      setActiveHistoryTab('payments');
    } catch (err: any) {
      setQuickPayError(err.response?.data?.detail || err.message || 'Failed to record payment.');
    } finally {
      setIsSubmittingQuickPay(false);
    }
  };

  const handleOpenReceipt = async (payment: PaymentRecord) => {
    setViewReceiptPayment(payment);
    setLoadingReceipt(true);
    try {
      const data = await paymentService.getReceipt(payment.id);
      setReceiptData(data);
    } catch (err: any) {
      console.error('Failed to load receipt:', err);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleOpenEdit = (entry: VoterEntry) => {
    setEditingEntry(entry);
    setEditAmount(String(entry.amount));
    setEditDate(entry.entry_date);
    setEditRemarks(entry.remarks || '');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setEditError(null);

    const numAmt = parseFloat(editAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setEditError('Amount must be greater than 0.');
      return;
    }

    setIsUpdating(true);
    try {
      await voterEntryService.updateEntry(editingEntry.id, {
        amount: numAmt,
        entry_date: editDate,
        remarks: editRemarks.trim() || undefined,
      });

      if (selectedVoter) {
        const [entriesRes, historyRes] = await Promise.all([
          voterEntryService.getVoterEntries(selectedVoter.id),
          paymentService.getVoterHistory(selectedVoter.id).catch(() => null),
        ]);
        setEntries(entriesRes.entries || []);
        if (historyRes) {
          setVoterPayments(historyRes.payments || []);
          setPaymentLedgerSummary(historyRes.summary || null);
        }
      }
      setEditingEntry(null);
      setFormSuccess('Entry updated successfully.');
    } catch (err: any) {
      setEditError(err.response?.data?.detail || err.message || 'Failed to update entry.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;
    setIsDeleting(true);
    try {
      await voterEntryService.deleteEntry(deletingEntry.id);
      if (selectedVoter) {
        const [entriesRes, historyRes] = await Promise.all([
          voterEntryService.getVoterEntries(selectedVoter.id),
          paymentService.getVoterHistory(selectedVoter.id).catch(() => null),
        ]);
        setEntries(entriesRes.entries || []);
        if (historyRes) {
          setVoterPayments(historyRes.payments || []);
          setPaymentLedgerSummary(historyRes.summary || null);
        }
      }
      setDeletingEntry(null);
      setFormSuccess('Entry deleted successfully.');
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.message || 'Failed to delete entry.');
    } finally {
      setIsDeleting(false);
    }
  };

  const canModifyEntry = (entry: VoterEntry) => {
    if (isAdmin) return true;
    if (user && entry.created_by === user.id) return true;
    return false;
  };

  const totalDisbursed = entries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-brand-600 to-indigo-700 text-white rounded-3xl shadow-lg shadow-brand-500/10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 bg-white/20 rounded-lg text-white">
              <Search className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold tracking-wider uppercase text-white/80">
              Voter Financial Ledger
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Voter Search
          </h1>
          <p className="text-xs text-white/80 mt-1 font-telugu">
            ఓటర్ వివరాల శోధన, మొత్తం నమోదు & చెల్లింపుల లెడ్జర్
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {selectedVoter && (
            <button
              onClick={handleResetAll}
              className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Search Another</span>
            </button>
          )}
          <Link
            to="/payments"
            className="flex items-center gap-2 px-3.5 py-2 bg-white text-brand-700 hover:bg-white/90 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Payments Dashboard</span>
          </Link>
        </div>
      </div>

      {/* SECTION A: Voter Search Bar */}
      <div className="relative" ref={searchContainerRef}>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                placeholder="Search voter by EPIC / Voter ID, Full Name, House No, Area..."
                className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-telugu"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => executeSearch(searchQuery.trim())}
              disabled={isSearching || !searchQuery.trim()}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-semibold shadow-xs transition-all shrink-0 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Voter</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400 font-medium">
            <span>Examples:</span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('SJC');
                executeSearch('SJC');
              }}
              className="text-brand-600 dark:text-brand-400 hover:underline"
            >
              EPIC "SJC..."
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('వెంకటేశ్వరరావు');
                executeSearch('వెంకటేశ్వరరావు');
              }}
              className="text-brand-600 dark:text-brand-400 hover:underline font-telugu"
            >
              పేరు "వెంకటేశ్వరరావు"
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('రామచంద్రపురం');
                executeSearch('రామచంద్రపురం');
              }}
              className="text-brand-600 dark:text-brand-400 hover:underline font-telugu"
            >
              గ్రామం "రామచంద్రపురం"
            </button>
          </div>
        </div>

        {/* Live Search Results Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {isSearching ? 'Searching voters...' : 'No matching voter records found. Try another name or Voter ID.'}
              </div>
            ) : (
              searchResults.map((voter) => (
                <div
                  key={voter.id}
                  onClick={() => handleSelectVoter(voter)}
                  className="p-3.5 hover:bg-brand-50/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-100/70 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {voter.serial_no || '#'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate font-telugu">
                          {voter.voter_name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold shrink-0">
                          {voter.voter_id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 font-telugu">
                        <span>సంబంధం: {voter.relation_name} ({voter.relation_type})</span>
                        <span>•</span>
                        <span>వయస్సు: {voter.age}</span>
                        <span>•</span>
                        <span>ఇంటి నం: {voter.house_no}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 font-telugu">
                        {voter.area || 'గ్రామం N/A'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        వార్డు: {voter.ward_number || 'N/A'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Alert Banners */}
      {formError && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-xs text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {formSuccess && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Main Grid: Voter Details & Financial Ledger (Left) + Amount Entry Form (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SECTION B: Selected Voter Details & Financial Summary Section */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-xl">
                  <UserIcon className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Selected Voter Information (ఎంపిక చేసిన ఓటర్ వివరాలు)
                </h2>
              </div>
              {selectedVoter && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
                    Active Verified
                  </span>
                  <Link
                    to={`/my-wallet?voter_id=${selectedVoter.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold shadow-xs transition-all"
                    title="Disburse funds from your wallet to this voter"
                  >
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span>Spend from Wallet</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleOpenQuickPayment}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold shadow-xs transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Record Payment</span>
                  </button>
                </div>
              )}
            </div>

            {isLoadingVoter ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                <span>Loading voter record & financial ledger...</span>
              </div>
            ) : !selectedVoter ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-3">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No Voter Selected
                </h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                  Use the search bar above to look up an EPIC Voter ID, Name, or House Number.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Hero Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                      {selectedVoter.gender?.includes('స్త్రీ') || selectedVoter.gender?.toLowerCase() === 'female' ? 'F' : 'M'}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-telugu">
                        {selectedVoter.voter_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                          {selectedVoter.voter_id}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-xs text-slate-500 font-medium font-telugu">
                          {selectedVoter.gender} · {selectedVoter.age} సం॥
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:border-l sm:border-slate-200 dark:sm:border-slate-700 sm:pl-4">
                    <Link
                      to={`/payments?q=${encodeURIComponent(selectedVoter.voter_id)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all"
                      title="View all transactions in Payments Dashboard"
                    >
                      <span>Payments View</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Voter Financial Ledger Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Total Entered
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5 block">
                      ₹{(paymentLedgerSummary?.total_entered_amount ?? totalDisbursed).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {paymentLedgerSummary?.entries_count ?? entries.length} entries
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/40 dark:border-emerald-900/30 text-center">
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                      Paid Amount
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                      ₹{(paymentLedgerSummary?.total_paid ?? 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                      {paymentLedgerSummary?.payments_count ?? voterPayments.length} txns
                    </span>
                  </div>

                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200/40 dark:border-amber-900/30 text-center">
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                      Pending
                    </span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">
                      ₹{(paymentLedgerSummary?.total_pending ?? 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                      Awaiting verification
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-2xl border border-purple-200/40 dark:border-purple-900/30 text-center">
                    <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">
                      Refunded
                    </span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400 font-mono mt-0.5 block">
                      ₹{(paymentLedgerSummary?.total_refunded ?? 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80">
                      Reversed
                    </span>
                  </div>
                </div>

                {/* Structured Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Father / Husband Name (సంబంధీకుని పేరు)
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-telugu">
                      {selectedVoter.relation_name} ({selectedVoter.relation_type})
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      House Number (ఇంటి నంబరు)
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {selectedVoter.house_no}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Serial & Roll No (వరుస & భాగం సంఖ్య)
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Sl No: {selectedVoter.serial_no} · Part No: {selectedVoter.electoral_roll_no}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Area / Village (ప్రాంతం / గ్రామం)
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-telugu">
                      {selectedVoter.area || 'Not Available'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Ward Number (వార్డు నంబర్)
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Ward: {selectedVoter.ward_number || 'Not Available'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Constituency & District (నియోజకవర్గం & జిల్లా)
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-telugu">
                      {selectedVoter.constituency || 'N/A'}, {selectedVoter.district || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION C: Amount Entry Form (Phone number completely removed) */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <IndianRupee className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  New Amount Entry (మొత్తం నమోదు ఫారమ్)
                </h2>
              </div>
            </div>

            <form onSubmit={handleSubmitEntry} className="space-y-4">
              {/* Amount Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Amount (మొత్తం - ₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                    ₹
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amount}
                    disabled={!selectedVoter || isSubmitting}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount (e.g. 5000)"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:opacity-50 transition-all"
                  />
                </div>

                {/* Preset Amount Chips */}
                {selectedVoter && (
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
                    {[1000, 2000, 3000, 5000, 10000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(String(preset))}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shrink-0"
                      >
                        ₹{preset.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Entry Date Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Entry Date (తేదీ) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    disabled={!selectedVoter || isSubmitting}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:opacity-50 transition-all"
                  />
                </div>
              </div>

              {/* Remarks Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Remarks / Notes (రిమార్కులు - ఐచ్ఛికం)
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  disabled={!selectedVoter || isSubmitting}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes, purpose of entry, or reference..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:opacity-50 transition-all font-telugu"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!selectedVoter || isSubmitting || !amount || parseFloat(amount) <= 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Entry...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Save Entry (నమోదు చేయండి)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAmount('');
                    setRemarks('');
                    setFormError(null);
                  }}
                  disabled={isSubmitting || !selectedVoter}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* SECTION 3: Dual-Tab History (Data Entries vs Payment Ledger & Receipts) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveHistoryTab('entries')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeHistoryTab === 'entries'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Amount Entries ({entries.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveHistoryTab('payments')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeHistoryTab === 'payments'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Payment Transactions ({voterPayments.length})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedVoter && (
              <button
                type="button"
                onClick={handleOpenQuickPayment}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            )}

            {entries.length > 0 && activeHistoryTab === 'entries' && (
              <div className="flex items-center gap-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 font-sans font-medium text-[11px]">Total:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  ₹{totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {isLoadingEntries ? (
          <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            <span>Loading history records...</span>
          </div>
        ) : !selectedVoter ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Select a voter record above to view their recorded entries and payment transactions.
          </div>
        ) : activeHistoryTab === 'entries' ? (
          /* TAB 1: Raw Voter Amount Entries (Phone number removed) */
          entries.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-2">
                <FileText className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No amount entries recorded yet
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Fill in the form above to record the first amount entry for this voter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">S.No.</th>
                    <th className="py-3 px-3">Amount (₹)</th>
                    <th className="py-3 px-3">Entry Date</th>
                    <th className="py-3 px-3">Remarks</th>
                    <th className="py-3 px-3">Created By</th>
                    <th className="py-3 px-3">Recorded At</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {entries.map((entry, index) => (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {entry.entry_date}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate font-telugu">
                        {entry.remarks || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-semibold">
                          {entry.creator_name || entry.creator_username || 'System'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {canModifyEntry(entry) && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(entry)}
                              title="Edit entry"
                              className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingEntry(entry)}
                              title="Delete entry"
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* TAB 2: Payment Transactions & Official Receipts */
          voterPayments.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-2">
                <Receipt className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No financial payments recorded yet for this voter
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click "+ Record Payment" above to disburse and generate an official receipt voucher.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">S.No.</th>
                    <th className="py-3 px-3">Transaction ID</th>
                    <th className="py-3 px-3">Receipt #</th>
                    <th className="py-3 px-3">Amount (₹)</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Reference</th>
                    <th className="py-3 px-3 text-right">Receipt Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {voterPayments.map((pay, index) => {
                    const isPaid = pay.payment_status === 'Paid';
                    const isPending = pay.payment_status === 'Pending';
                    const isRefunded = pay.payment_status === 'Refunded';
                    return (
                      <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {pay.transaction_id}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">
                          {pay.receipt_number}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          ₹{Number(pay.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                          {pay.payment_date}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {pay.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isPaid
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50'
                                : isPending
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                                : isRefunded
                                ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/50'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span>{pay.payment_status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500 truncate max-w-[120px]">
                          {pay.transaction_reference || '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(pay)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-semibold text-[11px] transition-colors"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* QUICK PAYMENT MODAL FOR SELECTED VOTER */}
      {showQuickPaymentModal && selectedVoter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-600" />
                <span>Record Payment for Voter</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickPayError && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{quickPayError}</span>
              </div>
            )}

            {/* Selected Voter Info Card */}
            <div className="mt-4 p-3 bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-900/50 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {selectedVoter.voter_name?.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate font-telugu">
                  {selectedVoter.voter_name}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  {selectedVoter.voter_id} · {selectedVoter.house_no} · {selectedVoter.area}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveQuickPayment} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Date */}
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Payment Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={quickPayDate}
                    onChange={(e) => setQuickPayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Method */}
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Payment Method
                  </label>
                  <select
                    value={quickPayMethod}
                    onChange={(e) => setQuickPayMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Status
                  </label>
                  <select
                    value={quickPayStatus}
                    onChange={(e) => setQuickPayStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="Paid">Paid (Verified)</option>
                    <option value="Pending">Pending (Draft)</option>
                  </select>
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Transaction Reference (UTR / UPI ID)
                </label>
                <input
                  type="text"
                  value={quickPayReference}
                  onChange={(e) => setQuickPayReference(e.target.value)}
                  placeholder="Optional reference ID or check number"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Remarks / Purpose
                </label>
                <textarea
                  rows={2}
                  value={quickPayRemarks}
                  onChange={(e) => setQuickPayRemarks(e.target.value)}
                  placeholder="e.g. Welfare scheme disbursement, constituency development fund..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-telugu"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickPaymentModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickPay}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmittingQuickPay ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Record Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL RECEIPT VOUCHER MODAL */}
      {viewReceiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Official Payment Voucher · {viewReceiptPayment.transaction_id}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Receipt #{viewReceiptPayment.receipt_number} · Status: {viewReceiptPayment.payment_status}
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
                  onClick={() => setViewReceiptPayment(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loadingReceipt ? (
              <div className="py-16 text-center text-xs text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                Generating official receipt...
              </div>
            ) : receiptData ? (
              <div
                id="printable-receipt"
                className="mt-4 p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/40 dark:bg-slate-800/20 relative space-y-4"
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

                {/* Numbers */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 block">RECEIPT NO</span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200">{receiptData.receipt_number}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">TRANSACTION REF</span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200">{receiptData.transaction_id}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">DATE OF DISBURSEMENT</span>
                    <span className="text-slate-700 dark:text-slate-300">{receiptData.payment_date}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">PAYMENT MODE</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">{receiptData.payment_method}</span>
                  </div>
                </div>

                {/* Beneficiary Details */}
                <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-brand-600 dark:text-brand-400">
                    Beneficiary Voter Information (లబ్ధిదారుని వివరాలు)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10px]">Voter Name:</span>{' '}
                      <strong className="text-slate-900 dark:text-slate-100 font-telugu">{receiptData.voter.voter_name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">EPIC No:</span>{' '}
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{receiptData.voter.epic_no}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Relation:</span>{' '}
                      <span className="font-telugu">{receiptData.voter.relation_name} ({receiptData.voter.relation_type})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">House No:</span>{' '}
                      <span className="font-mono">{receiptData.voter.house_no}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Area / Village:</span>{' '}
                      <span className="font-telugu">{receiptData.voter.area}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Constituency:</span>{' '}
                      <span className="font-telugu">{receiptData.voter.constituency}, {receiptData.voter.district}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-brand-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Amount Received / Disbursed
                  </span>
                  <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono my-1">
                    {receiptData.amount_formatted}
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 italic">
                    "{receiptData.amount_in_words}"
                  </p>
                </div>

                {/* Audit & Disclaimer */}
                <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <span>Issued by: {receiptData.creator.name} (@{receiptData.creator.username})</span>
                  <span>Jurisdiction: {receiptData.organization.jurisdiction}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Edit Voter Entry #{editingEntry.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-400 rounded-xl text-xs">
                {editError}
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Entry Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500 font-telugu"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Confirm Delete Entry
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete entry of <strong className="font-mono text-slate-700 dark:text-slate-300">₹{deletingEntry.amount}</strong> for voter <strong className="text-slate-700 dark:text-slate-300">{selectedVoter?.voter_name}</strong>?
            </p>

            <div className="pt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeletingEntry(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEntry}
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
