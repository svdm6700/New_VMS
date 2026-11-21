import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { PDFToolbar } from './PDFToolbar';
import { FileQuestion, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

// Configure pdfjs worker using modern Vite URL resolver
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFViewerProps {
  fileUrl: string | null;
  currentPage: number;
  totalPages: number;
  scale: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleFullscreen?: () => void;
  onPageCountChange?: (count: number) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  fileUrl,
  currentPage,
  totalPages,
  scale,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen,
  onPageCountChange,
}) => {
  const [numPages, setNumPages] = useState<number>(totalPages || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    if (onPageCountChange) {
      onPageCountChange(numPages);
    }
  };

  const handleDocumentLoadError = (err: Error) => {
    setLoading(false);
    setError(err.message || 'Failed to load PDF document via React-PDF renderer.');
  };

  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[450px] bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <FileQuestion className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
        <p className="text-xs font-medium">No PDF loaded for preview</p>
        <p className="text-[11px] text-slate-400">Select or upload a document to view its pages.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
      <PDFToolbar
        currentPage={currentPage}
        totalPages={numPages}
        scale={scale}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetZoom={onResetZoom}
        onToggleFullscreen={onToggleFullscreen}
        fileUrl={fileUrl}
      />

      <div className="flex-1 w-full relative bg-slate-200/50 dark:bg-slate-950/80 overflow-auto flex items-start justify-center p-4">
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-slate-600 dark:text-slate-400 max-w-md my-auto">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Canvas Render Notice</p>
            <p className="text-[11px] text-slate-500 mb-3">{error}</p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg font-medium text-xs hover:bg-brand-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Original PDF Directly
            </a>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center p-12 text-slate-500 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600 mb-2" />
                <span>Loading PDF page...</span>
              </div>
            }
            className="flex justify-center shadow-lg rounded-lg overflow-hidden"
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderAnnotationLayer={true}
              renderTextLayer={true}
              className="rounded-lg bg-white overflow-hidden"
              loading={
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
                </div>
              }
            />
          </Document>
        )}
      </div>
    </div>
  );
};
