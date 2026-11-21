import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { useDocuments } from '../contexts/DocumentContext';
import { ExtractedTable } from '../components/tables/ExtractedTable';
import { EmptyState } from '../components/common/EmptyState';
import { documentService } from '../services/documentService';
import { downloadBlob } from '../utils/exportUtils';

export const Tables: React.FC = () => {
  const navigate = useNavigate();
  const { activeDoc, activeDocId, documents, loadDocument } = useDocuments();

  const handleDownloadExcel = async () => {
    if (!activeDoc) return;
    try {
      const blob = await documentService.exportExcel(activeDoc);
      downloadBlob(blob, `${activeDoc.metadata?.filename || 'Document'}_tables.xlsx`);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  if (!activeDoc) {
    return (
      <div className="py-8">
        <EmptyState
          icon={Table2}
          title="No document selected"
          description="Select a document or upload a voter document with digital or scanned tables."
          action={{
            label: 'Upload Voter Document',
            onClick: () => navigate('/upload'),
          }}
        />
      </div>
    );
  }

  const tablesTe = activeDoc.table_rows_te || [];
  const tablesEn = activeDoc.table_rows_en || [];
  const warnings = activeDoc.validation?.review_notes || [];

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Table2 className="w-5 h-5 text-brand-600" />
            Extracted Tables & Rows
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Document: <span className="font-semibold text-slate-800 dark:text-slate-200">{activeDoc.metadata?.filename}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {documents.length > 1 && (
            <select
              value={activeDocId || ''}
              onChange={(e) => loadDocument(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      <ExtractedTable
        tablesTe={tablesTe}
        tablesEn={tablesEn}
        warnings={warnings}
        onDownloadExcel={handleDownloadExcel}
        documentName={activeDoc.metadata?.filename}
      />
    </div>
  );
};
