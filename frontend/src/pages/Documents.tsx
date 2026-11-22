import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Files,
  FileText,
  UploadCloud,
  RefreshCw,
  Search,
  Filter,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Users,
  HardDrive,
  Eye,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  X,
  FileDown,
  Building,
  MapPin,
  Calendar,
  Layers,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { documentService } from '../services/documentService';
import { useAuth } from '../contexts/AuthContext';
import {
  DocumentItem,
  DocumentSummary,
  DocumentDeletionPreview,
  VoterRecord,
  VoterRecordsResponse
} from '../types/document';
import { formatBytes, formatDate } from '../utils/formatters';

export const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  // Documents & Summary State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [summary, setSummary] = useState<DocumentSummary>({
    total_documents: 0,
    completed_documents: 0,
    processing_documents: 0,
    failed_documents: 0,
    total_voters: 0,
    total_storage_bytes: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination & Sorting State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [sortBy, setSortBy] = useState<string>('uploaded_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [constituencyFilter, setConstituencyFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Document Details Modal State
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [loadingDocDetails, setLoadingDocDetails] = useState<boolean>(false);
  const [docVoters, setDocVoters] = useState<VoterRecord[]>([]);
  const [docVotersTotal, setDocVotersTotal] = useState<number>(0);
  const [docVotersPage, setDocVotersPage] = useState<number>(1);
  const [docVotersQuery, setDocVotersQuery] = useState<string>('');

  // Cascade Deletion Modal State
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [deletionPreview, setDeletionPreview] = useState<DocumentDeletionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);

  // Reprocess State
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Load Documents from API
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentService.getDocumentsExtended({
        query: appliedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        district: districtFilter || undefined,
        constituency: constituencyFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        order: sortOrder,
        page,
        limit,
      });

      setDocuments(res.documents || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.pages || 1);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to fetch documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [page, limit, appliedSearch, statusFilter, districtFilter, constituencyFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // Handle Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchQuery);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setAppliedSearch('');
    setStatusFilter('all');
    setDistrictFilter('');
    setConstituencyFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // Copy Document ID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Document Details View
  const handleOpenDetails = async (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setDocVotersPage(1);
    setDocVotersQuery('');
    setLoadingDocDetails(true);
    try {
      const res = await documentService.getDocumentRecords(doc.id, {
        page: 1,
        limit: 10,
      });
      setDocVoters(res.records || []);
      setDocVotersTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to fetch document voter records:', err);
    } finally {
      setLoadingDocDetails(false);
    }
  };

  // Page change within document voter records
  const handleDocVoterPageChange = async (newPage: number) => {
    if (!selectedDoc) return;
    setDocVotersPage(newPage);
    try {
      const res = await documentService.getDocumentRecords(selectedDoc.id, {
        page: newPage,
        limit: 10,
        query: docVotersQuery || undefined,
      });
      setDocVoters(res.records || []);
      setDocVotersTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  // Search within document voter records
  const handleDocVoterSearch = async (q: string) => {
    if (!selectedDoc) return;
    setDocVotersQuery(q);
    setDocVotersPage(1);
    try {
      const res = await documentService.getDocumentRecords(selectedDoc.id, {
        page: 1,
        limit: 10,
        query: q || undefined,
      });
      setDocVoters(res.records || []);
      setDocVotersTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  // Open Cascade Deletion Modal
  const handleInitiateDelete = async (doc: DocumentItem) => {
    setDeleteTarget(doc);
    setConfirmCheckbox(false);
    setDeleteErrorMsg(null);
    setLoadingPreview(true);
    try {
      const preview = await documentService.getDeletionPreview(doc.id);
      setDeletionPreview(preview);
    } catch (err: any) {
      console.error('Failed to load deletion preview:', err);
      setDeleteErrorMsg(err.response?.data?.detail || 'Failed to inspect cascade dependencies.');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Execute Cascade Deletion
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteErrorMsg(null);
    try {
      const res = await documentService.deleteDocument(deleteTarget.id);
      setDeleteSuccessMsg(res.message || 'Document and exclusive voter records deleted successfully.');
      setTimeout(() => setDeleteSuccessMsg(null), 5000);
      setDeleteTarget(null);
      setDeletionPreview(null);
      await fetchDocuments();
    } catch (err: any) {
      console.error('Document deletion failed:', err);
      setDeleteErrorMsg(err.response?.data?.detail || err.message || 'Deletion failed. Check database logs.');
    } finally {
      setDeleting(false);
    }
  };

  // Reprocess Document
  const handleReprocess = async (docId: string, filename: string) => {
    if (!confirm(`Are you sure you want to reprocess '${filename}'? This will re-extract all voter records.`)) {
      return;
    }
    setReprocessingId(docId);
    setActionNotice(null);
    try {
      const res = await documentService.reprocessDocument(docId);
      setActionNotice(res.message || `Reprocessing started for ${filename}.`);
      setTimeout(() => setActionNotice(null), 5000);
      await fetchDocuments();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to trigger reprocessing.');
    } finally {
      setReprocessingId(null);
    }
  };

  // Download Document
  const handleDownload = async (docId: string, filename: string) => {
    try {
      await documentService.downloadDocument(docId, filename);
    } catch (err) {
      alert('Failed to download document from server.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[11px] font-semibold tracking-wide text-brand-200">
              <Files className="w-3.5 h-3.5 text-brand-300" />
              <span>Document Repository & Lifecycle Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              All Uploaded Documents
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-telugu">
              సిస్టమ్‌లో అప్‌లోడ్ చేసిన అన్ని ఓటర్ రోల్స్, ప్రాసెసింగ్ స్థితి, వెలికితీసిన ఓటర్లు మరియు సురక్షిత క్యాస్కేడ్ డిలీట్ నిర్వహణ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fetchDocuments()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl text-xs font-bold transition-all border border-white/10"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => navigate('/upload')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/20 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Voter Document</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {deleteSuccessMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccessMsg}</span>
          </div>
          <button onClick={() => setDeleteSuccessMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionNotice && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl flex items-center gap-2 text-xs font-semibold shadow-xs">
          <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 6 Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400">Total Documents</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Files className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {summary.total_documents.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">In database</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Processed</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
            {summary.completed_documents.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">Extracted & ready</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Processing</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300">
            {summary.processing_documents.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">In queue / parsing</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Failed</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertOctagon className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-rose-700 dark:text-rose-300">
            {summary.failed_documents.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">Requires review</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Extracted Voters</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300">
            {summary.total_voters.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400">Active directory</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">Storage Used</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-purple-700 dark:text-purple-300 truncate">
            {formatBytes(summary.total_storage_bytes)}
          </p>
          <span className="text-[10px] text-slate-400">Uploaded PDFs</span>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          {/* Main Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Document Name, Document ID, District, Constituency, Area / Village..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Granular Filter Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Processing Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="uploaded">Uploaded / Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                District (జిల్లా)
              </label>
              <input
                type="text"
                value={districtFilter}
                onChange={(e) => {
                  setDistrictFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by district..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Constituency (నియోజకవర్గం)
              </label>
              <input
                type="text"
                value={constituencyFilter}
                onChange={(e) => {
                  setConstituencyFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by constituency..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Upload Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Upload Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </form>
      </div>

      {/* Documents Table Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Top Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Uploaded Documents Directory
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {totalCount.toLocaleString()} {totalCount === 1 ? 'file' : 'files'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Show</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>entries</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100"
              >
                <option value="uploaded_at">Upload Date</option>
                <option value="original_filename">File Name</option>
                <option value="file_size">File Size</option>
                <option value="total_pages">Total Pages</option>
                <option value="district">District</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-3 w-12 text-center">S.No.</th>
                <th className="py-3 px-3">Document ID</th>
                <th className="py-3 px-3">Document Name</th>
                <th className="py-3 px-2">Type</th>
                <th className="py-3 px-3">Size</th>
                <th className="py-3 px-3">District</th>
                <th className="py-3 px-3">Constituency</th>
                <th className="py-3 px-3">Area / Village</th>
                <th className="py-3 px-2 text-center">Pages</th>
                <th className="py-3 px-3 text-center">Extracted Voters</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Uploaded By</th>
                <th className="py-3 px-3">Upload Date</th>
                <th className="py-3 px-3 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-brand-600" />
                    <span>Loading documents from PostgreSQL database...</span>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <Files className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No documents found
                      </h4>
                      <p className="text-xs text-slate-400">
                        {appliedSearch || statusFilter !== 'all'
                          ? 'No documents matched your search and filter criteria. Try resetting filters.'
                          : 'No voter documents have been uploaded yet. Upload your first Telugu PDF electoral roll to get started.'}
                      </p>
                      <button
                        onClick={() => navigate('/upload')}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        Upload Voter Document
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                documents.map((doc, idx) => {
                  const sNo = (page - 1) * limit + idx + 1;
                  const isProcessing = doc.status === 'processing' || doc.status === 'uploaded';
                  const isCompleted = doc.status === 'completed';
                  const isFailed = doc.status === 'failed';

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* S.No. */}
                      <td className="py-3 px-3 text-center text-slate-400 font-medium">
                        {sNo}
                      </td>

                      {/* Document ID with Copy */}
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleCopyId(doc.id)}
                          className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 font-medium transition-colors group"
                          title="Click to copy full Document ID"
                        >
                          <span>{doc.id.substring(0, 8)}...</span>
                          {copiedId === doc.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </td>

                      {/* Document Name */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(doc)}
                            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 truncate text-left transition-colors"
                            title={doc.original_filename || doc.filename}
                          >
                            {doc.original_filename || doc.filename}
                          </button>
                        </div>
                      </td>

                      {/* File Type */}
                      <td className="py-3 px-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/50">
                          {doc.file_type || 'PDF'}
                        </span>
                      </td>

                      {/* File Size */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {formatBytes(doc.file_size)}
                      </td>

                      {/* District */}
                      <td className="py-3 px-3 max-w-[130px] truncate text-slate-800 dark:text-slate-200" title={doc.district}>
                        {doc.district || 'Not Available'}
                      </td>

                      {/* Constituency */}
                      <td className="py-3 px-3 max-w-[130px] truncate text-slate-800 dark:text-slate-200" title={doc.constituency}>
                        {doc.constituency || 'Not Available'}
                      </td>

                      {/* Area / Village */}
                      <td className="py-3 px-3 max-w-[130px] truncate text-slate-800 dark:text-slate-200" title={doc.area}>
                        {doc.area || 'Not Available'}
                      </td>

                      {/* Pages */}
                      <td className="py-3 px-2 text-center text-slate-600 dark:text-slate-400">
                        {doc.total_pages || doc.page_count || 0}
                      </td>

                      {/* Extracted Voters Badge */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                          <Users className="w-3 h-3 text-indigo-500" />
                          {(doc.extracted_voters ?? doc.records_count ?? 0).toLocaleString()}
                        </span>
                      </td>

                      {/* Processing Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                              : isFailed
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : isFailed ? (
                            <AlertOctagon className="w-3 h-3 text-rose-600" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                          )}
                          {doc.status}
                        </span>
                      </td>

                      {/* Uploaded By */}
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[110px]" title={doc.uploader_name || 'System'}>
                        @{doc.uploader_name || 'admin'}
                      </td>

                      {/* Upload Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        {formatDate(doc.uploaded_at || doc.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(doc)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="View Document Details & Extracted Voters"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download Original PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownload(doc.id, doc.original_filename || doc.filename)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            title="Download Original PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Reprocess */}
                          <button
                            type="button"
                            onClick={() => handleReprocess(doc.id, doc.original_filename || doc.filename)}
                            disabled={reprocessingId === doc.id || isProcessing}
                            className={`p-1.5 rounded-lg transition-colors ${
                              reprocessingId === doc.id
                                ? 'text-amber-500 animate-spin'
                                : 'text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            }`}
                            title="Reprocess Document"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>

                          {/* Delete Document with Cascade */}
                          <button
                            type="button"
                            onClick={() => handleInitiateDelete(doc)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Delete Document & Cascaded Voters"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalCount > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.min(page * limit, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount.toLocaleString()}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DOCUMENT DETAILS MODAL */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Files className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate max-w-lg">
                    {selectedDoc.original_filename || selectedDoc.filename}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedDoc.id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(selectedDoc.id, selectedDoc.original_filename || selectedDoc.filename)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Information & Processing Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Document Information */}
              <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-brand-600" />
                  <span>Document Information</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">File Size</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatBytes(selectedDoc.file_size)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">File Type</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedDoc.file_type || 'PDF Document'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">District (జిల్లా)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedDoc.district || 'Not Available'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Constituency (నియోజకవర్గం)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedDoc.constituency || 'Not Available'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Area / Village</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedDoc.area || 'Not Available'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Ward Number</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedDoc.ward_number || 'Not Available'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Uploaded By</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      @{selectedDoc.uploader_name || 'admin'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Upload Timestamp</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(selectedDoc.uploaded_at || selectedDoc.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Processing Information */}
              <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Processing & Extraction Details</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Total Pages</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedDoc.total_pages || selectedDoc.page_count || 0} pages
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Processing Status</span>
                    <span className="font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      {selectedDoc.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Linked Voter Records</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {(selectedDoc.extracted_voters ?? docVotersTotal ?? 0).toLocaleString()} voters
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Server File Status</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedDoc.file_exists_on_disk !== false ? 'Verified on Disk' : 'Missing on Disk'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Processing Completed At</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedDoc.processed_at ? formatDate(selectedDoc.processed_at) : 'In Progress / Pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">OCR / Extraction Engine</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Tesseract Telugu + Layout Analysis
                    </span>
                  </div>
                </div>
                {selectedDoc.processing_error && (
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-lg text-rose-700 dark:text-rose-300 text-[11px]">
                    <span className="font-bold">Error:</span> {selectedDoc.processing_error}
                  </div>
                )}
              </div>
            </div>

            {/* Related Voter Records Table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Voters Extracted Exclusively from this Document
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    {docVotersTotal.toLocaleString()} voters
                  </span>
                </div>

                {/* Sub-search */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={docVotersQuery}
                    onChange={(e) => handleDocVoterSearch(e.target.value)}
                    placeholder="Search voter by Name, EPIC ID..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 text-[11px] font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">S.No.</th>
                        <th className="py-2.5 px-3">Voter ID / EPIC</th>
                        <th className="py-2.5 px-3">Voter Name</th>
                        <th className="py-2.5 px-3">Relation Name</th>
                        <th className="py-2.5 px-2 text-center">Age</th>
                        <th className="py-2.5 px-2 text-center">Gender</th>
                        <th className="py-2.5 px-3">House No</th>
                        <th className="py-2.5 px-2 text-center">Serial No</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loadingDocDetails ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                            <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-1 text-brand-600" />
                            <span>Loading linked voter records...</span>
                          </td>
                        </tr>
                      ) : docVoters.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                            No voter records extracted or matching this query.
                          </td>
                        </tr>
                      ) : (
                        docVoters.map((voter, vIdx) => {
                          const vSno = (docVotersPage - 1) * 10 + vIdx + 1;
                          return (
                            <tr key={voter.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="py-2 px-3 text-center text-slate-400">{vSno}</td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                                {voter.voter_id || 'Not Available'}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 font-telugu">
                                {voter.voter_name}
                              </td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-telugu">
                                {voter.relation_name} ({voter.relation_type || 'Rel'})
                              </td>
                              <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">{voter.age}</td>
                              <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">{voter.gender}</td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{voter.house_no}</td>
                              <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">{voter.serial_no}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDoc(null);
                                    navigate(`/voter-entries?epic=${encodeURIComponent(voter.voter_id)}`);
                                  }}
                                  className="px-2 py-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                                >
                                  <span>Manage</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Sub-pagination */}
                {docVotersTotal > 10 && (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Showing {(docVotersPage - 1) * 10 + 1} to {Math.min(docVotersPage * 10, docVotersTotal)} of {docVotersTotal} voters
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDocVoterPageChange(docVotersPage - 1)}
                        disabled={docVotersPage <= 1}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <span className="font-bold px-1">
                        {docVotersPage} / {Math.ceil(docVotersTotal / 10)}
                      </span>
                      <button
                        onClick={() => handleDocVoterPageChange(docVotersPage + 1)}
                        disabled={docVotersPage >= Math.ceil(docVotersTotal / 10)}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Close */}
            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASCADE DELETION CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            {/* Header Alert */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete Document & Cascade Voter Records
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                  Critical Warning: Irreversible Database Cascade Deletion
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeletionPreview(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Text as per Prompt Requirement */}
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs text-rose-900 dark:text-rose-200 leading-relaxed space-y-2">
              <p className="font-semibold">
                Are you sure you want to delete this document?
              </p>
              <p className="text-[11px] text-rose-800 dark:text-rose-300">
                Deleting this document will also delete all voter records extracted exclusively from this document. This action will also remove associated document processing data. Please confirm before continuing.
              </p>
            </div>

            {/* Deletion Preview Statistics */}
            {loadingPreview ? (
              <div className="py-4 text-center text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 mx-auto animate-spin mb-1 text-rose-500" />
                <span>Computing deletion preview & dependency impact...</span>
              </div>
            ) : deletionPreview ? (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-500">Document Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={deletionPreview.document_name}>
                    {deletionPreview.document_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Document ID</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                    {deletionPreview.document_id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Linked Voters to be Deleted</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-xs">
                    {deletionPreview.voters_count.toLocaleString()} voters
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Associated Processing Pages</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {deletionPreview.processing_records_count} pages
                  </span>
                </div>

                {/* Statutory Financial Retention Guarantee */}
                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-start gap-2 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Financial Retention Policy:</strong> {deletionPreview.payments_count} payment record(s) and audit trails will be permanently preserved in the financial ledger.
                  </span>
                </div>
              </div>
            ) : null}

            {deleteErrorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {deleteErrorMsg}
              </div>
            )}

            {/* Explicit Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmCheckbox}
                onChange={(e) => setConfirmCheckbox(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
              />
              <span className="font-medium">
                I understand that deleting this document will permanently remove its extracted voter records and processing data from the database.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeletionPreview(null);
                }}
                disabled={deleting}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!confirmCheckbox || deleting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting & Cascading...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Cascade Deletion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
