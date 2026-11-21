import React from 'react';
import { Sparkles, Scan, Table, CheckCircle } from 'lucide-react';
import { DocumentItem } from '../../types/document';
import { formatDate } from '../../utils/formatters';

export const ActivityFeed: React.FC<{ documents: DocumentItem[] }> = ({ documents }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Recent Activity</h3>
      <p className="text-xs text-slate-400 mb-4">Pipeline processing events</p>

      {!documents.length ? (
        <p className="text-xs text-slate-400 py-6 text-center">No processing activity logged yet.</p>
      ) : (
        <div className="space-y-4">
          {documents.slice(0, 4).map((doc, idx) => (
            <div key={idx} className="flex gap-3 text-xs">
              <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 shrink-0">
                {(doc.ocr_pages ?? 0) > 0 ? <Scan className="w-4 h-4" /> : <Table className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-slate-800 dark:text-slate-200">
                  <span className="font-semibold">{doc.filename}</span> was processed via{' '}
                  <span className="font-medium text-brand-600 dark:text-brand-400">{doc.processing_type}</span>.
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(doc.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
