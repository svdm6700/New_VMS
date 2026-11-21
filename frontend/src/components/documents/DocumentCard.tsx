import React from 'react';
import {
  FileText,
  BookOpen,
  Eye,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { DocumentItem } from '../../types/document';
import { formatBytes, formatDate } from '../../utils/formatters';

interface DocumentCardProps {
  doc: DocumentItem;
  onOpenReader: (id: string) => void;
  onViewText: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  doc,
  onOpenReader,
  onViewText,
  onDownload,
  onDelete,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
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
        </div>

        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 truncate" title={doc.filename}>
          {doc.filename}
        </h4>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          <span>{formatBytes(doc.file_size)}</span>
          <span>•</span>
          <span>{doc.page_count} pages</span>
          <span>•</span>
          <span>{doc.processing_type || 'Electoral Roll'}</span>
        </div>

        {/* Location Details Pill */}
        {(doc.district || doc.area) && (
          <div className="mb-4 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[10px] space-y-0.5">
            <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span className="truncate">📍 {doc.area || 'N/A'} (Ward {doc.ward_number || 'N/A'})</span>
            </div>
            <div className="text-slate-400 truncate">
              {doc.constituency || 'N/A'} · {doc.district || 'N/A'}
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400">{formatDate(doc.created_at)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onOpenReader(doc.id)}
            title="Read in split viewer"
            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewText(doc.id)}
            title="View Extracted Content"
            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDownload(doc.id)}
            title="Export Excel"
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(doc.id)}
            title="Delete"
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
