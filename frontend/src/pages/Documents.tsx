import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  LayoutGrid,
  List,
  Filter,
  ArrowUpDown,
  UploadCloud,
  FileText,
} from 'lucide-react';
import { useDocuments } from '../contexts/DocumentContext';
import { DocumentTable } from '../components/documents/DocumentTable';
import { DocumentCard } from '../components/documents/DocumentCard';
import { SearchBar } from '../components/common/SearchBar';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { documentService } from '../services/documentService';
import { downloadBlob } from '../utils/exportUtils';

export const Documents: React.FC = () => {
  const navigate = useNavigate();
  const { documents, loadDocument, deleteDocument } = useDocuments();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [constituencyFilter, setConstituencyFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [wardFilter, setWardFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'filename' | 'file_size'>('created_at');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Extract unique locations from loaded documents
  const uniqueDistricts = useMemo(() => {
    return Array.from(new Set(documents.map((d) => d.district).filter(Boolean))) as string[];
  }, [documents]);

  const uniqueConstituencies = useMemo(() => {
    return Array.from(new Set(documents.map((d) => d.constituency).filter(Boolean))) as string[];
  }, [documents]);

  const uniqueAreas = useMemo(() => {
    return Array.from(new Set(documents.map((d) => d.area).filter(Boolean))) as string[];
  }, [documents]);

  const uniqueWards = useMemo(() => {
    return Array.from(new Set(documents.map((d) => d.ward_number).filter(Boolean))) as string[];
  }, [documents]);

  // Delete modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filter and sort
  const filtered = useMemo(() => {
    return documents
      .filter((d) => {
        const matchSearch =
          !search ||
          d.filename.toLowerCase().includes(search.toLowerCase()) ||
          (d.district && d.district.toLowerCase().includes(search.toLowerCase())) ||
          (d.constituency && d.constituency.toLowerCase().includes(search.toLowerCase())) ||
          (d.area && d.area.toLowerCase().includes(search.toLowerCase())) ||
          (d.ward_number && d.ward_number.toLowerCase().includes(search.toLowerCase()));

        const matchStatus = statusFilter === 'all' || d.status === statusFilter;
        const matchDistrict = districtFilter === 'all' || d.district === districtFilter;
        const matchConstituency = constituencyFilter === 'all' || d.constituency === constituencyFilter;
        const matchArea = areaFilter === 'all' || d.area === areaFilter;
        const matchWard = wardFilter === 'all' || d.ward_number === wardFilter;

        return matchSearch && matchStatus && matchDistrict && matchConstituency && matchArea && matchWard;
      })
      .sort((a, b) => {
        if (sortBy === 'filename') return a.filename.localeCompare(b.filename);
        if (sortBy === 'file_size') return b.file_size - a.file_size;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [documents, search, statusFilter, districtFilter, constituencyFilter, areaFilter, wardFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const handleOpenReader = async (id: string) => {
    await loadDocument(id);
    navigate('/reader');
  };

  const handleViewText = async (id: string) => {
    await loadDocument(id);
    navigate('/extracted-data');
  };

  const handleDownload = async (id: string) => {
    try {
      const full = await documentService.getDocument(id);
      const blob = await documentService.exportExcel(full);
      downloadBlob(blob, `${full.metadata?.filename || 'telugu_doc'}_analysis.xlsx`);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteId) {
      await deleteDocument(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Title & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Document Management</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage, search, review, and export your uploaded voter documents and electoral rolls.
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Voter Document</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="space-y-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <SearchBar value={search} onChange={setSearch} placeholder="Search documents by name, district, area..." className="flex-1" />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="created_at">Date Added</option>
              <option value="filename">Name</option>
              <option value="file_size">File Size</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-end sm:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Location Filters Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <span>Filter Location:</span>
          </span>

          {/* District Filter */}
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="all">All Districts (అన్ని జిల్లాలు)</option>
            {uniqueDistricts.map((dist) => (
              <option key={dist} value={dist}>{dist}</option>
            ))}
          </select>

          {/* Constituency Filter */}
          <select
            value={constituencyFilter}
            onChange={(e) => setConstituencyFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="all">All Constituencies (నియోజకవర్గాలు)</option>
            {uniqueConstituencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Area Filter */}
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
          >
            <option value="all">All Areas / Villages (గ్రామాలు)</option>
            {uniqueAreas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Ward Filter */}
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
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
              }}
              className="px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Reset Location Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!filtered.length ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents found"
          description={
            search
              ? 'No documents matched your search term.'
              : 'Your document repository is currently empty. Upload a voter document to get started.'
          }
          action={{
            label: 'Upload First Document',
            onClick: () => navigate('/upload'),
          }}
        />
      ) : viewMode === 'table' ? (
        <DocumentTable
          documents={paginatedDocs}
          onOpenReader={handleOpenReader}
          onViewText={handleViewText}
          onDownload={handleDownload}
          onDelete={(id) => setDeleteId(id)}
          onViewRecords={(id) => {
            loadDocument(id);
            navigate('/extracted-data');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onOpenReader={handleOpenReader}
              onViewText={handleViewText}
              onDownload={handleDownload}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-500">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filtered.length)} of{' '}
            {filtered.length} items
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationDialog
        isOpen={Boolean(deleteId)}
        title="Delete Document"
        message="Are you sure you want to delete this document from the repository? This action permanently removes the stored PDF and all extracted analysis."
        confirmLabel="Delete"
        isDestructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};
