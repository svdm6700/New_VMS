import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Download, FileText, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';

interface PdfProgressInfo {
  completed_pages: number;
  total_pages: number;
  failed_pages?: number;
  percent?: number;
}

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  title?: string;
  filename?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  progress?: PdfProgressInfo | null;
  onRetryFailedPages?: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  pdfBlob,
  title = 'A4 Voter List PDF Preview',
  filename = 'voter_list.pdf',
  loading = false,
  error = null,
  onRetry,
  progress = null,
  onRetryFailedPages,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setBlobUrl(null);
    }
  }, [pdfBlob]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else if (blobUrl) {
      // Fallback: open in new window and print
      const win = window.open(blobUrl, '_blank');
      if (win) {
        win.focus();
        win.print();
      }
    }
  };

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-telugu">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A4 Portrait (27 records/page) • Telugu Unicode Font • Permanent Unique Key
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !blobUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              title="Print PDF Document"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={loading || !blobUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
              title="Download PDF File"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            <button
              onClick={handleOpenNewTab}
              disabled={loading || !blobUrl}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-slate-200 dark:border-slate-700 mx-1" />

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Iframe Viewer */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 overflow-hidden relative flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 max-w-md w-full px-4 text-center">
              <RefreshCw className="w-9 h-9 animate-spin text-brand-600" />
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {progress && progress.total_pages > 1
                    ? `Page-Wise PDF Generation in Progress: Page ${Math.min(progress.total_pages, progress.completed_pages + 1)} of ${progress.total_pages}`
                    : 'Generating A4 Voter List PDF...'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Arranging 27 records per page, extracting voter photographs, and embedding permanent unique keys.
                </p>
              </div>

              {progress && progress.total_pages > 0 && (
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden shadow-inner mt-2">
                  <div
                    className="bg-brand-600 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((progress.completed_pages / progress.total_pages) * 100))}%`,
                    }}
                  />
                </div>
              )}

              {progress && (
                <div className="flex items-center justify-between w-full text-[11px] text-slate-500 font-medium px-1">
                  <span>{progress.completed_pages} / {progress.total_pages} Pages Completed</span>
                  <span>{Math.round((progress.completed_pages / progress.total_pages) * 100)}%</span>
                </div>
              )}
            </div>
          ) : error ? (
            <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 shadow-xl text-center flex flex-col items-center gap-4 animate-in fade-in">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                  PDF Generation Failed
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 break-words leading-relaxed">
                  {error}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full pt-2">
                {onRetryFailedPages && progress?.failed_pages && progress.failed_pages > 0 ? (
                  <button
                    onClick={onRetryFailedPages}
                    className="w-full sm:flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Failed Pages ({progress.failed_pages})</span>
                  </button>
                ) : null}
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="w-full sm:flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Again</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : blobUrl ? (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title="PDF Preview"
              className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white shadow-inner"
            />
          ) : (
            <div className="text-center text-slate-400">
              <p className="text-sm">No PDF data available to preview.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
