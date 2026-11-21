import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, Table2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { TableRowTe, TableRowEn } from '../../types/document';
import { copyToClipboard, downloadCsv } from '../../utils/exportUtils';
import { SearchBar } from '../common/SearchBar';

interface ExtractedTableProps {
  tablesTe: TableRowTe[];
  tablesEn: TableRowEn[];
  warnings?: string[];
  onDownloadExcel?: () => void;
  documentName?: string;
}

export const ExtractedTable: React.FC<ExtractedTableProps> = ({
  tablesTe,
  tablesEn,
  warnings = [],
  onDownloadExcel,
  documentName = 'Document',
}) => {
  const [activeTab, setActiveTab] = useState<'telugu' | 'english'>('telugu');
  const [selectedPage, setSelectedPage] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const activeRows = activeTab === 'telugu' ? tablesTe : tablesEn;

  // Pages with tables
  const pages = useMemo(() => {
    const s = new Set<number>();
    activeRows.forEach((r) => s.add(r.Page));
    return Array.from(s).sort((a, b) => a - b);
  }, [activeRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return activeRows.filter((r) => {
      const matchPage = selectedPage === 'all' || String(r.Page) === selectedPage;
      const q = query.toLowerCase();
      const matchQuery = !q || Object.values(r).some((v) => String(v).toLowerCase().includes(q));
      return matchPage && matchQuery;
    });
  }, [activeRows, selectedPage, query]);

  // Columns
  const columns = useMemo(() => {
    if (!filteredRows.length) return [];
    return Object.keys(filteredRows[0]);
  }, [filteredRows]);

  const handleCopyTable = async () => {
    if (!filteredRows.length) return;
    const headers = columns.join('\t');
    const rows = filteredRows.map((r) => columns.map((c) => (r as any)[c] ?? '').join('\t')).join('\n');
    const text = `${headers}\n${rows}`;
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadCsv = () => {
    downloadCsv(filteredRows, `${documentName}_${activeTab}_tables.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Warnings banner if any */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Table Structure Extraction Notice</p>
            {warnings.map((w, i) => (
              <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400">
                • {w}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          {/* Tab switcher: Telugu vs English */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('telugu')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'telugu'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Telugu Tables ({tablesTe.length})
            </button>
            <button
              onClick={() => setActiveTab('english')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'english'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              English Tables ({tablesEn.length})
            </button>
          </div>

          {pages.length > 0 && (
            <select
              value={selectedPage}
              onChange={(e) => setSelectedPage(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Pages ({pages.length})</option>
              {pages.map((p) => (
                <option key={p} value={String(p)}>
                  Page {p}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SearchBar value={query} onChange={setQuery} placeholder="Search table..." className="w-48" />

          <button
            onClick={handleCopyTable}
            disabled={!filteredRows.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy</span>
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={!filteredRows.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          {onDownloadExcel && (
            <button
              onClick={onDownloadExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel (.xlsx)</span>
            </button>
          )}
        </div>
      </div>

      {/* Structured Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs">
        {!filteredRows.length ? (
          <div className="text-center py-12 text-slate-400 text-xs p-6">
            <Table2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p>No table rows found for the selected view.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="py-3 px-4 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-telugu">
              {filteredRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="py-3 px-4 max-w-md whitespace-pre-wrap leading-relaxed">
                      {String((row as any)[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
