import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { DocumentItem } from '../../types/document';
import { formatBytes, formatDate } from '../../utils/formatters';

interface RecentDocumentsProps {
  documents: DocumentItem[];
  onSelectDoc: (id: string) => void;
  onUploadClick?: () => void;
}

export const RecentDocuments: React.FC<RecentDocumentsProps> = ({ documents, onSelectDoc, onUploadClick }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Recently Processed PDFs</h3>
          <p className="text-xs text-slate-400">Latest Telugu documents and electoral rolls</p>
        </div>
        <button
          onClick={() => navigate('/extracted-data')}
          className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {!documents || documents.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          No documents processed yet.
          {onUploadClick && (
            <button
              onClick={onUploadClick}
              className="block mx-auto mt-2 text-brand-600 dark:text-brand-400 font-semibold hover:underline"
            >
              Upload your first Telugu PDF
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {documents.slice(0, 5).map((doc) => (
            <div
              key={doc.id}
              onClick={() => onSelectDoc(doc.id)}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                  <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {doc.filename}
                  </p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>{formatBytes(doc.file_size)}</span>
                    <span>•</span>
                    <span>{doc.page_count} pages</span>
                    {doc.records_count !== undefined && doc.records_count > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-brand-600 dark:text-brand-400">
                          {doc.records_count.toLocaleString()} voters
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
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
                <span className="text-[11px] text-slate-400 hidden sm:inline">{formatDate(doc.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
