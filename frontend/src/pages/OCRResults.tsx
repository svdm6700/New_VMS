import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanEye, UploadCloud, BookOpen } from 'lucide-react';
import { useDocuments } from '../contexts/DocumentContext';
import { OCRResultViewer } from '../components/ocr/OCRResultViewer';
import { EmptyState } from '../components/common/EmptyState';

export const OCRResults: React.FC = () => {
  const navigate = useNavigate();
  const { activeDoc, activeDocId, documents, loadDocument } = useDocuments();

  if (!activeDoc) {
    return (
      <div className="py-8">
        <EmptyState
          icon={ScanEye}
          title="No document selected"
          description="Select a document or upload a scanned voter document to view OCR recognition results."
          action={{
            label: 'Upload Voter Document',
            onClick: () => navigate('/upload'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ScanEye className="w-5 h-5 text-brand-600" />
            Tesseract OCR Recognition Results
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
            onClick={() => navigate('/reader')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Open in Reader</span>
          </button>
        </div>
      </div>

      <OCRResultViewer
        pages={activeDoc.pages || []}
        validation={activeDoc.validation}
        documentName={activeDoc.metadata?.filename}
      />
    </div>
  );
};
