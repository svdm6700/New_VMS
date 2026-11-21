import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableProperties, BookOpen, Layers, LayoutList } from 'lucide-react';
import { useDocuments } from '../contexts/DocumentContext';
import { VoterRecordsTable } from '../components/extraction/VoterRecordsTable';
import { StructuredDataViewer } from '../components/extraction/StructuredDataViewer';

export const ExtractedData: React.FC = () => {
  const navigate = useNavigate();
  const { activeDoc, activeDocId, documents, loadDocument } = useDocuments();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  return (
    <div className="space-y-5">
      {/* Page Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 rounded-xl">
              <TableProperties className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-telugu">
              వెలికితీసిన ఓటర్ రికార్డులు (Voter Records)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            PostgreSQL database-backed structured electoral roll voter records with all 10 columns, location filters, full search, and Excel export.
          </p>
        </div>

        {/* View Mode Toggle & Reader Button */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>10-Column Table</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2-Column Cards</span>
            </button>
          </div>

          <button
            onClick={() => navigate('/reader')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Open in Reader</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'table' ? (
        <VoterRecordsTable
          initialDocumentId={activeDocId || undefined}
          documents={documents}
          onDocumentChange={(docId) => {
            if (docId) loadDocument(docId);
          }}
        />
      ) : activeDoc ? (
        <StructuredDataViewer document={activeDoc} />
      ) : (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Please select or upload a document to view 2-column cards.
          </p>
        </div>
      )}
    </div>
  );
};
