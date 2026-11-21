import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  UploadCloud,
  Columns,
  TableProperties,
  Languages,
} from 'lucide-react';
import { useDocuments } from '../contexts/DocumentContext';
import { PDFViewer } from '../components/reader/PDFViewer';
import { ExtractedTextViewer } from '../components/extraction/ExtractedTextViewer';
import { StructuredDataViewer } from '../components/extraction/StructuredDataViewer';
import { documentService } from '../services/documentService';
import { EmptyState } from '../components/common/EmptyState';

export const PDFReader: React.FC = () => {
  const navigate = useNavigate();
  const { activeDoc, activeDocId, documents, loadDocument } = useDocuments();

  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [mobileTab, setMobileTab] = useState<'pdf' | 'extracted'>('pdf');
  const [rightPanelTab, setRightPanelTab] = useState<'structured' | 'paragraphs'>('structured');
  const [fullscreenPanel, setFullscreenPanel] = useState<'none' | 'pdf' | 'extracted'>('none');
  const [loadedPages, setLoadedPages] = useState<number | null>(null);

  const totalPages = loadedPages || activeDoc?.metadata?.page_count || activeDoc?.pages?.length || 1;
  const fileUrl = activeDocId ? documentService.getDocumentFileUrl(activeDocId) : null;

  const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const handleZoomIn = () => setScale((s) => Math.min(2.5, s + 0.15));
  const handleZoomOut = () => setScale((s) => Math.max(0.5, s - 0.15));
  const handleResetZoom = () => setScale(1.0);

  if (!activeDoc) {
    return (
      <div className="py-8">
        <EmptyState
          icon={BookOpen}
          title="No document selected"
          description="Select an existing document from your repository or upload a new Telugu PDF to view it in the Split Reader."
          action={{
            label: 'Go to Upload',
            onClick: () => navigate('/upload'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-3">
      {/* Top Document Selector & Mode Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
            {activeDoc.metadata?.filename}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-[10px] font-semibold shrink-0">
            {totalPages} Pages
          </span>

          {(activeDoc.metadata?.area || (activeDoc as any)?.area) && (
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium shrink-0">
              <span>📍 {activeDoc.metadata?.area || (activeDoc as any)?.area} (W-{activeDoc.metadata?.ward_number || (activeDoc as any)?.ward_number})</span>
              <span className="text-slate-400">· {activeDoc.metadata?.constituency || (activeDoc as any)?.constituency}</span>
            </span>
          )}

          {documents.length > 1 && (
            <select
              value={activeDocId || ''}
              onChange={(e) => loadDocument(e.target.value)}
              className="hidden sm:inline-block px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  Switch: {d.filename}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex items-center gap-1 sm:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setMobileTab('pdf')}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold ${
              mobileTab === 'pdf' ? 'bg-white dark:bg-slate-700 text-brand-600' : 'text-slate-500'
            }`}
          >
            Original PDF
          </button>
          <button
            onClick={() => setMobileTab('extracted')}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold ${
              mobileTab === 'extracted' ? 'bg-white dark:bg-slate-700 text-brand-600' : 'text-slate-500'
            }`}
          >
            Extracted Content
          </button>
        </div>

        {/* Desktop View Modes */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => setFullscreenPanel(fullscreenPanel === 'pdf' ? 'none' : 'pdf')}
            className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${
              fullscreenPanel === 'pdf' ? 'bg-brand-100 text-brand-700' : ''
            }`}
            title="Focus PDF viewer"
          >
            <Columns className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Split-Screen Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
        {/* Left Panel: Original PDF */}
        <div
          className={`h-full min-h-0 ${
            mobileTab === 'pdf' ? 'block' : 'hidden sm:block'
          } ${fullscreenPanel === 'extracted' ? 'hidden' : ''} ${
            fullscreenPanel === 'pdf' ? 'lg:col-span-2' : ''
          }`}
        >
          <PDFViewer
            fileUrl={fileUrl}
            currentPage={currentPage}
            totalPages={totalPages}
            scale={scale}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onPageCountChange={setLoadedPages}
            onToggleFullscreen={() => setFullscreenPanel(fullscreenPanel === 'pdf' ? 'none' : 'pdf')}
          />
        </div>

        {/* Right Panel: Extracted Telugu & English Content */}
        <div
          className={`h-full min-h-0 flex flex-col ${
            mobileTab === 'extracted' ? 'block' : 'hidden sm:flex'
          } ${fullscreenPanel === 'pdf' ? 'hidden' : ''} ${
            fullscreenPanel === 'extracted' ? 'lg:col-span-2' : ''
          }`}
        >
          {/* Tab Selector for Right Panel */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl mb-2 shrink-0 self-start text-xs font-semibold">
            <button
              onClick={() => setRightPanelTab('structured')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                rightPanelTab === 'structured'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Structured Fields (2-Col)</span>
            </button>
            <button
              onClick={() => setRightPanelTab('paragraphs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                rightPanelTab === 'paragraphs'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paragraphs & Translation</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {rightPanelTab === 'structured' ? (
              <StructuredDataViewer document={activeDoc} />
            ) : (
              <ExtractedTextViewer
                paragraphs={activeDoc.paragraphs || []}
                pages={activeDoc.pages || []}
                documentName={activeDoc.metadata?.filename}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
