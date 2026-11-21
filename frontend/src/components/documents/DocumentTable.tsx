import React from 'react';
import {
  FileText,
  BookOpen,
  FileCode,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  TableProperties,
} from 'lucide-react';
import { DocumentItem } from '../../types/document';
import { formatBytes, formatDate } from '../../utils/formatters';

interface DocumentTableProps {
  documents: DocumentItem[];
  onOpenReader: (id: string) => void;
  onViewText: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onViewRecords?: (id: string) => void;
}

export const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  onOpenReader,
  onViewText,
  onDownload,
  onDelete,
  onViewRecords,
}) => {
  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
          <tr>
            <th className="py-3.5 px-4">Document Name</th>
            <th className="py-3.5 px-3">Location (ప్రాంత వివరాలు)</th>
            <th className="py-3.5 px-3">Size</th>
            <th className="py-3.5 px-3">Pages</th>
            <th className="py-3.5 px-3">Voter Records</th>
            <th className="py-3.5 px-3">Status</th>
            <th className="py-3.5 px-3">Uploaded Date</th>
            <th className="py-3.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
          {documents.map((doc) => (
            <tr
              key={doc.id}
              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
            >
              <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="truncate font-semibold" title={doc.filename}>{doc.filename}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                <div className="min-w-[140px]">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {doc.area || '—'} {doc.ward_number ? `(W-${doc.ward_number})` : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {doc.constituency || '—'}, {doc.district || '—'}
                  </p>
                </div>
              </td>
              <td className="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {formatBytes(doc.file_size)}
              </td>
              <td className="py-3 px-3 whitespace-nowrap">
                <span className="font-semibold">{doc.page_count}</span>
                {doc.ocr_pages && doc.ocr_pages > 0 ? (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 block">
                    ({doc.ocr_pages} OCR)
                  </span>
                ) : null}
              </td>
              <td className="py-3 px-3 whitespace-nowrap">
                {doc.records_count !== undefined && doc.records_count > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-900">
                    {doc.records_count.toLocaleString()} voters
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px]">—</span>
                )}
              </td>
              <td className="py-3 px-3 whitespace-nowrap">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                    doc.status === 'completed'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      : doc.status === 'failed'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {doc.status === 'completed' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : doc.status === 'failed' ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                  {doc.status}
                </span>
              </td>
              <td className="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {formatDate(doc.created_at)}
              </td>
              <td className="py-3 px-4 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  {onViewRecords && (
                    <button
                      onClick={() => onViewRecords(doc.id)}
                      title="View Voter Records Table"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors"
                    >
                      <TableProperties className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onOpenReader(doc.id)}
                    title="Open in Split Reader"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onViewText(doc.id)}
                    title="View Extracted Text"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDownload(doc.id)}
                    title="Download Excel Workbook"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(doc.id)}
                    title="Delete Document"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
