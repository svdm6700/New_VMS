import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Copy,
  Check,
  Printer,
  TableProperties,
  AlertCircle,
  MapPin,
  CreditCard,
  DollarSign,
  Camera,
  CheckCircle2,
  AlertTriangle,
  User,
  Image as ImageIcon,
  Eye,
  X
} from 'lucide-react';
import { VoterRecord, DocumentItem } from '../../types/document';
import { documentService } from '../../services/documentService';
import { EditVoterRecordModal } from './EditVoterRecordModal';
import { PdfPreviewModal } from './PdfPreviewModal';

interface VoterRecordsTableProps {
  initialDocumentId?: string;
  documents?: DocumentItem[];
  onDocumentChange?: (docId: string) => void;
}

export const VoterRecordsTable: React.FC<VoterRecordsTableProps> = ({
  initialDocumentId,
  documents = [],
  onDocumentChange,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocumentId || '');
  const [records, setRecords] = useState<VoterRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [constituencyFilter, setConstituencyFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [wardFilter, setWardFilter] = useState('all');
  const [photoFilter, setPhotoFilter] = useState('all');
  const [pageFilter, setPageFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Photo Preview & Manual Verification Modal State
  const [previewPhotoVoter, setPreviewPhotoVoter] = useState<VoterRecord | null>(null);
  const [verifyingPhotoId, setVerifyingPhotoId] = useState<number | null>(null);

  // Active document for location header
  const activeDocument = documents.find((d) => d.id === selectedDocId) || (documents.length > 0 ? documents[0] : null);

  const uniqueDistricts = Array.from(new Set(documents.map((d) => d.district).filter(Boolean))) as string[];
  const uniqueConstituencies = Array.from(new Set(documents.map((d) => d.constituency).filter(Boolean))) as string[];
  const uniqueAreas = Array.from(new Set(documents.map((d) => d.area).filter(Boolean))) as string[];
  const uniqueWards = Array.from(new Set(documents.map((d) => d.ward_number).filter(Boolean))) as string[];

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<VoterRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Copy Feedback State
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Voter Selection State (Multi-Select for PDF Generation)
  const [selectedVoterIds, setSelectedVoterIds] = useState<number[]>([]);

  // PDF Preview Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfTitle, setPdfTitle] = useState('A4 Voter List PDF Preview');
  const [pdfFilename, setPdfFilename] = useState('voter_list.pdf');
  const [pdfLoading, setPdfLoading] = useState(false);

  // Export Dropdown State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentService.getVoterRecords({
        page,
        limit,
        document_id: selectedDocId || undefined,
        query: searchQuery.trim() || undefined,
        gender: genderFilter !== 'all' ? genderFilter : undefined,
        district: districtFilter !== 'all' ? districtFilter : undefined,
        constituency: constituencyFilter !== 'all' ? constituencyFilter : undefined,
        area: areaFilter !== 'all' ? areaFilter : undefined,
        ward_number: wardFilter !== 'all' ? wardFilter : undefined,
        image_matching_status: photoFilter !== 'all' ? photoFilter : undefined,
        source_page: pageFilter ? parseInt(pageFilter) : undefined,
        sort_by: sortBy,
        order: sortOrder,
      });

      setRecords(res.records || []);
      setTotalRecords(res.total || 0);
      setTotalPages(res.pages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load records from database.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedDocId, searchQuery, genderFilter, districtFilter, constituencyFilter, areaFilter, wardFilter, photoFilter, pageFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Update selected doc if prop changes
  useEffect(() => {
    if (initialDocumentId !== undefined) {
      setSelectedDocId(initialDocumentId);
      setPage(1);
    }
  }, [initialDocumentId]);

  const handleDocChange = (docId: string) => {
    setSelectedDocId(docId);
    setPage(1);
    if (onDocumentChange) {
      onDocumentChange(docId);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleDeleteRecord = async (id: number) => {
    if (!window.confirm(`Are you sure you want to delete voter record #${id}?`)) return;
    try {
      await documentService.deleteVoterRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotalRecords((prev) => Math.max(0, prev - 1));
      setSelectedVoterIds((prev) => prev.filter((item) => item !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete record.');
    }
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageIds = records.map((r) => r.id);
      setSelectedVoterIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIdSet = new Set(records.map((r) => r.id));
      setSelectedVoterIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
    }
  };

  const handleToggleVoter = (id: number) => {
    setSelectedVoterIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllPageSelected = records.length > 0 && records.every((r) => selectedVoterIds.includes(r.id));
  const isSomePageSelected = records.some((r) => selectedVoterIds.includes(r.id)) && !isAllPageSelected;

  const handleUpdatePhotoStatus = async (voterId: number, newStatus: string, notes?: string) => {
    setVerifyingPhotoId(voterId);
    try {
      await documentService.verifyVoterPhotoStatus(voterId, newStatus, notes);
      setRecords((prev) =>
        prev.map((r) => (r.id === voterId ? { ...r, image_matching_status: newStatus } : r))
      );
      if (previewPhotoVoter && previewPhotoVoter.id === voterId) {
        setPreviewPhotoVoter((prev) => (prev ? { ...prev, image_matching_status: newStatus } : null));
      }
    } catch (err: any) {
      alert(`Failed to update photo verification status: ${err.message || err}`);
    } finally {
      setVerifyingPhotoId(null);
    }
  };

  // PDF Generation Handlers (A4, 27 Voters per Page, 3x9 Grid)
  const handlePrintIndividualVoterPdf = async (voter: VoterRecord) => {
    const key = voter.unique_key || voter.voter_id || String(voter.id);
    setPdfTitle(`ఓటరు రికార్డు PDF - ${voter.voter_name} (${key})`);
    setPdfFilename(`voter_${key}.pdf`);
    setPdfLoading(true);
    setIsPdfModalOpen(true);
    try {
      const blob = await documentService.getIndividualVoterPdf(voter.id);
      setPdfBlob(blob);
    } catch (err: any) {
      alert(`Failed to generate individual voter PDF: ${err.message || err}`);
      setIsPdfModalOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleGenerateSelectedPdf = async () => {
    if (selectedVoterIds.length === 0) {
      alert('దయచేసి PDF తయారీ కోసం కనీసం ఒక ఓటరును ఎంచుకోండి (Please select at least one voter).');
      return;
    }
    setPdfTitle(`ఎంపిక చేసిన ఓటర్ల A4 జాబితా PDF (${selectedVoterIds.length} ఓటర్లు)`);
    setPdfFilename(`voters_selected_${selectedVoterIds.length}.pdf`);
    setPdfLoading(true);
    setIsPdfModalOpen(true);
    try {
      const blob = await documentService.getSelectedVotersPdf(selectedVoterIds);
      setPdfBlob(blob);
    } catch (err: any) {
      alert(`Failed to generate selected voters PDF: ${err.message || err}`);
      setIsPdfModalOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleGenerateCompletePdf = async () => {
    setPdfTitle(`సంపూర్ణ ఓటర్ల జాబితా A4 PDF (${totalRecords.toLocaleString()} ఓటర్లు)`);
    const docPrefix = selectedDocId ? `doc_${selectedDocId.slice(0, 8)}` : 'all_voters';
    setPdfFilename(`voter_list_${docPrefix}.pdf`);
    setPdfLoading(true);
    setIsPdfModalOpen(true);
    try {
      const blob = await documentService.getCompleteVoterListPdf({
        district: districtFilter !== 'all' ? districtFilter : undefined,
        constituency: constituencyFilter !== 'all' ? constituencyFilter : undefined,
        area: areaFilter !== 'all' ? areaFilter : undefined,
        ward_number: wardFilter !== 'all' ? wardFilter : undefined,
        document_id: selectedDocId || undefined,
        query: searchQuery.trim() || undefined,
        gender: genderFilter !== 'all' ? genderFilter : undefined,
      });
      setPdfBlob(blob);
    } catch (err: any) {
      alert(`Failed to generate complete voter list PDF: ${err.message || err}`);
      setIsPdfModalOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      if (!selectedDocId && documents.length > 0) {
        // Export current first document
        const targetId = documents[0].id;
        const blob = await documentService.exportDocumentExcel(targetId);
        downloadBlob(blob, `telugu_voter_records_${targetId.slice(0, 8)}.xlsx`);
      } else if (selectedDocId) {
        const blob = await documentService.exportDocumentExcel(selectedDocId);
        const docName = documents.find((d) => d.id === selectedDocId)?.filename || 'voter_records';
        downloadBlob(blob, `${docName.replace('.pdf', '')}_Voter_List.xlsx`);
      } else {
        alert('Please select a document to export.');
      }
    } catch (err: any) {
      alert(`Excel Export Failed: ${err.message}`);
    }
  };

  const handleExportCsv = async () => {
    try {
      if (!selectedDocId && documents.length > 0) {
        const targetId = documents[0].id;
        const blob = await documentService.exportDocumentCsv(targetId);
        downloadBlob(blob, `telugu_voter_records_${targetId.slice(0, 8)}.csv`);
      } else if (selectedDocId) {
        const blob = await documentService.exportDocumentCsv(selectedDocId);
        const docName = documents.find((d) => d.id === selectedDocId)?.filename || 'voter_records';
        downloadBlob(blob, `${docName.replace('.pdf', '')}_Voter_List.csv`);
      } else {
        alert('Please select a document to export.');
      }
    } catch (err: any) {
      alert(`CSV Export Failed: ${err.message}`);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const copyRow = (r: VoterRecord) => {
    const text = [
      `గ్రా.పం.ఓ.జా.వ.సం.: ${r.serial_no}`,
      `అ.ఓ.జా.వ.సం.: ${r.electoral_roll_no}`,
      `ఓటరు పేరు: ${r.voter_name}`,
      `సంబంధం: ${r.relation_type} - ${r.relation_name}`,
      `వయస్సు: ${r.age}`,
      `లింగము: ${r.gender}`,
      `ఇంటి సంఖ్య: ${r.house_no}`,
      `ఓటరు ఐడి: ${r.voter_id}`,
      `మూల PDF పుట: ${r.source_page}`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllVisible = () => {
    if (!records.length) return;
    const header = "గ్రా.పం.ఓ.జా.వ.సం.\tఅ.ఓ.జా.వ.సం.\tఓటరు పేరు\tసంబంధం\tసంబంధిత వ్యక్తి పేరు\tవయస్సు\tలింగము\tఇంటి సంఖ్య\tఓటరు ఐడి\tపుట";
    const rows = records.map(r => 
      `${r.serial_no}\t${r.electoral_roll_no}\t${r.voter_name}\t${r.relation_type}\t${r.relation_name}\t${r.age}\t${r.gender}\t${r.house_no}\t${r.voter_id}\t${r.source_page}`
    );
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 inline ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-brand-600 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-brand-600 inline ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        {/* Top Row: Title, Records Badge & Exports */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 rounded-xl">
                <TableProperties className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-telugu">
                ఓటర్ల జాబితా డేటాబేస్ రికార్డులు (Voter Records Database)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-900">
                {totalRecords.toLocaleString()} Records
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Exact 10-column structured Telugu electoral data extracted and stored persistently in database.
            </p>
          </div>

          {/* Action Toolbar - Single Clean Row */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            {/* Complete Voter List PDF */}
            <button
              onClick={handleGenerateCompletePdf}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              title="Generate complete A4 PDF for all filtered voter records (27 voters per page)"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Complete PDF</span>
            </button>

            {/* Selected Voters PDF Button - appears when items are selected */}
            {selectedVoterIds.length > 0 && (
              <button
                onClick={handleGenerateSelectedPdf}
                disabled={pdfLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-indigo-500/20 animate-in fade-in"
                title="Generate print-ready A4 PDF for selected voters"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Selected ({selectedVoterIds.length})</span>
              </button>
            )}

            {/* Unified Export Menu */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl text-xs font-bold transition-all"
                title="Export or copy data in various formats"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportExcel();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-2.5 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Export Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportCsv();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2.5 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Export CSV (.csv)</span>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      copyAllVisible();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                  >
                    {copiedAll ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    <span>{copiedAll ? 'Copied to Clipboard!' : 'Copy Page to Clipboard'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Print Button */}
            <button
              onClick={() => window.print()}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Print Current Table View"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Selected Voters Action Banner */}
        {selectedVoterIds.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
              <span className="font-bold text-indigo-950 dark:text-indigo-200">
                {selectedVoterIds.length} voter{selectedVoterIds.length === 1 ? '' : 's'} selected for PDF generation
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateSelectedPdf}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                Generate Selected PDF ({selectedVoterIds.length})
              </button>
              <button
                onClick={() => setSelectedVoterIds([])}
                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Location Banner (Showing selected or active document location details) */}
        {activeDocument && (activeDocument.district || activeDocument.area) && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-900/50 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-brand-600 text-white">
                <MapPin className="w-3.5 h-3.5" />
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-telugu">
                ప్రాంత వివరాలు (Jurisdiction):
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-medium text-slate-700 dark:text-slate-300 text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <strong>జిల్లా:</strong> {activeDocument.district || 'Not Available'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <strong>నియోజకవర్గం:</strong> {activeDocument.constituency || 'Not Available'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <strong>గ్రామం/ప్రాంతం:</strong> {activeDocument.area || 'Not Available'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <strong>వార్డు:</strong> {activeDocument.ward_number || 'Not Available'}
              </span>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Document Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Document</label>
            <select
              value={selectedDocId}
              onChange={(e) => handleDocChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">All Uploaded Documents</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename} ({d.records_count ?? 0} records)
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search Records</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search voter name, ID, house no, relative..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Gender (లింగము)</label>
            <select
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="all">All Genders</option>
              <option value="స్త్రీ">స్త్రీ (Female)</option>
              <option value="పురుషుడు">పురుషుడు (Male)</option>
            </select>
          </div>

          {/* Photo Match Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Photo (ఫొటో స్థితి)</label>
            <select
              value={photoFilter}
              onChange={(e) => {
                setPhotoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="all">All Photos</option>
              <option value="MATCHED">Matched (సరిపోలినవి)</option>
              <option value="NEEDS_VERIFICATION">Needs Verification (సమీక్ష)</option>
              <option value="MISSING">Missing (లేనివి)</option>
            </select>
          </div>

          {/* Page Filter & Refresh */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">PDF Page (పుట)</label>
              <input
                type="number"
                placeholder="Page #"
                value={pageFilter}
                onChange={(e) => {
                  setPageFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <button
              onClick={() => fetchRecords()}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Location Filters Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            <span>Filter Location:</span>
          </span>

          {/* District Filter */}
          <select
            value={districtFilter}
            onChange={(e) => {
              setDistrictFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="all">All Districts (జిల్లాలు)</option>
            {uniqueDistricts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Constituency Filter */}
          <select
            value={constituencyFilter}
            onChange={(e) => {
              setConstituencyFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="all">All Constituencies (నియోజకవర్గాలు)</option>
            {uniqueConstituencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Area Filter */}
          <select
            value={areaFilter}
            onChange={(e) => {
              setAreaFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="all">All Areas / Villages (గ్రామాలు)</option>
            {uniqueAreas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Ward Filter */}
          <select
            value={wardFilter}
            onChange={(e) => {
              setWardFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="all">All Wards (వార్డులు)</option>
            {uniqueWards.map((w) => (
              <option key={w} value={w}>Ward {w}</option>
            ))}
          </select>

          {(districtFilter !== 'all' || constituencyFilter !== 'all' || areaFilter !== 'all' || wardFilter !== 'all') && (
            <button
              onClick={() => {
                setDistrictFilter('all');
                setConstituencyFilter('all');
                setAreaFilter('all');
                setWardFilter('all');
                setPage(1);
              }}
              className="px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Table Display */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        {error && (
          <div className="flex items-center gap-2 p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-b border-rose-200 dark:border-rose-900 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Container with sticky header */}
        <div className="overflow-x-auto max-h-[600px] divide-y divide-slate-100 dark:divide-slate-800">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 shadow-xs backdrop-blur-xs">
              <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomePageSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    title={isAllPageSelected ? 'Deselect all on page' : 'Select all on page'}
                  />
                </th>
                <th
                  onClick={() => handleSort('unique_key')}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 w-28 whitespace-nowrap"
                >
                  యూనిక్ కీ {renderSortIcon('unique_key')}
                </th>
                <th
                  onClick={() => handleSort('serial_no')}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 w-24 whitespace-nowrap"
                >
                  గ్రా.పం.ఓ.జా.వ.సం. {renderSortIcon('serial_no')}
                </th>
                <th
                  onClick={() => handleSort('electoral_roll_no')}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 w-32 whitespace-nowrap"
                >
                  అ.ఓ.జా.వ.సం. {renderSortIcon('electoral_roll_no')}
                </th>
                <th className="px-2 py-3 text-center w-24">ఫొటో (Photo)</th>
                <th
                  onClick={() => handleSort('voter_name')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 min-w-[160px]"
                >
                  ఓటరు పేరు (Voter Name) {renderSortIcon('voter_name')}
                </th>
                <th className="px-3 py-3 w-28">సంబంధం</th>
                <th
                  onClick={() => handleSort('relation_name')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 min-w-[160px]"
                >
                  సంబంధిత వ్యక్తి పేరు {renderSortIcon('relation_name')}
                </th>
                <th
                  onClick={() => handleSort('age')}
                  className="px-2 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 text-center w-16"
                >
                  వయస్సు {renderSortIcon('age')}
                </th>
                <th
                  onClick={() => handleSort('gender')}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 text-center w-20"
                >
                  లింగము {renderSortIcon('gender')}
                </th>
                <th
                  onClick={() => handleSort('house_no')}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 w-24"
                >
                  ఇంటి సంఖ్య {renderSortIcon('house_no')}
                </th>
                <th
                  onClick={() => handleSort('voter_id')}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 w-32 font-mono"
                >
                  ఓటరు ఐడి కార్డు నెం. {renderSortIcon('voter_id')}
                </th>
                <th
                  onClick={() => handleSort('source_page')}
                  className="px-2 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-700/50 text-center w-16"
                >
                  పుట {renderSortIcon('source_page')}
                </th>
                <th className="px-3 py-3 text-center w-28">చర్యలు</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-800 dark:text-slate-200">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading voter records from database...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No voter records found.</p>
                    <p className="text-xs mt-1">Upload a Telugu PDF to extract and store records automatically.</p>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group ${
                      selectedVoterIds.includes(r.id) ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedVoterIds.includes(r.id)}
                        onChange={() => handleToggleVoter(r.id)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                        title={`Select ${r.voter_name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 tracking-wider shadow-2xs cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                        title="Permanent 5-character Unique Key. Click to copy."
                        onClick={() => {
                          if (r.unique_key) {
                            navigator.clipboard.writeText(r.unique_key);
                            setCopiedId(r.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }
                        }}
                      >
                        {r.unique_key || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {r.serial_no}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">
                      {r.electoral_roll_no}
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <div
                        className="inline-flex flex-col items-center gap-1 cursor-pointer group/photo"
                        onClick={() => setPreviewPhotoVoter(r)}
                        title="Click to preview photograph & spatial mapping details"
                      >
                        <div className="w-8 h-10 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center relative group-hover/photo:border-brand-500 transition-colors">
                          {r.has_photo || r.photo_url || r.photo_path ? (
                            <img
                              src={r.photo_url || `/api/voters/${r.unique_key || r.id}/photo`}
                              alt={r.voter_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <User className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>
                        {r.image_matching_status === 'MATCHED' ? (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Matched
                          </span>
                        ) : r.image_matching_status === 'NEEDS_VERIFICATION' ? (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-2.5 h-2.5" /> Verify
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                            Missing
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100 font-telugu text-[13px]">
                      {r.voter_name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                        {r.relation_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-telugu text-[13px] text-slate-800 dark:text-slate-200">
                      {r.relation_name}
                    </td>
                    <td className="px-2 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {r.age}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.gender?.includes('స్త్రీ')
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                        }`}
                      >
                        {r.gender}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {r.house_no}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                      {r.voter_id}
                    </td>
                    <td className="px-2 py-2.5 text-center text-slate-500 font-mono text-[11px]">
                      {r.source_page}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handlePrintIndividualVoterPdf(r)}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md"
                          title="Generate & Print A4 Voter PDF"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        </button>
                        <button
                          onClick={() => copyRow(r)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md"
                          title="Copy row"
                        >
                          {copiedId === r.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <Link
                          to={`/my-wallet?voter_id=${r.id}`}
                          className="p-1 text-slate-400 hover:text-teal-600 rounded-md"
                          title="Disburse Funds / Spend on Voter"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          to={`/voter-entries?voter_id=${r.id}`}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded-md"
                          title="Record Mobile Number & Amount Entry"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => {
                            setEditingRecord(r);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-brand-600 rounded-md"
                          title="Edit OCR correction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span className="text-slate-400 ml-2">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalRecords)} of {totalRecords.toLocaleString()} records
            </span>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-semibold text-slate-800 dark:text-slate-200">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditVoterRecordModal
        record={editingRecord}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRecord(null);
        }}
        onSaved={(updated) => {
          setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }}
      />

      {/* A4 Voter List PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={isPdfModalOpen}
        onClose={() => {
          setIsPdfModalOpen(false);
          setPdfBlob(null);
        }}
        pdfBlob={pdfBlob}
        title={pdfTitle}
        filename={pdfFilename}
        loading={pdfLoading}
      />

      {/* Voter Photo Preview & Verification Modal */}
      {previewPhotoVoter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 overflow-hidden relative">
            <button
              onClick={() => setPreviewPhotoVoter(null)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 rounded-xl">
                <Camera className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-telugu">
                  ఓటరు ఫొటో & వివరాల ధృవీకరణ
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Voter Photograph & Spatial Extraction Verification Preview
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
              {/* Photo Display Card */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div className="w-32 h-40 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border-2 border-brand-500/30 shadow-md flex items-center justify-center relative">
                  {previewPhotoVoter.has_photo || previewPhotoVoter.photo_url || previewPhotoVoter.photo_path ? (
                    <img
                      src={previewPhotoVoter.photo_url || `/api/voters/${previewPhotoVoter.unique_key || previewPhotoVoter.id}/photo`}
                      alt={previewPhotoVoter.voter_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-3">
                      <User className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-400">(No Photo Extracted)</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    previewPhotoVoter.image_matching_status === 'MATCHED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : previewPhotoVoter.image_matching_status === 'NEEDS_VERIFICATION'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}>
                    {previewPhotoVoter.image_matching_status === 'MATCHED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {previewPhotoVoter.image_matching_status === 'NEEDS_VERIFICATION' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {previewPhotoVoter.image_matching_status || 'MISSING'}
                  </span>
                </div>
              </div>

              {/* Voter Details Card */}
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">ఓటరు పేరు (Name)</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 font-telugu text-sm">{previewPhotoVoter.voter_name}</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">EPIC / ఓటరు ఐడి</span>
                  <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{previewPhotoVoter.voter_id}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">వరుస సంఖ్య</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">#{previewPhotoVoter.serial_no}</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">మూల పుట</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">Page {previewPhotoVoter.source_page}</span>
                  </div>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">బ్లాక్ కోఆర్డినేట్లు (Block BBox)</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all">{previewPhotoVoter.block_bbox || 'Spatial Vector Grid'}</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">ఫొటో కోఆర్డినేట్లు (Photo BBox)</span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all">{previewPhotoVoter.photo_bbox || 'Contained in block'}</span>
                </div>
              </div>
            </div>

            {/* Quick Verification Actions */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                disabled={verifyingPhotoId === previewPhotoVoter.id}
                onClick={() => handleUpdatePhotoStatus(previewPhotoVoter.id, 'NEEDS_VERIFICATION')}
                className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-semibold transition-colors"
              >
                సమీక్ష అవసరం (Flag Verify)
              </button>
              <button
                disabled={verifyingPhotoId === previewPhotoVoter.id}
                onClick={() => handleUpdatePhotoStatus(previewPhotoVoter.id, 'MATCHED')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                సరిచూడబడింది (Confirm Matched)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
